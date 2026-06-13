import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  adapterIssues,
  detectSensitiveValues,
  PILOT_SKILLS,
} from "./pack-rules.mjs";
import { validateValue } from "./schema-validator.mjs";

export const ADAPTER_MANIFEST_FILENAME = "adapter.json";
export const ADAPTER_SCHEMA_VERSION = "1.0.0";
export const EXTERNAL_ADAPTER_LOCATIONS = [
  ".coding-agent/adapters",
  "coding-agent/adapters",
  "adapters/coding-agent",
];

const DEFAULT_CORE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const MAX_MANIFEST_BYTES = 256 * 1024;

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function publicIssueCode(issue) {
  if (/unsupported adapterVersion/i.test(issue)) return "unsupported-adapter-version";
  if (/unknown pilot skill/i.test(issue)) return "unsupported-skill-id";
  if (/override .* mode/i.test(issue)) return "mode-override";
  if (/incompatible with/i.test(issue)) return "incompatible-skill-version";
  if (/unsafe adapter path/i.test(issue)) return "unsafe-path";
  if (/weakens required restriction/i.test(issue)) return "restriction-weakening";
  if (/inherit shared restrictions/i.test(issue)) return "missing-shared-inheritance";
  if (/remove shared restrictions/i.test(issue)) return "restriction-removal";
  if (/suppress failures/i.test(issue)) return "failure-suppression";
  if (/redefine completion/i.test(issue)) return "completion-override";
  if (/expose secrets/i.test(issue)) return "secret-exposure";
  if (/remove required evidence/i.test(issue)) return "required-evidence-removal";
  if (/expand scope/i.test(issue)) return "scope-expansion";
  if (/unsafe command alias/i.test(issue)) return "unsafe-command-alias";
  if (/command alias .* declares/i.test(issue)) return "command-family-mismatch";
  if (/unsafe status command|not status-only/i.test(issue)) {
    return "unsafe-status-command";
  }
  if (/status commands require runtime-truth/i.test(issue)) {
    return "runtime-status-incompatible";
  }
  if (/required evidence/i.test(issue)) return "required-evidence";
  return "semantic-validation";
}

function schemaIssueCodes(errors) {
  const codes = new Set();
  for (const error of errors) {
    codes.add("schema-validation");
    if (/adapterVersion/.test(error)) codes.add("unsupported-adapter-version");
    if (/supportedSkills.*id/.test(error)) codes.add("unsupported-skill-id");
    if (/declaredMode/.test(error)) codes.add("mode-override");
    if (/safeReadPaths|ignoredPaths|documentationPrecedence|rootMarkers/.test(error)) {
      codes.add("unsafe-path");
    }
    if (/deniedOperationCategories/.test(error)) codes.add("restriction-weakening");
    if (/allowRestrictionRemoval/.test(error)) codes.add("restriction-removal");
    if (/allowFailureSuppression/.test(error)) codes.add("failure-suppression");
    if (/allowCompletionOverride/.test(error)) codes.add("completion-override");
    if (/allowSecretExposure/.test(error)) codes.add("secret-exposure");
    if (/allowRequiredEvidenceRemoval|requiredEvidence/.test(error)) {
      codes.add("required-evidence-removal");
    }
    if (/allowScopeExpansionWithoutApproval|requireApprovalOutsideScope/.test(error)) {
      codes.add("scope-expansion");
    }
  }
  return [...codes];
}

function readJsonFile(file, options = {}) {
  const stat = fs.statSync(file);
  if (stat.size > MAX_MANIFEST_BYTES) {
    return { value: null, codes: ["manifest-too-large"] };
  }

  const raw = fs.readFileSync(file, "utf8");
  if (options.scanSensitive !== false && detectSensitiveValues(raw).length > 0) {
    return { value: null, codes: ["secret-like-content"] };
  }

  try {
    return { value: JSON.parse(raw), codes: [] };
  } catch {
    return { value: null, codes: ["malformed-json"] };
  }
}

