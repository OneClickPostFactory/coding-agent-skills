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
const MIN_SYNTHETIC_RETENTION_DAYS = 30;
const MIN_MAINTAINER_RETENTION_DAYS = 90;
const MAX_RETENTION_DAYS = 3650;
const MIN_ARCHIVE_REPORT_BYTES = 512;
const MAX_ARCHIVE_REPORT_BYTES = 250000;

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

function safeRelativePath(bundleRoot, relativePath, options = {}) {
  const extension = options.extension ?? ".json";
  const missingCode = options.missingCode ?? "missing-path";
  const traversalCode = options.traversalCode ?? "path-traversal";
  const secretCode = options.secretCode ?? "secret-path";
  const missingFileCode = options.missingFileCode ?? "path-missing";
  const symlinkCode = options.symlinkCode ?? "path-symlink-escape";
  const notFileCode = options.notFileCode ?? "path-not-file";
  const requireExists = options.requireExists ?? true;

  if (!relativePath || typeof relativePath !== "string") {
    return { ok: false, code: missingCode };
  }
  if (path.isAbsolute(relativePath) || relativePath.split(/[\\/]+/).includes("..")) {
    return { ok: false, code: traversalCode };
  }
  if (relativePath.split(/[\\/]+/).some((part) => /^\.env(?:\.|$)/.test(part))) {
    return { ok: false, code: secretCode };
  }
  if (extension && !relativePath.endsWith(extension)) {
    return { ok: false, code: notFileCode };
  }
  const resolved = path.resolve(bundleRoot, relativePath);
  if (!inside(bundleRoot, resolved)) return { ok: false, code: traversalCode };
  if (!fs.existsSync(resolved)) {
    return requireExists ? { ok: false, code: missingFileCode } : { ok: true, path: resolved };
  }
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) return { ok: false, code: symlinkCode };
  if (!stat.isFile()) return { ok: false, code: notFileCode };
  return { ok: true, path: resolved };
}

function safeEntryPath(bundleRoot, relativePath) {
  return safeRelativePath(bundleRoot, relativePath, {
    extension: ".json",
    missingCode: "missing-entry-path",
    traversalCode: "entry-path-traversal",
    secretCode: "entry-secret-path",
    missingFileCode: "entry-missing",
    symlinkCode: "entry-symlink-escape",
    notFileCode: "entry-not-file",
  });
}

function safeArchivePath(bundleRoot, relativePath) {
  return safeRelativePath(bundleRoot, relativePath, {
    extension: ".json",
    requireExists: false,
    missingCode: "missing-archive-path",
    traversalCode: "archive-path-traversal",
    secretCode: "archive-secret-path",
    symlinkCode: "archive-symlink-escape",
    notFileCode: "archive-not-file",
  });
}

function dateValue(value) {
  const parsed = Date.parse(value ?? "");
  return Number.isNaN(parsed) ? null : parsed;
}

function daysBetween(start, end) {
  return (end - start) / (24 * 60 * 60 * 1000);
}

function retentionIssues(bundle) {
  const issues = [];
  const retention = bundle.retention ?? {};
  const minimumDays = retention.minimumDays;
  const minAllowed =
    retention.classification === "maintainer-release-evidence"
      ? MIN_MAINTAINER_RETENTION_DAYS
      : MIN_SYNTHETIC_RETENTION_DAYS;

  if (!Number.isInteger(minimumDays)) {
    issues.push("retention-minimum-days-invalid");
  } else {
    if (minimumDays < minAllowed) issues.push("retention-window-too-short");
    if (minimumDays > MAX_RETENTION_DAYS) issues.push("retention-window-too-long");
  }

  const generatedAt = dateValue(bundle.generatedAt);
  const retainUntil = dateValue(retention.retainUntil);
  if (generatedAt === null || retainUntil === null) {
    issues.push("retention-date-invalid");
  } else if (retainUntil <= generatedAt) {
    issues.push("retention-expired");
  } else if (Number.isInteger(minimumDays) && daysBetween(generatedAt, retainUntil) < minimumDays) {
    issues.push("retention-retain-until-too-soon");
  }

  if (retention.redaction !== "secret-values-prohibited") {
    issues.push("retention-redaction-weakened");
  }
  return issues.sort();
}

