import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateExternalAdapters } from "./adapter-discovery.mjs";
import {
  PILOT_SKILLS,
  PILOT_VERSION,
  PREVIOUS_PILOT_VERSION,
} from "./pack-rules.mjs";
import {
  readProjectAdapterDeclaration,
  validateProjectAdapters,
} from "./project-adapter-installation.mjs";
import {
  compareSemver,
  parseSemver,
  parseVersionPin,
  satisfiesVersionPin,
} from "./semver.mjs";
import { writeSafeEvidenceJson } from "./safe-evidence-output.mjs";
import { buildAdapterUpgradeEvidence } from "./upgrade-evidence.mjs";

const DEFAULT_CORE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

function previousPatch(version) {
  const parsed = parseSemver(version);
  if (!parsed || parsed[2] === 0) return null;
  return `${parsed[0]}.${parsed[1]}.${parsed[2] - 1}`;
}

function previousSupportedVersion(version) {
  return version === PILOT_VERSION ? PREVIOUS_PILOT_VERSION : previousPatch(version);
}

function pinKind(pin) {
  const parsed = parseVersionPin(pin);
  return parsed?.length === 1 && parsed[0].operator === "=" ? "exact" : "range";
}

function mappedValidationCode(code) {
  if (code === "secret-like-content" || code === "secret-exposure") {
    return "secret-exposure";
  }
  if (code === "mode-override") return "mode-escalation";
  if (
    [
      "restriction-weakening",
      "restriction-removal",
      "missing-shared-inheritance",
    ].includes(code)
  ) {
    return "restriction-weakening";
  }
  if (code === "failure-suppression") return "failure-suppression";
  if (code === "completion-override") return "completion-override";
  if (code === "required-evidence-removal") return "required-evidence-removal";
  if (code === "incompatible-skill-version") return "skill-compatibility-drift";
  if (code === "unsupported-skill-id") return "unknown-skill-compatibility";
  if (
    [
      "root-path-traversal",
      "unsafe-project-path",
      "unsafe-path",
      "path-escape",
      "symlink-escape",
    ].includes(code)
  ) {
    return "path-traversal";
  }
  if (code === "scope-expansion") return "scope-expansion";
  return null;
}

function versionOrCurrent(loaded) {
  const declared = loaded.declaration?.core?.expectedVersion;
  return parseSemver(declared) ? declared : PILOT_VERSION;
}

function revisionState(projectRoot, coreRoot) {
  const loaded = readProjectAdapterDeclaration(projectRoot);
  if (!loaded.ok) {
    return {
      ok: false,
      loaded,
      validation: null,
      discovery: null,
      codes: loaded.codes,
    };
  }

  const coreVersion = versionOrCurrent(loaded);
  const validation = validateProjectAdapters(projectRoot, {
    coreRoot,
    coreVersion,
  });
  const discovery = validateExternalAdapters(projectRoot, {
    coreRoot,
    coreVersion,
  });
  return {
    ok: validation.ok,
    loaded,
    validation,
    discovery,
    codes: validation.codes,
  };
}

function addValidationCodes(codes, state, revision) {
  if (!state.loaded.ok) {
    codes.add(`${revision}-project-invalid`);
    for (const code of state.codes) {
      codes.add(mappedValidationCode(code) ?? `${revision}-${code}`);
    }
    return;
  }

  const declaration = state.loaded.declaration;
  if (declaration.adapterSchemaVersion !== "1.0.0") {
    codes.add("adapter-schema-drift");
  }
  for (const code of state.codes) {
    if (
      [
        "unsupported-core-version",
        "core-pin-mismatch",
        "expected-version-outside-pin",
      ].includes(code)
    ) {
      continue;
    }
    if (code === "unsupported-adapter-version") {
      codes.add("adapter-version-drift");
      continue;
    }
    codes.add(mappedValidationCode(code) ?? `${revision}-project-invalid`);
  }
}

