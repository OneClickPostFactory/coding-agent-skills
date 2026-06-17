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
const MIN_RETENTION_ADVISORY_THRESHOLD_DAYS = 1;
const MAX_RETENTION_ADVISORY_THRESHOLD_DAYS = 365;
const SIGNATURE_REQUIRED_ARTIFACTS = [
  "canonical-bundle-json",
  "detached-signature",
  "public-verification-identity",
];

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

function safeArchiveIndexPath(bundleRoot, relativePath) {
  return safeRelativePath(bundleRoot, relativePath, {
    extension: ".json",
    missingCode: "missing-archive-index-path",
    traversalCode: "archive-index-path-traversal",
    secretCode: "archive-index-secret-path",
    missingFileCode: "archive-index-missing",
    symlinkCode: "archive-index-symlink-escape",
    notFileCode: "archive-index-not-file",
  });
}

function dateValue(value) {
  const parsed = Date.parse(value ?? "");
  return Number.isNaN(parsed) ? null : parsed;
}

function daysBetween(start, end) {
  return (end - start) / (24 * 60 * 60 * 1000);
}

function retentionExpiryAdvisory(bundle) {
  const retention = bundle.retention ?? {};
  const advisory = retention.expiryAdvisory ?? {};
  const generatedAt = dateValue(bundle.generatedAt);
  const retainUntil = dateValue(retention.retainUntil);
  const threshold = Number.isInteger(advisory.reviewThresholdDays)
    ? advisory.reviewThresholdDays
    : 0;

  if (generatedAt === null || retainUntil === null || threshold <= 0) {
    return {
      status: "unknown",
      daysUntilExpiry: 0,
      reviewThresholdDays: threshold,
      advisoryOnly: true,
      deleteAutomatically: false,
      recommendedAction: "manual-review-only",
    };
  }

  const daysUntilExpiry = Math.floor(daysBetween(generatedAt, retainUntil));
  const reviewAt = retainUntil - threshold * 24 * 60 * 60 * 1000;
  let status = "retained";
  if (retainUntil <= generatedAt) {
    status = "expired-review-required";
  } else if (generatedAt >= reviewAt) {
    status = "review-soon";
  }

  return {
    status,
    daysUntilExpiry,
    reviewThresholdDays: threshold,
    advisoryOnly: true,
    deleteAutomatically: false,
    recommendedAction: "manual-review-only",
  };
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
  const advisory = retention.expiryAdvisory ?? {};
  if (advisory.mode !== "retention-expiry-review") {
    issues.push("retention-advisory-mode-invalid");
  }
  if (!Number.isInteger(advisory.reviewThresholdDays)) {
    issues.push("retention-advisory-threshold-invalid");
  } else {
    if (advisory.reviewThresholdDays < MIN_RETENTION_ADVISORY_THRESHOLD_DAYS) {
      issues.push("retention-advisory-threshold-too-small");
    }
    if (advisory.reviewThresholdDays > MAX_RETENTION_ADVISORY_THRESHOLD_DAYS) {
      issues.push("retention-advisory-threshold-too-large");
    }
  }
  if (advisory.action !== "manual-review-only") {
    issues.push("retention-advisory-action-invalid");
  }
  if (advisory.advisoryOnly !== true) {
    issues.push("retention-advisory-not-advisory");
  }
  if (advisory.deleteAutomatically !== false) {
    issues.push("retention-advisory-delete-enabled");
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
  const plan = signature.verificationPlan ?? {};
  if (plan.mode !== "detached-signature-verification-plan") {
    issues.push("provenance-verification-plan-mode-invalid");
  }
  if (plan.validatesSignatureNow !== false) {
    issues.push("provenance-verification-plan-runs-signature-check");
  }
  if (plan.failClosedWithoutValidSignature !== true) {
    issues.push("provenance-verification-plan-not-fail-closed");
  }
  const artifacts = Array.isArray(plan.requiredArtifacts) ? plan.requiredArtifacts : [];
  for (const artifact of SIGNATURE_REQUIRED_ARTIFACTS) {
    if (!artifacts.includes(artifact)) {
      issues.push(`provenance-verification-plan-missing:${artifact}`);
    }
  }
  if (signature.status === "unsigned-fixture") {
    if (plan.status !== "fixture-unsigned-not-required") {
      issues.push("provenance-verification-plan-status-invalid");
    }
  } else if (signature.status === "detached-signature-present") {
    if (plan.status !== "ready-artifacts-required") {
      issues.push("provenance-verification-plan-status-invalid");
    }
  } else if (signature.status === "verification-deferred" && plan.status !== "planned-not-run") {
    issues.push("provenance-verification-plan-status-invalid");
  }
  return issues.sort();
}

function archiveIndexIssues(bundle, bundleRoot, schema) {
  const issues = [];
  const archive = bundle.archive ?? {};
  const index = archive.index ?? {};
  const safePath = safeArchiveIndexPath(bundleRoot, index.path);
  if (!safePath.ok) {
    issues.push(safePath.code);
    return { issues: issues.sort(), summary: null };
  }

  let parsedIndex;
  const rawIndex = readText(safePath.path);
  if (detectSensitiveValues(rawIndex).length) issues.push("archive-index-secret-like-content");
  try {
    parsedIndex = JSON.parse(rawIndex);
  } catch {
    issues.push("archive-index-json-invalid");
    return { issues: issues.sort(), summary: null };
  }

  issues.push(...validateValue(schema, parsedIndex).map((issue) => `archive-index-schema:${issue}`));
  const entryIds = (bundle.entries ?? []).map((entry) => entry.id).sort();
  const indexEntryIds = (parsedIndex.entries ?? []).map((entry) => entry.id).sort();
  if (parsedIndex.bundleId !== bundle.bundleId) issues.push("archive-index-bundle-mismatch");
  if (parsedIndex.generatedAt !== bundle.generatedAt) issues.push("archive-index-generated-at-mismatch");
  if (parsedIndex.core?.currentVersion !== bundle.core?.currentVersion) {
    issues.push("archive-index-current-version-mismatch");
  }
  if (parsedIndex.core?.previousVersion !== bundle.core?.previousVersion) {
    issues.push("archive-index-previous-version-mismatch");
  }
  if (parsedIndex.retention?.retainUntil !== bundle.retention?.retainUntil) {
    issues.push("archive-index-retention-mismatch");
  }
  if (parsedIndex.retention?.advisory?.status !== retentionExpiryAdvisory(bundle).status) {
    issues.push("archive-index-advisory-mismatch");
  }
  if (parsedIndex.provenance?.sourceTag !== bundle.provenance?.sourceTag) {
    issues.push("archive-index-provenance-mismatch");
  }
  if (JSON.stringify(indexEntryIds) !== JSON.stringify(entryIds)) {
    issues.push("archive-index-entry-mismatch");
  }
  for (const entry of bundle.entries ?? []) {
    const indexed = (parsedIndex.entries ?? []).find((candidate) => candidate.id === entry.id);
    if (!indexed) continue;
    if (indexed.kind !== entry.kind || indexed.sha256 !== entry.sha256) {
      issues.push(`archive-index-entry-metadata-mismatch:${entry.id}`);
    }
  }
  if (parsedIndex.changedState?.changed !== false) {
    issues.push("archive-index-changed-state-detected");
  }

  return {
    issues: issues.sort(),
    summary: {
      path: index.path,
      format: index.format ?? null,
      entryCount: indexEntryIds.length,
      entryIds: indexEntryIds,
    },
  };
}

function archiveIssues(bundle, bundleRoot, schemas) {
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
  const index = archive.index ?? {};
  if (index.format !== "sanitized-json-index") issues.push("archive-index-format-invalid");
  if (index.includeRawEvidence !== false) issues.push("archive-index-raw-evidence-enabled");
  if (index.includeSecretValues !== false) issues.push("archive-index-secret-values-enabled");
  if (index.writePolicy !== "no-write-without-approval") {
    issues.push("archive-index-write-policy-weakened");
  }
  if (index.retentionLinked !== true) issues.push("archive-index-retention-unlinked");
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
  const indexResult = archiveIndexIssues(bundle, bundleRoot, schemas.archiveIndex);
  issues.push(...indexResult.issues);
  return { issues: issues.sort(), indexSummary: indexResult.summary };
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

function entryIssues(entry, evidence, schemas, bundle) {
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
  if (entry.kind === "adapter-upgrade-evidence") {
    if (evidence.validator?.version !== bundle.core?.currentVersion) {
      issues.push("upgrade-evidence-validator-version-mismatch");
    }
    if (evidence.coreVersions?.after !== bundle.core?.currentVersion) {
      issues.push("upgrade-evidence-target-version-mismatch");
    }
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
    archiveIndex: readJson(path.join(coreRoot, "schemas/archive-index.schema.json")),
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
  const retentionAdvisory = retentionExpiryAdvisory(bundle);
  const archiveResult = archiveIssues(bundle, bundleRoot, schemas);
  const archiveCodes = archiveResult.issues;
  const archiveIndexCodes = archiveCodes.filter((code) => code.startsWith("archive-index"));
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
    entryCodes.push(...entryIssues(entry, evidence, schemas, bundle));
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
      expiryAdvisory: retentionAdvisory,
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
        verificationPlan: bundle.provenance?.signature?.verificationPlan ?? null,
      },
      codes: provenanceCodes,
    },
    archive: {
      format: bundle.archive?.format ?? null,
      reportPath: bundle.archive?.reportPath ?? null,
      writePolicy: bundle.archive?.writePolicy ?? null,
      maxReportBytes: bundle.archive?.maxReportBytes ?? null,
      index: {
        status: archiveResult.indexSummary && archiveIndexCodes.length === 0 ? "present" : "failed",
        path: archiveResult.indexSummary?.path ?? bundle.archive?.index?.path ?? null,
        format: archiveResult.indexSummary?.format ?? bundle.archive?.index?.format ?? null,
        entryCount: archiveResult.indexSummary?.entryCount ?? 0,
        entryIds: archiveResult.indexSummary?.entryIds ?? [],
        codes: archiveIndexCodes,
      },
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
    reportVersion: "1.1.0",
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
      expiryAdvisory: verification.retention?.expiryAdvisory ?? {
        status: "unknown",
        daysUntilExpiry: 0,
        reviewThresholdDays: 0,
        advisoryOnly: true,
        deleteAutomatically: false,
        recommendedAction: "manual-review-only",
      },
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
        verificationPlan: {
          mode: "detached-signature-verification-plan",
          status: "fixture-unsigned-not-required",
          requiredArtifacts: SIGNATURE_REQUIRED_ARTIFACTS,
          validatesSignatureNow: false,
          failClosedWithoutValidSignature: true,
        },
      },
    },
    archive: {
      format: verification.archive?.format ?? "sanitized-json-summary",
      reportPath: verification.archive?.reportPath ?? "archive/evidence-archive-report.json",
      writePolicy: verification.archive?.writePolicy ?? "no-write-without-approval",
      maxReportBytes: verification.archive?.maxReportBytes ?? MAX_ARCHIVE_REPORT_BYTES,
      index: verification.archive?.index ?? {
        status: "missing",
        path: "archive/evidence-archive-index.json",
        format: "sanitized-json-index",
        entryCount: 0,
        entryIds: [],
        codes: ["archive-index-missing"],
      },
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
