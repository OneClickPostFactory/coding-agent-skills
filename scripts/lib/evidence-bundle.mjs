import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  completionIssues,
  detectSensitiveValues,
  PILOT_VERSION,
  PREVIOUS_PILOT_VERSION,
} from "./pack-rules.mjs";
import { validateValue } from "./schema-validator.mjs";

const DEFAULT_CORE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const STATUS_RANK = new Map([
  ["complete", 3],
  ["pass", 3],
  ["partial", 2],
  ["warn", 2],
  ["blocked", 1],
  ["failed", 0],
  ["fail", 0],
]);

function readText(file) {
  return fs.readFileSync(file, "utf8");
}

function readJson(file) {
  return JSON.parse(readText(file));
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}

function reportHash(report) {
  return sha256(JSON.stringify(canonical(report)));
}

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safeEntryPath(bundleRoot, relativePath) {
  if (!relativePath || typeof relativePath !== "string") {
    return { ok: false, code: "missing-entry-path" };
  }
  if (path.isAbsolute(relativePath) || relativePath.split(/[\\/]+/).includes("..")) {
    return { ok: false, code: "entry-path-traversal" };
  }
  if (relativePath.split(/[\\/]+/).some((part) => /^\.env(?:\.|$)/.test(part))) {
    return { ok: false, code: "entry-secret-path" };
  }
  const resolved = path.resolve(bundleRoot, relativePath);
  if (!inside(bundleRoot, resolved)) return { ok: false, code: "entry-path-traversal" };
  if (!fs.existsSync(resolved)) return { ok: false, code: "entry-missing" };
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) return { ok: false, code: "entry-symlink-escape" };
  if (!stat.isFile()) return { ok: false, code: "entry-not-file" };
  return { ok: true, path: resolved };
}

function statusOfEvidence(kind, evidence) {
  if (kind === "evidence-pack") return evidence.status;
  if (kind === "adapter-upgrade-evidence") return evidence.finalStatus;
  return undefined;
}

function schemaForKind(kind, schemas) {
  if (kind === "evidence-pack") return schemas.evidencePack;
  if (kind === "adapter-upgrade-evidence") return schemas.adapterUpgradeEvidence;
  return null;
}

function entryIssues(entry, evidence, schemas) {
  const issues = [];
  const schema = schemaForKind(entry.kind, schemas);
  if (!schema) {
    issues.push("unsupported-entry-kind");
    return issues;
  }
  issues.push(...validateValue(schema, evidence).map((issue) => `schema:${issue}`));
  if (entry.kind === "evidence-pack") {
    issues.push(...completionIssues(evidence).map((issue) => `completion:${issue}`));
  }
  const actualStatus = statusOfEvidence(entry.kind, evidence);
  if (actualStatus !== entry.expectedStatus) issues.push("status-mismatch");
  if (evidence.changedState?.changed === true) issues.push("changed-state-detected");
  return issues;
}

function regressionIssues(bundle, verifiedEntries) {
  const issues = [];
  if (bundle.regression.baselineVersion !== PREVIOUS_PILOT_VERSION) {
    issues.push("baseline-version-mismatch");
  }
  if (bundle.regression.targetVersion !== PILOT_VERSION) {
    issues.push("target-version-mismatch");
  }
  const byId = new Map(verifiedEntries.map((entry) => [entry.id, entry]));
  for (const baseline of bundle.regression.baselineEntries) {
    const current = byId.get(baseline.id);
    if (!current) {
      issues.push(`missing-baseline-entry:${baseline.id}`);
      continue;
    }
    if ((STATUS_RANK.get(current.status) ?? -1) < (STATUS_RANK.get(baseline.status) ?? -1)) {
      issues.push(`status-regression:${baseline.id}`);
    }
  }
  return issues.sort();
}