function addCoreVersionCodes(codes, before, after, targetVersion) {
  const previous = previousSupportedVersion(targetVersion);
  const beforeVersion = before.loaded.declaration?.core?.expectedVersion;
  const afterVersion = after.loaded.declaration?.core?.expectedVersion;
  const beforePin = before.loaded.declaration?.core?.versionPin;
  const afterPin = after.loaded.declaration?.core?.versionPin;

  if (!parseSemver(beforeVersion) || !parseVersionPin(beforePin)) {
    codes.add("before-invalid-core-version");
  }
  if (!parseSemver(afterVersion) || !parseVersionPin(afterPin)) {
    codes.add("after-invalid-core-version");
    return;
  }

  if (parseSemver(beforeVersion)) {
    if (compareSemver(beforeVersion, targetVersion) > 0) {
      codes.add("unsupported-future-core");
    } else if (previous && compareSemver(beforeVersion, previous) < 0) {
      codes.add("unsupported-old-core");
    }
  }

  const afterComparison = compareSemver(afterVersion, targetVersion);
  if (afterComparison > 0) {
    codes.add("unsupported-future-core");
  } else if (
    afterComparison < 0 ||
    !satisfiesVersionPin(targetVersion, afterPin)
  ) {
    codes.add(
      pinKind(afterPin) === "exact"
        ? "stale-exact-pin"
        : "stale-compatible-range",
    );
  }
}

function byAdapterId(discovery) {
  return new Map(
    (discovery?.accepted ?? []).map((adapter) => [adapter.adapterId, adapter]),
  );
}

function bySkillId(adapter) {
  return new Map(
    (adapter.skillCompatibility ?? []).map((skill) => [skill.id, skill]),
  );
}

function missingValues(before, after) {
  const afterSet = new Set(after);
  return before.filter((value) => !afterSet.has(value));
}

function addAdapterComparisonCodes(
  codes,
  before,
  after,
  targetVersion,
  requireTargetCompatibility,
) {
  const beforeAdapters = byAdapterId(before.discovery);
  const afterAdapters = byAdapterId(after.discovery);

  if (
    JSON.stringify([...beforeAdapters.keys()].sort()) !==
    JSON.stringify([...afterAdapters.keys()].sort())
  ) {
    codes.add("adapter-set-drift");
  }

  for (const [adapterId, beforeAdapter] of beforeAdapters) {
    const afterAdapter = afterAdapters.get(adapterId);
    if (!afterAdapter) continue;

    const versionComparison = compareSemver(
      afterAdapter.adapterVersion,
      beforeAdapter.adapterVersion,
    );
    if (versionComparison === null) codes.add("adapter-version-drift");
    if (versionComparison < 0) codes.add("adapter-version-downgrade");

    if (
      missingValues(
        beforeAdapter.deniedOperationCategories,
        afterAdapter.deniedOperationCategories,
      ).length
    ) {
      codes.add("restriction-weakening");
    }
    if (
      missingValues(
        beforeAdapter.requiredEvidence,
        afterAdapter.requiredEvidence,
      ).length
    ) {
      codes.add("required-evidence-removal");
    }

    const beforeSkills = bySkillId(beforeAdapter);
    const afterSkills = bySkillId(afterAdapter);
    if (
      JSON.stringify([...beforeSkills.keys()].sort()) !==
      JSON.stringify([...afterSkills.keys()].sort())
    ) {
      codes.add("skill-compatibility-drift");
    }

    for (const [skillId, beforeSkill] of beforeSkills) {
      const afterSkill = afterSkills.get(skillId);
      if (!afterSkill) continue;
      if (!PILOT_SKILLS.includes(skillId)) codes.add("unknown-skill-compatibility");
      if (beforeSkill.declaredMode !== afterSkill.declaredMode) {
        codes.add("mode-escalation");
      }
      if (
        requireTargetCompatibility &&
        !afterSkill.compatibleVersions.some(
          (version) =>
            version === targetVersion ||
            version === `${targetVersion.split(".").slice(0, 2).join(".")}.x`,
        )
      ) {
        codes.add("skill-compatibility-drift");
      }
    }
  }
}