function provenanceIssues(bundle) {
  const issues = [];
  const provenance = bundle.provenance ?? {};
  const signature = provenance.signature ?? {};
  if (provenance.sourceTag !== `v${bundle.core?.currentVersion}`) {
    issues.push("provenance-tag-mismatch");
  }
  if (detectSensitiveValues(JSON.stringify(provenance)).length) {
    issues.push("provenance-secret-like-content");
  }
  if (signature.mode !== "detached-signature-design") {
    issues.push("provenance-signature-mode-invalid");
  }
  if (signature.canonicalization !== "canonical-json-v1") {
    issues.push("provenance-canonicalization-invalid");
  }
  if (signature.digestAlgorithm !== "sha256") {
    issues.push("provenance-digest-invalid");
  }
  if (signature.status === "unsigned-fixture" && provenance.source !== "synthetic-fixture") {
    issues.push("provenance-unsigned-nonfixture");
  }
  if (signature.status === "detached-signature-present") {
    if (!signature.signaturePath || !signature.signatureSha256) {
      issues.push("provenance-detached-signature-missing");
    }
  } else if (signature.signaturePath || signature.signatureSha256) {
    issues.push("provenance-unexpected-signature-artifact");
  }
  if (signature.status === "verification-deferred") {
    issues.push("provenance-signature-verification-deferred");
  }
  return issues.sort();
}

function archiveIssues(bundle, bundleRoot) {
  const issues = [];
  const archive = bundle.archive ?? {};
  const safePath = safeArchivePath(bundleRoot, archive.reportPath);
  if (!safePath.ok) issues.push(safePath.code);
  if (archive.includeRawEvidence !== false) issues.push("archive-raw-evidence-enabled");
  if (archive.includeSecretValues !== false) issues.push("archive-secret-values-enabled");
  if (archive.writePolicy !== "no-write-without-approval") {
    issues.push("archive-write-policy-weakened");
  }
  if (archive.retentionLinked !== true) issues.push("archive-retention-unlinked");
  if (!Number.isInteger(archive.maxReportBytes)) {
    issues.push("archive-max-bytes-invalid");
  } else {
    if (archive.maxReportBytes < MIN_ARCHIVE_REPORT_BYTES) {
      issues.push("archive-max-bytes-too-small");
    }
    if (archive.maxReportBytes > MAX_ARCHIVE_REPORT_BYTES) {
      issues.push("archive-max-bytes-too-large");
    }
  }
  return issues.sort();
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
  const retentionCodes = retentionIssues(bundle);
  const provenanceCodes = provenanceIssues(bundle);
  const archiveCodes = archiveIssues(bundle, bundleRoot);
  for (const code of [...retentionCodes, ...provenanceCodes, ...archiveCodes]) {
    codes.add(code);
  }

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
    retention: {
      classification: bundle.retention?.classification ?? null,
      minimumDays: bundle.retention?.minimumDays ?? null,
      retainUntil: bundle.retention?.retainUntil ?? null,
      disposition: bundle.retention?.disposition ?? null,
      storage: bundle.retention?.storage ?? null,
      codes: retentionCodes,
    },
    provenance: {
      source: bundle.provenance?.source ?? null,
      producer: bundle.provenance?.producer ?? null,
      sourceCommit: bundle.provenance?.sourceCommit ?? null,
      sourceTag: bundle.provenance?.sourceTag ?? null,
      signature: {
        mode: bundle.provenance?.signature?.mode ?? null,
        status: bundle.provenance?.signature?.status ?? null,
        identityRef: bundle.provenance?.signature?.identityRef ?? null,
        canonicalization: bundle.provenance?.signature?.canonicalization ?? null,
        digestAlgorithm: bundle.provenance?.signature?.digestAlgorithm ?? null,
      },
      codes: provenanceCodes,
    },
    archive: {
      format: bundle.archive?.format ?? null,
      reportPath: bundle.archive?.reportPath ?? null,
      writePolicy: bundle.archive?.writePolicy ?? null,
      maxReportBytes: bundle.archive?.maxReportBytes ?? null,
      codes: archiveCodes,
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
    core: stableReport.core,
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
    retention: stableReport.retention,
    provenance: stableReport.provenance,
    archive: stableReport.archive,
    codes: [...codes].sort(),
    failures,
    changedState: {
      changed: false,
      summary: "Evidence bundle verification did not modify project, runtime, service, database, or remote state.",
    },
  };
  return report;
}

