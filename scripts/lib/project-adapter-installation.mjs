import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ADAPTER_SCHEMA_VERSION,
  EXTERNAL_ADAPTER_LOCATIONS,
  readSafeJsonFile,
  validateExternalAdapters,
} from "./adapter-discovery.mjs";
import { PILOT_SKILLS, PILOT_VERSION } from "./pack-rules.mjs";
import { validateValue } from "./schema-validator.mjs";
import { parseSemver, parseVersionPin, satisfiesVersionPin } from "./semver.mjs";

export const PROJECT_DECLARATION_VERSION = "1.0.0";
export const PROJECT_DECLARATION_LOCATIONS = [
  ".coding-agent/skills.json",
  "coding-agent.skills.json",
];

const DEFAULT_CORE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function baseFailure(code) {
  return {
    ok: false,
    status: "failed",
    acceptedAdapters: 0,
    acceptedSkills: [],
    codes: [code],
  };
}

function inspectRelativePath(root, relative) {
  if (
    typeof relative !== "string" ||
    relative.startsWith("/") ||
    relative.split(/[\\/]+/).includes("..") ||
    /(^|\/)\.env(?:\.|$)/.test(relative)
  ) {
    return ["unsafe-project-path"];
  }

  const candidate = path.resolve(root, relative);
  if (!inside(root, candidate)) return ["unsafe-project-path"];

  let current = root;
  for (const segment of path.relative(root, candidate).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) break;
    if (fs.lstatSync(current).isSymbolicLink()) return ["symlink-escape"];
  }
  return [];
}

function discoverDeclaration(projectRoot) {
  const candidates = [];
  const failures = [];

  for (const relative of PROJECT_DECLARATION_LOCATIONS) {
    const pathIssues = inspectRelativePath(projectRoot, relative);
    if (pathIssues.length) {
      failures.push(...pathIssues);
      continue;
    }
    const file = path.join(projectRoot, relative);
    if (!fs.existsSync(file)) continue;
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) {
      failures.push("symlink-escape");
    } else if (!stat.isFile()) {
      failures.push("declaration-not-regular-file");
    } else {
      candidates.push({ file, relative });
    }
  }

  if (failures.length) return { candidate: null, codes: failures };
  if (candidates.length === 0) {
    return { candidate: null, codes: ["missing-project-declaration"] };
  }
  if (candidates.length > 1) {
    return { candidate: null, codes: ["ambiguous-project-declaration"] };
  }
  return { candidate: candidates[0], codes: [] };
}

function declarationSchema(coreRoot) {
  const file = path.join(
    coreRoot,
    "schemas",
    "project-adapter-installation.schema.json",
  );
  if (!fs.existsSync(file)) return null;
  return readSafeJsonFile(file, { scanSensitive: false }).value;
}

function schemaCodes(errors) {
  const codes = new Set();
  for (const error of errors) {
    codes.add("declaration-schema");
    if (/adapterRoot/.test(error)) codes.add("invalid-adapter-location");
    if (/expectedVersion|versionPin/.test(error)) codes.add("invalid-core-version");
    if (/compatibleSkillIds|skillIds/.test(error)) codes.add("unsupported-skill-id");
    if (/adapterSchemaVersion/.test(error)) codes.add("unsupported-adapter-version");
    if (/noSecrets/.test(error)) codes.add("secret-guarantee-missing");
    if (/evidenceOutput|approvalPolicyReference/.test(error)) {
      codes.add("unsafe-project-path");
    }
  }
  return [...codes];
}

function versionCodes(declaration) {
  const codes = [];
  const expected = declaration.core?.expectedVersion;
  const pin = declaration.core?.versionPin;

  if (!parseSemver(expected) || !parseVersionPin(pin)) {
    codes.push("invalid-semver");
    return codes;
  }
  if (expected !== PILOT_VERSION) codes.push("unsupported-core-version");
  if (!satisfiesVersionPin(PILOT_VERSION, pin)) codes.push("core-pin-mismatch");
  if (!satisfiesVersionPin(expected, pin)) codes.push("expected-version-outside-pin");
  return codes;
}