function safeRevisionContext(state, label) {
  const declaration = state.loaded.declaration;
  const discoveredById = byAdapterId(state.discovery);
  const declaredAdapters = Array.isArray(declaration?.adapters)
    ? declaration.adapters
    : [];

  return {
    rootSummary: {
      reference: label,
      declarationStatus: state.loaded.ok ? "present" : "unavailable",
      validationStatus: state.ok ? "pass" : "fail",
    },
    coreVersion: declaration?.core?.expectedVersion ?? null,
    versionPin: declaration?.core?.versionPin ?? null,
    adapterSchemaVersion: declaration?.adapterSchemaVersion ?? null,
    adapters: declaredAdapters
      .map((adapter) => {
        const discovered = discoveredById.get(adapter.id);
        return {
          id: adapter.id,
          version: adapter.version,
          skillIds: [...(adapter.skillIds ?? [])].sort(),
          skillCompatibility: discovered?.skillCompatibility ?? [],
          approvalRequirements: discovered?.approvalRequirements ?? [],
        };
      })
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function checkAdapterUpgrade(beforeProjectRoot, afterProjectRoot, options = {}) {
  if (!beforeProjectRoot || !afterProjectRoot) {
    return {
      ok: false,
      status: "failed",
      comparedAdapters: 0,
      comparedSkills: 0,
      codes: ["missing-project-revision"],
    };
  }

  const coreRoot = path.resolve(options.coreRoot ?? DEFAULT_CORE_ROOT);
  const targetVersion = options.targetCoreVersion ?? PILOT_VERSION;
  if (!parseSemver(targetVersion)) {
    return {
      ok: false,
      status: "failed",
      comparedAdapters: 0,
      comparedSkills: 0,
      codes: ["invalid-target-core-version"],
    };
  }
  const before = revisionState(beforeProjectRoot, coreRoot);
  const after = revisionState(afterProjectRoot, coreRoot);
  const codes = new Set();

  addValidationCodes(codes, before, "before");
  addValidationCodes(codes, after, "after");
  if (before.loaded.ok && after.loaded.ok) {
    if (before.loaded.declaration.projectId !== after.loaded.declaration.projectId) {
      codes.add("project-id-drift");
    }
    addCoreVersionCodes(codes, before, after, targetVersion);
    addAdapterComparisonCodes(
      codes,
      before,
      after,
      targetVersion,
      after.loaded.declaration.core?.expectedVersion === targetVersion,
    );
  }

  const beforeAdapters = byAdapterId(before.discovery);
  const afterAdapters = byAdapterId(after.discovery);
  const sharedAdapters = [...beforeAdapters.keys()].filter((adapterId) =>
    afterAdapters.has(adapterId),
  );
  const sharedSkills = new Set();
  for (const adapterId of sharedAdapters) {
    const beforeSkills = new Set(beforeAdapters.get(adapterId).skills);
    for (const skill of afterAdapters.get(adapterId).skills) {
      if (beforeSkills.has(skill)) sharedSkills.add(skill);
    }
  }

  return {
    ok: codes.size === 0,
    status: codes.size === 0 ? "complete" : "failed",
    comparedAdapters: sharedAdapters.length,
    comparedSkills: sharedSkills.size,
    codes: [...codes].sort(),
    targetCoreVersion: targetVersion,
    context: {
      before: safeRevisionContext(before, "before"),
      after: safeRevisionContext(after, "after"),
    },
  };
}

export function formatAdapterUpgradeSummary(result) {
  if (result.ok) {
    return [
      `adapter upgrade check complete: ${result.comparedAdapters} adapters, ` +
        `${result.comparedSkills} skills, target core accepted`,
    ];
  }
  return [
    `adapter upgrade check failed: ${result.comparedAdapters} adapters compared`,
    `rejection codes: ${result.codes.join(",")}`,
  ];
}

export function adapterUpgradeCliResult(beforeRoot, afterRoot, options = {}) {
  if (!beforeRoot || !afterRoot) {
    return {
      exitCode: 2,
      stream: "stderr",
      lines: [
        "usage: node scripts/check-adapter-upgrade.mjs " +
          "<before-project-root> <after-project-root>",
      ],
    };
  }

  const result = checkAdapterUpgrade(beforeRoot, afterRoot, options);
  const evidence = buildAdapterUpgradeEvidence(result, options);
  if (options.output) {
    const written = writeSafeEvidenceJson(options.output, evidence, {
      baseDirectory: options.outputBase,
    });
    if (!written.ok) {
      return {
        exitCode: 2,
        stream: "stderr",
        lines: [`adapter upgrade evidence output failed: ${written.code}`],
        result,
        evidence,
      };
    }
  }
  if (options.json) {
    return {
      exitCode: result.ok ? 0 : 1,
      stream: "stdout",
      lines: [JSON.stringify(evidence, null, 2)],
      result,
      evidence,
    };
  }
  return {
    exitCode: result.ok ? 0 : 1,
    stream: result.ok ? "stdout" : "stderr",
    lines: [
      ...formatAdapterUpgradeSummary(result),
      ...(options.output ? ["sanitized evidence output written"] : []),
    ],
    result,
    evidence,
  };
}