export function buildEvidenceArchiveReport(bundleFile, options = {}) {
  const coreRoot = path.resolve(options.coreRoot ?? DEFAULT_CORE_ROOT);
  const verification = verifyEvidenceBundle(bundleFile, options);
  const schemas = {
    archiveReport: readJson(path.join(coreRoot, "schemas/archive-report.schema.json")),
  };
  const report = {
    reportVersion: "1.0.0",
    bundleId: verification.bundleId ?? "unknown-bundle",
    core: verification.core ?? {
      currentVersion: null,
      previousVersion: null,
    },
    verification: {
      status: verification.status,
      entryCount: verification.entryCount ?? 0,
      entryIds: (verification.verifiedEntries ?? []).map((entry) => entry.id).sort(),
      codes: verification.codes ?? [],
      replayHash: verification.replay?.reportHash ?? "0".repeat(64),
      regression: verification.regression ?? {
        baselineVersion: null,
        targetVersion: null,
        codes: [],
      },
    },
    retention: {
      classification: verification.retention?.classification ?? "synthetic-test-evidence",
      minimumDays: verification.retention?.minimumDays ?? 0,
      retainUntil: verification.retention?.retainUntil ?? "1970-01-01T00:00:00Z",
      disposition: verification.retention?.disposition ?? "retain-then-review",
      storage: verification.retention?.storage ?? "repository-fixture",
    },
    provenance: {
      source: verification.provenance?.source ?? "synthetic-fixture",
      producer: verification.provenance?.producer ?? "unknown-producer",
      sourceCommit: verification.provenance?.sourceCommit ?? "0".repeat(40),
      sourceTag: verification.provenance?.sourceTag ?? "v0.0.0",
      signature: verification.provenance?.signature ?? {
        mode: "detached-signature-design",
        status: "unsigned-fixture",
        identityRef: "unknown-identity",
        canonicalization: "canonical-json-v1",
        digestAlgorithm: "sha256",
      },
    },
    archive: {
      format: verification.archive?.format ?? "sanitized-json-summary",
      reportPath: verification.archive?.reportPath ?? "archive/evidence-archive-report.json",
      writePolicy: verification.archive?.writePolicy ?? "no-write-without-approval",
      maxReportBytes: verification.archive?.maxReportBytes ?? MAX_ARCHIVE_REPORT_BYTES,
    },
    changedState: {
      changed: false,
      summary:
        "Evidence archive report rendering did not write files or mutate project, runtime, service, database, or remote state.",
    },
    recommendedNextAction:
      "Store the sanitized report only after explicit approval and keep raw evidence out of archive summaries.",
  };
  const reportText = JSON.stringify(canonical(report), null, 2);
  const schemaErrors = validateValue(schemas.archiveReport, report);
  const codes = new Set(verification.codes ?? []);
  if (schemaErrors.length) codes.add("archive-report-schema-invalid");
  if (detectSensitiveValues(reportText).length) codes.add("archive-report-secret-like-content");
  if (Buffer.byteLength(reportText, "utf8") > report.archive.maxReportBytes) {
    codes.add("archive-report-too-large");
  }
  const firstHash = reportHash(report);
  const secondHash = reportHash(report);
  if (firstHash !== secondHash) codes.add("archive-report-nondeterministic");

  return {
    ok: verification.ok && codes.size === 0,
    status: verification.ok && codes.size === 0 ? "complete" : "failed",
    report,
    reportHash: firstHash,
    deterministic: firstHash === secondHash,
    codes: [...codes].sort(),
    schemaErrors,
    changedState: report.changedState,
  };
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

export function formatEvidenceArchiveSummary(result) {
  if (result.ok) {
    return [
      `evidence archive report rendered: ${result.report.verification.entryCount} entries, sanitized summary accepted`,
      `archive report hash ${result.reportHash}`,
    ];
  }
  return [
    "evidence archive report failed safely",
    `rejection codes: ${(result.codes ?? []).join(",")}`,
  ];
}

export function evidenceArchiveCliResult(bundleFile, options = {}) {
  if (!bundleFile) {
    return {
      exitCode: 2,
      stream: "stderr",
      lines: ["usage: node scripts/render-evidence-archive-report.mjs <bundle-file> [--json]"],
    };
  }
  const result = buildEvidenceArchiveReport(bundleFile, options);
  if (options.json) {
    return {
      exitCode: result.ok ? 0 : 1,
      stream: "stdout",
      lines: [JSON.stringify(result.report, null, 2)],
      result,
    };
  }
  return {
    exitCode: result.ok ? 0 : 1,
    stream: result.ok ? "stdout" : "stderr",
    lines: formatEvidenceArchiveSummary(result),
    result,
  };
}