function declarationCompatibilityCodes(declaration, discovery) {
  const codes = [];
  const declaredAdapters = new Map();

  for (const adapter of declaration.adapters ?? []) {
    if (declaredAdapters.has(adapter.id)) codes.push("duplicate-adapter-declaration");
    declaredAdapters.set(adapter.id, adapter);
    for (const skill of adapter.skillIds ?? []) {
      if (!(declaration.compatibleSkillIds ?? []).includes(skill)) {
        codes.push("skill-not-declared-compatible");
      }
    }
  }

  if (declaration.adapterSchemaVersion !== ADAPTER_SCHEMA_VERSION) {
    codes.push("unsupported-adapter-version");
  }

  const actualAdapters = new Map();
  for (const adapter of discovery.accepted) {
    if (actualAdapters.has(adapter.adapterId)) codes.push("duplicate-installed-adapter");
    actualAdapters.set(adapter.adapterId, adapter);
    if (adapter.rootLocation !== declaration.adapterRoot) {
      codes.push("adapter-location-mismatch");
    }
    if (adapter.projectId !== declaration.projectId) {
      codes.push("adapter-project-mismatch");
    }

    const declared = declaredAdapters.get(adapter.adapterId);
    if (!declared) {
      codes.push("installed-adapter-not-declared");
      continue;
    }
    if (declared.version !== adapter.adapterVersion) {
      codes.push("adapter-version-mismatch");
    }
    const declaredSkills = [...(declared.skillIds ?? [])].sort();
    if (JSON.stringify(declaredSkills) !== JSON.stringify(adapter.skills)) {
      codes.push("adapter-skill-mismatch");
    }
  }

  for (const adapterId of declaredAdapters.keys()) {
    if (!actualAdapters.has(adapterId)) codes.push("declared-adapter-not-installed");
  }

  const actualSkills = [
    ...new Set(discovery.accepted.flatMap((adapter) => adapter.skills)),
  ].sort();
  const declaredSkills = [...new Set(declaration.compatibleSkillIds ?? [])].sort();
  if (JSON.stringify(actualSkills) !== JSON.stringify(declaredSkills)) {
    codes.push("project-skill-set-mismatch");
  }

  return codes;
}

export function validateProjectAdapters(projectRootInput, options = {}) {
  const input = String(projectRootInput ?? "");
  if (!input.trim()) return baseFailure("missing-project-root");
  if (input.split(/[\\/]+/).includes("..")) return baseFailure("root-path-traversal");

  const projectRoot = path.resolve(input);
  if (!fs.existsSync(projectRoot)) return baseFailure("project-root-not-found");
  const rootStat = fs.lstatSync(projectRoot);
  if (rootStat.isSymbolicLink()) return baseFailure("symlink-escape");
  if (!rootStat.isDirectory()) return baseFailure("project-root-not-directory");

  const realRoot = fs.realpathSync(projectRoot);
  const coreRoot = path.resolve(options.coreRoot ?? DEFAULT_CORE_ROOT);
  const schema = declarationSchema(coreRoot);
  if (!schema) return baseFailure("project-declaration-schema-unavailable");

  const declarationRecord = discoverDeclaration(realRoot);
  if (!declarationRecord.candidate) {
    return {
      ...baseFailure(declarationRecord.codes[0]),
      codes: [...new Set(declarationRecord.codes)],
    };
  }

  const parsed = readSafeJsonFile(declarationRecord.candidate.file);
  if (!parsed.value) {
    return {
      ...baseFailure(parsed.codes[0]),
      codes: parsed.codes,
    };
  }

  const declaration = parsed.value;
  const codes = new Set(schemaCodes(validateValue(schema, declaration)));

  if (declaration.declarationVersion !== PROJECT_DECLARATION_VERSION) {
    codes.add("unsupported-declaration-version");
  }
  if (!EXTERNAL_ADAPTER_LOCATIONS.includes(declaration.adapterRoot)) {
    codes.add("invalid-adapter-location");
  }
  for (const relative of [
    declaration.adapterRoot,
    declaration.evidenceOutput,
    declaration.approvalPolicyReference,
  ]) {
    for (const code of inspectRelativePath(realRoot, relative)) codes.add(code);
  }
  for (const code of versionCodes(declaration)) codes.add(code);
  if (declaration.noSecrets !== true) codes.add("secret-guarantee-missing");
  if (
    declaration.validationCommand !==
    "node <shared-core>/scripts/validate-project-adapters.mjs <project-root>"
  ) {
    codes.add("invalid-validation-command");
  }

  const discovery = validateExternalAdapters(realRoot, { coreRoot });
  for (const record of [...discovery.rejected, ...discovery.failures]) {
    for (const code of record.codes) codes.add(code);
  }
  if (discovery.discovered === 0) codes.add("no-project-adapters");
  for (const code of declarationCompatibilityCodes(declaration, discovery)) {
    codes.add(code);
  }

  const acceptedSkills = [
    ...new Set(discovery.accepted.flatMap((adapter) => adapter.skills)),
  ].filter((skill) => PILOT_SKILLS.includes(skill)).sort();
  return {
    ok: codes.size === 0,
    status: codes.size === 0 ? "complete" : "failed",
    acceptedAdapters: discovery.accepted.length,
    acceptedSkills,
    codes: [...codes].sort(),
  };
}

export function formatProjectAdapterSummary(result) {
  if (result.ok) {
    return [
      `project adapter validation complete: ${result.acceptedAdapters} adapters, ` +
        `${result.acceptedSkills.length} skills, core pin accepted`,
    ];
  }
  return [
    `project adapter validation failed: ${result.acceptedAdapters} adapters accepted`,
    `rejection codes: ${result.codes.join(",")}`,
  ];
}

export function projectAdapterCliResult(projectRoot, options = {}) {
  if (!projectRoot) {
    return {
      exitCode: 2,
      stream: "stderr",
      lines: ["usage: node scripts/validate-project-adapters.mjs <project-root>"],
    };
  }
  const result = validateProjectAdapters(projectRoot, options);
  return {
    exitCode: result.ok ? 0 : 1,
    stream: result.ok ? "stdout" : "stderr",
    lines: formatProjectAdapterSummary(result),
    result,
  };
}
