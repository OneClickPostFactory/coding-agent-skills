import { randomUUID } from "node:crypto";

import { PILOT_VERSION } from "./pack-rules.mjs";

export const UPGRADE_EVIDENCE_CONTRACT_VERSION = "1.0.0";

const SUMMARY_BY_CODE = {
  "adapter-schema-drift": "The adapter schema changed outside the supported contract.",
  "adapter-set-drift": "The installed adapter set changed across revisions.",
  "adapter-version-downgrade": "An adapter version moved backward.",
  "adapter-version-drift": "An adapter version is incompatible or inconsistent.",
  "after-project-invalid": "The proposed project revision did not validate.",
  "before-project-invalid": "The source project revision did not validate.",
  "chain-target-stale": "The final chain revision does not target the running core.",
  "completion-override": "The revision attempted to redefine completion.",
  "failure-suppression": "The revision attempted to suppress failures.",
  "incompatible-core-chain": "Core versions do not form an adjacent compatible chain.",
  "mode-escalation": "An audit-only skill was escalated.",
  "path-traversal": "A revision or output path escaped its allowed boundary.",
  "required-evidence-removal": "Required evidence was removed.",
  "restriction-weakening": "Inherited restrictions were weakened.",
  "scope-expansion": "Scope expanded without the required approval boundary.",
  "secret-exposure": "Secret-like content was detected and withheld.",
  "skill-compatibility-drift": "Skill compatibility changed incompatibly.",
  "stale-compatible-range": "The compatible range does not represent the target core.",
  "stale-exact-pin": "The exact core pin is stale.",
  "unknown-skill-compatibility": "An unknown skill compatibility declaration was found.",
  "unsupported-future-core": "A revision targets a core newer than the validator.",
  "unsupported-old-core": "A revision is older than the supported upgrade source.",
};

function summaryForCode(code) {
  return SUMMARY_BY_CODE[code] ?? "The validator reported an incompatible upgrade condition.";
}

function unique(values) {
  return [...new Set(values)].sort();
}

function adapters(context) {
  return context?.adapters ?? [];
}

function adapterIds(before, after) {
  return unique([
    ...adapters(before).map((adapter) => adapter.id),
    ...adapters(after).map((adapter) => adapter.id),
  ]);
}

function versions(context) {
  return adapters(context).map((adapter) => ({
    adapterId: adapter.id,
    version: adapter.version,
  }));
}

function skillIds(context) {
  return unique(adapters(context).flatMap((adapter) => adapter.skillIds));
}

function compatibility(context) {
  return adapters(context)
    .flatMap((adapter) =>
      adapter.skillCompatibility.map((skill) => ({
        adapterId: adapter.id,
        skillId: skill.id,
        versions: [...skill.compatibleVersions],
        mode: skill.declaredMode,
      })),
    )
    .sort(
      (left, right) =>
        left.adapterId.localeCompare(right.adapterId) ||
        left.skillId.localeCompare(right.skillId),
    );
}

function approvals(before, after) {
  return unique(
    [...adapters(before), ...adapters(after)].flatMap(
      (adapter) => adapter.approvalRequirements,
    ),
  );
}

function staleClassification(codes) {
  if (codes.includes("stale-exact-pin")) return "stale-exact-pin";
  if (codes.includes("stale-compatible-range")) return "stale-compatible-range";
  if (codes.includes("chain-target-stale")) return "chain-target-stale";
  return "none";
}

function pinResult(codes, before, after) {
  if (!before?.versionPin || !after?.versionPin) return "unknown";
  if (staleClassification(codes) !== "none") return "stale";
  if (
    codes.some((code) =>
      [
        "before-invalid-core-version",
        "after-invalid-core-version",
        "unsupported-old-core",
        "unsupported-future-core",
        "incompatible-core-chain",
      ].includes(code),
    )
  ) {
    return "invalid";
  }
  return "accepted";
}

function resultStatus(codes) {
  return codes.length === 0 ? "pass" : "fail";
}

function restrictionCodes(codes) {
  return codes.filter((code) =>
    [
      "restriction-weakening",
      "mode-escalation",
      "failure-suppression",
      "completion-override",
      "required-evidence-removal",
      "secret-exposure",
      "scope-expansion",
    ].includes(code),
  );
}