function loadCore(coreRoot) {
  if (!fs.existsSync(coreRoot) || !fs.lstatSync(coreRoot).isDirectory()) {
    return { error: ["core-root-unavailable"] };
  }

  for (const relative of [
    "schemas/project-adapter.schema.json",
    ...PILOT_SKILLS.flatMap((skill) => [
      `examples/manifests/${skill}.json`,
      `examples/command-policies/${skill}.json`,
    ]),
  ]) {
    if (!fs.existsSync(path.join(coreRoot, relative))) {
      return { error: ["core-skill-metadata-unavailable"] };
    }
  }

  const schemaRecord = readJsonFile(
    path.join(coreRoot, "schemas", "project-adapter.schema.json"),
    { scanSensitive: false },
  );
  if (!schemaRecord.value) {
    return { error: ["core-schema-unavailable"] };
  }

  const manifests = {};
  const policies = {};
  for (const skill of PILOT_SKILLS) {
    const manifestRecord = readJsonFile(
      path.join(coreRoot, "examples", "manifests", `${skill}.json`),
      { scanSensitive: false },
    );
    const policyRecord = readJsonFile(
      path.join(coreRoot, "examples", "command-policies", `${skill}.json`),
      { scanSensitive: false },
    );
    if (!manifestRecord.value || !policyRecord.value) {
      return { error: ["core-skill-metadata-unavailable"] };
    }
    manifests[skill] = manifestRecord.value;
    policies[skill] = policyRecord.value;
  }

  return {
    schema: schemaRecord.value,
    manifests,
    policies,
    error: [],
  };
}

function inspectPath(root, candidate) {
  if (!inside(root, candidate)) return ["path-escape"];

  const relative = path.relative(root, candidate);
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) break;
    if (fs.lstatSync(current).isSymbolicLink()) return ["symlink-escape"];
  }
  return [];
}

function discover(adapterRoot) {
  const failures = [];
  const manifests = [];

  for (const location of EXTERNAL_ADAPTER_LOCATIONS) {
    const container = path.resolve(adapterRoot, location);
    const pathIssues = inspectPath(adapterRoot, container);
    if (pathIssues.length) {
      failures.push({ location, codes: pathIssues });
      continue;
    }
    if (!fs.existsSync(container)) continue;

    const containerStat = fs.lstatSync(container);
    if (!containerStat.isDirectory()) {
      failures.push({ location, codes: ["adapter-container-not-directory"] });
      continue;
    }

    for (const entry of fs.readdirSync(container, { withFileTypes: true })) {
      const adapterDirectory = path.join(container, entry.name);
      const publicLocation = `${location}/<adapter>/${ADAPTER_MANIFEST_FILENAME}`;
      if (entry.isSymbolicLink()) {
        failures.push({ location: publicLocation, codes: ["symlink-escape"] });
        continue;
      }
      if (!entry.isDirectory()) {
        failures.push({
          location: `${location}/<entry>`,
          codes: ["unexpected-adapter-entry"],
        });
        continue;
      }

      const manifest = path.join(adapterDirectory, ADAPTER_MANIFEST_FILENAME);
      const manifestIssues = inspectPath(adapterRoot, manifest);
      if (manifestIssues.length) {
        failures.push({ location: publicLocation, codes: manifestIssues });
        continue;
      }
      if (!fs.existsSync(manifest)) {
        failures.push({ location: publicLocation, codes: ["missing-adapter-manifest"] });
        continue;
      }

      const manifestStat = fs.lstatSync(manifest);
      if (manifestStat.isSymbolicLink()) {
        failures.push({ location: publicLocation, codes: ["symlink-escape"] });
        continue;
      }
      if (!manifestStat.isFile()) {
        failures.push({ location: publicLocation, codes: ["manifest-not-regular-file"] });
        continue;
      }

      const realManifest = fs.realpathSync(manifest);
      if (!inside(adapterRoot, realManifest)) {
        failures.push({ location: publicLocation, codes: ["symlink-escape"] });
        continue;
      }
      manifests.push({ file: manifest, location: publicLocation });
    }
  }

  return { manifests, failures };
}

function validateCompatibility(adapter, manifests) {
  const codes = [];
  if (adapter.adapterVersion !== ADAPTER_SCHEMA_VERSION) {
    codes.push("unsupported-adapter-version");
  }
  for (const skill of adapter.supportedSkills ?? []) {
    const manifest = manifests[skill.id];
    if (!manifest) {
      codes.push("unsupported-skill-id");
      continue;
    }
    if (manifest.mode !== skill.declaredMode) codes.push("mode-override");
    if (
      !manifest.adapterCompatibility?.compatibleAdapterVersions?.includes(
        adapter.adapterVersion,
      )
    ) {
      codes.push("unsupported-adapter-version");
    }
  }
  return codes;
}