export function verifyEvidenceBundle(bundleFile, options = {}) {
  const coreRoot = path.resolve(options.coreRoot ?? DEFAULT_CORE_ROOT);
  const bundlePath = path.resolve(bundleFile ?? "");
  if (!bundleFile) {
    return { ok: false, status: "failed", codes: ["missing-bundle-file"] };
  }
  if (!fs.existsSync(bundlePath)) {
    return { ok: false, status: "failed", codes: ["bundle-not-found"] };
  }
  if (fs.lstatSync(bundlePath).isSymbolicLink()) {
    return { ok: false, status: "failed", codes: ["bundle-symlink-escape"] };
  }

  const bundleRoot = path.dirname(bundlePath);
  const schemas = {
    evidenceBundle: readJson(path.join(coreRoot, "schemas/evidence-bundle.schema.json")),
    evidencePack: readJson(
      path.join(coreRoot, "contracts/evidence-pack/evidence-pack.schema.json"),
    ),
    adapterUpgradeEvidence: readJson(
      path.join(coreRoot, "schemas/adapter-upgrade-evidence.schema.json"),
    ),
  };
  const codes = new Set();
  const failures = [];
  let bundle;

  try {
    const rawBundle = readText(bundlePath);
    if (detectSensitiveValues(rawBundle).length) codes.add("secret-like-content");
    bundle = JSON.parse(rawBundle);
  } catch {
    return { ok: false, status: "failed", codes: ["bundle-json-invalid"] };
  }

  for (const issue of validateValue(schemas.evidenceBundle, bundle)) {
    failures.push(`bundle:${issue}`);
    codes.add("bundle-schema-invalid");
  }
  if (bundle.core?.currentVersion !== PILOT_VERSION) codes.add("current-version-mismatch");
  if (bundle.core?.previousVersion !== PREVIOUS_PILOT_VERSION) {
    codes.add("previous-version-mismatch");
  }
  if (bundle.changedState?.changed !== false) codes.add("changed-state-detected");

  const verifiedEntries = [];
  const seenIds = new Set();
  for (const entry of bundle.entries ?? []) {
    if (seenIds.has(entry.id)) codes.add("duplicate-entry-id");
    seenIds.add(entry.id);

    const safePath = safeEntryPath(bundleRoot, entry.path);
    if (!safePath.ok) {
      codes.add(safePath.code);
      verifiedEntries.push({
        id: entry.id,
        kind: entry.kind,
        status: "fail",
        hash: null,
        codes: [safePath.code],
      });
      continue;
    }

    const rawEntry = readText(safePath.path);
    const actualHash = sha256(rawEntry);
    const entryCodes = [];
    if (actualHash !== entry.sha256) entryCodes.push("hash-mismatch");
    if (detectSensitiveValues(rawEntry).length) entryCodes.push("secret-like-content");
    let evidence;
    try {
      evidence = JSON.parse(rawEntry);
    } catch {
      entryCodes.push("entry-json-invalid");
      evidence = {};
    }
    entryCodes.push(...entryIssues(entry, evidence, schemas));
    for (const code of entryCodes) codes.add(code.split(":")[0]);
    verifiedEntries.push({
      id: entry.id,
      kind: entry.kind,
      status: statusOfEvidence(entry.kind, evidence) ?? "fail",
      hash: actualHash,
      codes: [...new Set(entryCodes)].sort(),
    });
  }

  const regressionCodes = regressionIssues(bundle, verifiedEntries);
  for (const code of regressionCodes) codes.add(code.split(":")[0]);

  const stableReport = {
    bundleId: bundle.bundleId ?? null,
    core: {
      currentVersion: bundle.core?.currentVersion ?? null,
      previousVersion: bundle.core?.previousVersion ?? null,
    },
    entries: verifiedEntries,
    regression: {
      baselineVersion: bundle.regression?.baselineVersion ?? null,
      targetVersion: bundle.regression?.targetVersion ?? null,
      codes: regressionCodes,
    },
  };
  const firstHash = reportHash(stableReport);
  const secondHash = reportHash(stableReport);
  if (firstHash !== secondHash) codes.add("replay-nondeterministic");

  const report = {
    ok: codes.size === 0,
    status: codes.size === 0 ? "complete" : "failed",
    bundleId: bundle.bundleId ?? null,
    entryCount: verifiedEntries.length,
    verifiedEntries,
    replay: {
      deterministic: firstHash === secondHash,
      reportHash: firstHash,
    },
    regression: {
      baselineVersion: bundle.regression?.baselineVersion ?? null,
      targetVersion: bundle.regression?.targetVersion ?? null,
      codes: regressionCodes,
    },
    codes: [...codes].sort(),
    failures,
    changedState: {
      changed: false,
      summary: "Evidence bundle verification did not modify project, runtime, service, database, or remote state.",
    },
  };
  return report;
}

export function formatEvidenceBundleSummary(result) {
  if (result.ok) {
    return [
      `evidence bundle verified: ${result.entryCount} entries, deterministic replay accepted`,
      `regression baseline ${result.regression.baselineVersion} -> ${result.regression.targetVersion}`,
    ];
  }
  return [
    `evidence bundle failed: ${result.entryCount ?? 0} entries checked`,
    `rejection codes: ${(result.codes ?? []).join(",")}`,
  ];
}

export function evidenceBundleCliResult(bundleFile, options = {}) {
  if (!bundleFile) {
    return {
      exitCode: 2,
      stream: "stderr",
      lines: ["usage: node scripts/verify-evidence-bundle.mjs <bundle-file> [--json]"],
    };
  }
  const result = verifyEvidenceBundle(bundleFile, options);
  if (options.json) {
    return {
      exitCode: result.ok ? 0 : 1,
      stream: "stdout",
      lines: [JSON.stringify(result, null, 2)],
      result,
    };
  }
  return {
    exitCode: result.ok ? 0 : 1,
    stream: result.ok ? "stdout" : "stderr",
    lines: formatEvidenceBundleSummary(result),
    result,
  };
}