function evidenceBase(result, options) {
  const before = result.context?.before ?? {
    rootSummary: {
      reference: "before",
      declarationStatus: "unavailable",
      validationStatus: "fail",
    },
    coreVersion: null,
    versionPin: null,
    adapterSchemaVersion: null,
    adapters: [],
  };
  const after = result.context?.after ?? {
    rootSummary: {
      reference: "after",
      declarationStatus: "unavailable",
      validationStatus: "fail",
    },
    coreVersion: null,
    versionPin: null,
    adapterSchemaVersion: null,
    adapters: [],
  };
  const codes = unique(result.codes ?? []);
  const restrictions = restrictionCodes(codes);
  const approvalRequirements = approvals(before, after);
  const finalStatus = result.ok
    ? approvalRequirements.length > 0
      ? "warn"
      : "pass"
    : "fail";
  const blockingFailures = codes.map((code) => ({
    code,
    summary: summaryForCode(code),
  }));

  return {
    contractVersion: UPGRADE_EVIDENCE_CONTRACT_VERSION,
    validator: {
      name: options.validatorName,
      version: PILOT_VERSION,
    },
    invocation: {
      id: options.invocationId ?? `upgrade-${randomUUID()}`,
      timestamp: options.timestamp ?? new Date().toISOString(),
    },
    beforeProject: before.rootSummary,
    afterProject: after.rootSummary,
    coreVersions: {
      before: before.coreVersion,
      after: after.coreVersion,
    },
    adapterIds: adapterIds(before, after),
    adapterVersions: {
      before: versions(before),
      after: versions(after),
    },
    adapterSchemaVersions: {
      before: before.adapterSchemaVersion,
      after: after.adapterSchemaVersion,
    },
    supportedSkillIds: {
      before: skillIds(before),
      after: skillIds(after),
    },
    skillCompatibility: {
      before: compatibility(before),
      after: compatibility(after),
    },
    pinStatus: {
      before: before.versionPin,
      after: after.versionPin,
      result: pinResult(codes, before, after),
      staleClassification: staleClassification(codes),
    },
    compatibilityResult: {
      result: resultStatus(codes),
      codes,
    },
    restrictionInheritanceResult: {
      result: resultStatus(restrictions),
      codes: restrictions,
    },
    approvalRequirements,
    detectedRisks: blockingFailures,
    blockingFailures,
    warnings: approvalRequirements.map((operation) => ({
      code: "approval-required",
      summary: `Named approval remains required for ${operation}.`,
    })),
    safeSummary: result.ok
      ? approvalRequirements.length > 0
        ? "The read-only compatibility check passed with named approvals still required."
        : "The read-only compatibility check passed without applying changes."
      : `The read-only compatibility check rejected ${codes.length} condition(s).`,
    finalStatus,
    confidence: {
      level: result.context ? "high" : "low",
      reason: result.context
        ? "Both sanitized revision summaries and compatibility results were available."
        : "One or more revision summaries were unavailable.",
    },
    changedState: {
      changed: false,
      summary:
        "No project, adapter, Git, runtime, service, database, or remote state was changed.",
    },
    recommendedNextAction: result.ok
      ? "Request human approval before adopting this upgrade in a real project."
      : "Resolve every blocking failure and rerun the read-only validation.",
  };
}

export function buildAdapterUpgradeEvidence(result, options = {}) {
  const evidence = evidenceBase(result, {
    ...options,
    validatorName: "check-adapter-upgrade",
  });
  if (options.chainId) evidence.chainId = options.chainId;
  if (Number.isInteger(options.chainStepIndex)) {
    evidence.chainStepIndex = options.chainStepIndex;
  }
  return evidence;
}

export function buildAdapterChainEvidence(result, options = {}) {
  const evidence = evidenceBase(result, {
    ...options,
    validatorName: "check-adapter-upgrade-chain",
  });
  evidence.chainId = options.chainId ?? `chain-${randomUUID()}`;
  evidence.chainSummary = {
    revisionCount: result.revisionCount,
    transitionCount: result.transitionCount,
    passedTransitions: result.passedTransitions,
    failedTransitions: result.failedTransitions,
    steps: result.transitions.map((transition) => ({
      stepIndex: transition.stepIndex,
      beforeRevision: `revision-${transition.stepIndex}`,
      afterRevision: `revision-${transition.stepIndex + 1}`,
      status: transition.ok ? "pass" : "fail",
      codes: [...transition.codes],
    })),
  };
  return evidence;
}