export function validateExternalAdapters(adapterRootInput, options = {}) {
  const input = String(adapterRootInput ?? "");
  if (!input.trim()) {
    return {
      ok: false,
      status: "failed",
      discovered: 0,
      accepted: [],
      rejected: [],
      failures: [{ location: "<root>", codes: ["missing-adapter-root"] }],
    };
  }
  if (input.split(/[\\/]+/).includes("..")) {
    return {
      ok: false,
      status: "failed",
      discovered: 0,
      accepted: [],
      rejected: [],
      failures: [{ location: "<root>", codes: ["root-path-traversal"] }],
    };
  }

  const adapterRoot = path.resolve(input);
  if (!fs.existsSync(adapterRoot)) {
    return {
      ok: false,
      status: "failed",
      discovered: 0,
      accepted: [],
      rejected: [],
      failures: [{ location: "<root>", codes: ["adapter-root-not-found"] }],
    };
  }
  if (fs.lstatSync(adapterRoot).isSymbolicLink()) {
    return {
      ok: false,
      status: "failed",
      discovered: 0,
      accepted: [],
      rejected: [],
      failures: [{ location: "<root>", codes: ["symlink-escape"] }],
    };
  }
  if (!fs.lstatSync(adapterRoot).isDirectory()) {
    return {
      ok: false,
      status: "failed",
      discovered: 0,
      accepted: [],
      rejected: [],
      failures: [{ location: "<root>", codes: ["adapter-root-not-directory"] }],
    };
  }

  const realRoot = fs.realpathSync(adapterRoot);
  const core = loadCore(path.resolve(options.coreRoot ?? DEFAULT_CORE_ROOT));
  if (core.error.length) {
    return {
      ok: false,
      status: "failed",
      discovered: 0,
      accepted: [],
      rejected: [],
      failures: [{ location: "<core>", codes: core.error }],
    };
  }

  const discovery = discover(realRoot);
  const accepted = [];
  const rejected = [];

  for (const candidate of discovery.manifests) {
    const record = readJsonFile(candidate.file);
    if (!record.value) {
      rejected.push({ location: candidate.location, codes: record.codes });
      continue;
    }

    const schemaErrors = validateValue(core.schema, record.value);
    const semanticErrors = adapterIssues(record.value, { policies: core.policies });
    const codes = new Set([
      ...schemaIssueCodes(schemaErrors),
      ...semanticErrors.map(publicIssueCode),
      ...validateCompatibility(record.value, core.manifests),
    ]);

    if (codes.size > 0) {
      rejected.push({ location: candidate.location, codes: [...codes].sort() });
      continue;
    }

    accepted.push({
      location: candidate.location,
      skills: record.value.supportedSkills.map((skill) => skill.id).sort(),
    });
  }

  const failures = discovery.failures;
  const discovered = discovery.manifests.length + failures.length;
  const ok = rejected.length === 0 && failures.length === 0;
  return {
    ok,
    status: ok ? (discovered === 0 ? "empty" : "complete") : "failed",
    discovered,
    accepted,
    rejected,
    failures,
  };
}

export function formatExternalAdapterSummary(result) {
  if (result.status === "empty") {
    return ["external adapter validation complete: 0 adapters discovered"];
  }

  const rejectedCount = result.rejected.length + result.failures.length;
  const lines = [
    `external adapter validation ${result.ok ? "complete" : "failed"}: ` +
      `${result.accepted.length} accepted, ${rejectedCount} rejected`,
  ];

  for (const [index, accepted] of result.accepted.entries()) {
    lines.push(`accepted adapter ${index + 1}: skills=${accepted.skills.join(",")}`);
  }
  for (const [index, rejected] of [
    ...result.rejected,
    ...result.failures,
  ].entries()) {
    lines.push(`rejected adapter ${index + 1}: ${[...new Set(rejected.codes)].join(",")}`);
  }

  return lines;
}

export function externalAdapterCliResult(adapterRoot, options = {}) {
  if (!adapterRoot) {
    return {
      exitCode: 2,
      stream: "stderr",
      lines: ["usage: node scripts/validate-adapters.mjs <adapter-root>"],
    };
  }

  const result = validateExternalAdapters(adapterRoot, options);
  return {
    exitCode: result.ok ? 0 : 1,
    stream: result.ok ? "stdout" : "stderr",
    lines: formatExternalAdapterSummary(result),
    result,
  };
}
