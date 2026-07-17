import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ADAPTER_MANIFEST_FILENAME,
  readSafeJsonFile,
} from "./adapter-discovery.mjs";
import { PILOT_VERSION } from "./pack-rules.mjs";
import {
  readProjectAdapterDeclaration,
  validateProjectAdapters,
} from "./project-adapter-installation.mjs";

const DEFAULT_CORE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const DEFAULT_IGNORED_PATHS = [
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "out",
  "validation-output",
];

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".mjs",
  ".mts",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const CONFIG_FILENAMES = new Set([
  ".env.example",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.ts",
  "wrangler.toml",
]);

const REFUSED_BEHAVIOR = [
  "no .env reads",
  "no secret-file reads",
  "no value printing",
  "no credential validation",
  "no API calls",
  "no target project builds",
  "no target project tests",
  "no package installs",
  "no deployments",
  "no migrations",
  "no project writes",
];

const NOT_VERIFIED = [
  "actual environment variable values",
  "whether credentials are valid",
  "runtime-injected environment",
  "host, CI, platform, or cloud secret stores",
  "variables assembled dynamically at runtime",
];

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function safeRelativePath(candidate) {
  return (
    typeof candidate === "string" &&
    candidate.length > 0 &&
    !candidate.startsWith("/") &&
    !candidate.split(/[\\/]+/).includes("..")
  );
}

function secretBearingPath(relativePath) {
  const normalized = toPosix(relativePath);
  const basename = path.posix.basename(normalized);
  return (
    basename === ".env" ||
    (basename.startsWith(".env.") && basename !== ".env.example") ||
    basename === ".npmrc" ||
    /\.(?:pem|key|p12|pfx)$/i.test(basename) ||
    /(?:^|\/)(?:secrets?|credentials?|private-key)(?:\/|$)/i.test(normalized)
  );
}

function ignoredBy(relativePath, ignoredPaths) {
  const normalized = toPosix(relativePath);
  return ignoredPaths.some((ignored) => {
    const clean = toPosix(ignored).replace(/\/+$/g, "");
    return clean.includes("/")
      ? normalized === clean || normalized.startsWith(`${clean}/`)
      : normalized.split("/").includes(clean);
  });
}

function gitSummary(projectRoot) {
  const summary = {
    root: null,
    branchState: null,
    hasUncommittedChanges: false,
    warnings: [],
  };

  const revParse = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (revParse.status === 0) summary.root = revParse.stdout.trim();

  const status = spawnSync("git", ["status", "--short", "--branch"], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (status.status !== 0) {
    summary.warnings.push("git status unavailable");
    return summary;
  }

  const lines = status.stdout.split(/\r?\n/).filter(Boolean);
  summary.branchState = lines[0] ?? null;
  summary.hasUncommittedChanges = lines.length > 1;
  if (summary.hasUncommittedChanges) {
    summary.warnings.push("working tree has local changes; filenames omitted");
  }
  if (/\[(?:ahead|behind|gone|diverged)[^\]]*\]/i.test(summary.branchState ?? "")) {
    summary.warnings.push("branch state indicates remote divergence; revalidate after update");
  }
  return summary;
}

function discoverEnvAuditAdapters(loaded) {
  const adapters = [];
  const errors = [];
  const declarations = loaded.declaration.adapters ?? [];
  const container = path.resolve(loaded.projectRoot, loaded.declaration.adapterRoot);
  const manifestCandidates = [];

  if (!inside(loaded.projectRoot, container) || !fs.existsSync(container)) {
    return { adapters, errors: ["adapter-root-not-found"] };
  }

  for (const entry of fs.readdirSync(container, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || !entry.isDirectory()) continue;
    const manifestPath = path.join(container, entry.name, ADAPTER_MANIFEST_FILENAME);
    if (!inside(loaded.projectRoot, manifestPath) || !fs.existsSync(manifestPath)) continue;
    const record = readSafeJsonFile(manifestPath);
    if (!record.value) {
      errors.push(...record.codes);
      continue;
    }
    manifestCandidates.push({
      manifestPath,
      manifest: record.value,
    });
  }

  for (const declaration of declarations) {
    if (!(declaration.skillIds ?? []).includes("env-audit")) continue;
    const match = manifestCandidates.find(
      (candidate) => candidate.manifest.adapterId === declaration.id,
    );
    if (!match) {
      errors.push("declared-env-audit-adapter-not-found");
      continue;
    }
    adapters.push({
      declaration,
      manifestPath: path.relative(loaded.projectRoot, match.manifestPath),
      manifest: match.manifest,
    });
  }

  return { adapters, errors };
}

function adapterContext(projectRootInput, coreRoot) {
  const loaded = readProjectAdapterDeclaration(projectRootInput);
  if (!loaded.ok) {
    if (loaded.codes.length === 1 && loaded.codes[0] === "missing-project-declaration") {
      return {
        ok: true,
        present: false,
        enabled: false,
        projectRoot: path.resolve(projectRootInput),
        mode: "none",
        codes: [],
      };
    }
    return {
      ok: false,
      present: false,
      enabled: false,
      status: "failed",
      codes: loaded.codes,
    };
  }

  const validation = validateProjectAdapters(loaded.projectRoot, { coreRoot });
  if (!validation.ok) {
    return {
      ok: false,
      present: true,
      enabled: false,
      status: "failed",
      codes: validation.codes,
      validation,
    };
  }

  if (!validation.acceptedSkills.includes("env-audit")) {
    return {
      ok: true,
      present: true,
      enabled: false,
      projectRoot: loaded.projectRoot,
      mode: "adapter-present-env-audit-not-enabled",
      declarationPath: loaded.declarationPath,
      declaration: loaded.declaration,
      validation,
      codes: ["env-audit-not-enabled-by-adapter"],
    };
  }

  const { adapters, errors } = discoverEnvAuditAdapters(loaded);
  if (errors.length) {
    return {
      ok: false,
      present: true,
      enabled: false,
      status: "failed",
      codes: errors,
      validation,
    };
  }

  return {
    ok: true,
    present: true,
    enabled: true,
    projectRoot: loaded.projectRoot,
    mode: "adapter-enabled",
    declarationPath: loaded.declarationPath,
    declaration: loaded.declaration,
    validation,
    adapters,
    codes: [],
  };
}

function scanScopeFromAdapter(context) {
  const safeReadPaths = new Set();
  const ignoredPaths = new Set(DEFAULT_IGNORED_PATHS);

  for (const adapter of context.adapters ?? []) {
    for (const candidate of adapter.manifest.extensions?.safeReadPaths ?? []) {
      if (safeRelativePath(candidate)) safeReadPaths.add(candidate);
    }
    for (const candidate of adapter.manifest.extensions?.ignoredPaths ?? []) {
      if (safeRelativePath(candidate)) ignoredPaths.add(candidate);
    }
  }

  return {
    scopePaths: safeReadPaths.size ? [...safeReadPaths].sort() : ["."],
    ignoredPaths: [...ignoredPaths].sort(),
  };
}

function candidateFile(relativePath) {
  const basename = path.posix.basename(toPosix(relativePath));
  if (CONFIG_FILENAMES.has(basename)) return true;
  return TEXT_EXTENSIONS.has(path.extname(basename));
}

function collectFiles(projectRoot, scopePaths, ignoredPaths) {
  const files = [];
  const skipped = [];

  for (const scopePath of scopePaths) {
    if (!safeRelativePath(scopePath) && scopePath !== ".") {
      skipped.push({ path: scopePath, reason: "unsafe scope path" });
      continue;
    }
    const absolute = path.resolve(projectRoot, scopePath);
    if (!inside(projectRoot, absolute)) {
      skipped.push({ path: scopePath, reason: "scope escapes project root" });
      continue;
    }
    if (!fs.existsSync(absolute)) {
      skipped.push({ path: scopePath, reason: "scope path not found" });
      continue;
    }
    walkPath(projectRoot, absolute, ignoredPaths, files, skipped);
  }

  return { files: [...new Set(files)].sort(), skipped };
}

function walkPath(projectRoot, absolute, ignoredPaths, files, skipped) {
  const relative = toPosix(path.relative(projectRoot, absolute)) || ".";
  if (relative !== "." && ignoredBy(relative, ignoredPaths)) {
    skipped.push({ path: relative, reason: "ignored path" });
    return;
  }
  if (relative !== "." && secretBearingPath(relative)) {
    skipped.push({ path: relative, reason: "secret-bearing path excluded" });
    return;
  }

  const stat = fs.lstatSync(absolute);
  if (stat.isSymbolicLink()) {
    skipped.push({ path: relative, reason: "symbolic link skipped" });
    return;
  }
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(absolute)) {
      walkPath(projectRoot, path.join(absolute, entry), ignoredPaths, files, skipped);
    }
    return;
  }
  if (!stat.isFile()) return;
  if (stat.size > 512_000) {
    skipped.push({ path: relative, reason: "file larger than bounded read limit" });
    return;
  }
  if (!candidateFile(relative)) {
    skipped.push({ path: relative, reason: "not an env-audit candidate file" });
    return;
  }
  files.push(relative);
}

function classifyReference(text, index, sourceKind) {
  if (sourceKind === "sample") return "sample";
  const window = text.slice(Math.max(0, index - 80), index + 120).toLowerCase();
  if (/\b(required|must|throw|missing|requiredenv)\b|!\s*(?:[;),\]}]|$)/.test(window)) {
    return "required";
  }
  if (/\b(optional|fallback|default)\b|\?\?|(?:\|\|)/.test(window)) {
    return "optional";
  }
  return "inferred";
}

function addReference(map, name, record) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) return;
  if (!map.has(name)) {
    map.set(name, {
      name,
      classifications: new Set(),
      references: [],
    });
  }
  const target = map.get(name);
  target.classifications.add(record.classification);
  const marker = `${record.path}:${record.source}`;
  if (!target.references.some((reference) => `${reference.path}:${reference.source}` === marker)) {
    target.references.push(record);
  }
}

function scanEnvReferences(projectRoot, files) {
  const variables = new Map();
  const sampleFiles = [];
  const warnings = [];

  for (const relative of files) {
    const absolute = path.join(projectRoot, relative);
    let text = "";
    try {
      text = fs.readFileSync(absolute, "utf8");
    } catch {
      warnings.push(`could not read ${relative}`);
      continue;
    }

    const basename = path.posix.basename(relative);
    const sourceKind = basename === ".env.example" ? "sample" : "reference";
    if (sourceKind === "sample") sampleFiles.push(relative);

    const patterns = [
      { source: "process.env", regex: /\bprocess\.env\.([A-Z][A-Z0-9_]*)\b/g },
      { source: "process.env", regex: /\bprocess\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g },
      { source: "import.meta.env", regex: /\bimport\.meta\.env\.([A-Z][A-Z0-9_]*)\b/g },
      { source: "deno.env", regex: /\bDeno\.env\.get\(['"]([A-Z][A-Z0-9_]*)['"]\)/g },
      { source: "env-function", regex: /\benv\(['"]([A-Z][A-Z0-9_]*)['"]\)/g },
    ];

    if (sourceKind === "sample") {
      patterns.push({
        source: ".env.example",
        regex: /^([A-Z][A-Z0-9_]*)\s*=/gm,
      });
    } else if (/\.(?:md|txt)$/i.test(relative)) {
      patterns.push({
        source: "documented-name",
        regex:
          /\b([A-Z][A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL|URL|HOST|PORT|ENV|ID))\b/g,
      });
    }

    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern.regex)) {
        addReference(variables, match[1], {
          path: relative,
          source: pattern.source,
          classification: classifyReference(text, match.index ?? 0, sourceKind),
        });
      }
    }
  }

  return {
    variables: [...variables.values()]
      .map((record) => ({
        ...record,
        classifications: [...record.classifications].sort(),
        references: record.references.sort((a, b) => a.path.localeCompare(b.path)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    sampleFiles: [...new Set(sampleFiles)].sort(),
    warnings,
  };
}

export function buildEnvAuditReport(projectRootInput, options = {}) {
  const coreRoot = options.coreRoot ?? DEFAULT_CORE_ROOT;
  const context = adapterContext(projectRootInput, coreRoot);
  if (!context.ok) {
    return {
      status: "failed",
      coreVersion: PILOT_VERSION,
      projectRoot: path.resolve(projectRootInput ?? "."),
      adapter: context,
      git: gitSummary(path.resolve(projectRootInput ?? ".")),
      scopePaths: [],
      ignoredPaths: DEFAULT_IGNORED_PATHS,
      filesScanned: [],
      variables: [],
      sampleFiles: [],
      skipped: [],
      warnings: context.codes ?? [],
      notVerified: NOT_VERIFIED,
      refusedBehavior: REFUSED_BEHAVIOR,
    };
  }

  const projectRoot = context.projectRoot;
  const git = gitSummary(projectRoot);

  if (context.present && !context.enabled) {
    return {
      status: "partial",
      coreVersion: PILOT_VERSION,
      projectRoot,
      adapter: context,
      git,
      scopePaths: [],
      ignoredPaths: DEFAULT_IGNORED_PATHS,
      filesScanned: [],
      variables: [],
      sampleFiles: [],
      skipped: [
        {
          path: ".",
          reason: "project adapter is present but does not enable env-audit",
        },
      ],
      warnings: [
        "env-audit is not enabled by the project adapter; target files were not read",
        ...git.warnings,
      ],
      notVerified: NOT_VERIFIED,
      refusedBehavior: REFUSED_BEHAVIOR,
    };
  }

  const scope = context.enabled
    ? scanScopeFromAdapter(context)
    : { scopePaths: ["."], ignoredPaths: DEFAULT_IGNORED_PATHS };
  const collected = collectFiles(projectRoot, scope.scopePaths, scope.ignoredPaths);
  const scanned = scanEnvReferences(projectRoot, collected.files);

  return {
    status: "complete",
    coreVersion: PILOT_VERSION,
    projectRoot,
    adapter: context,
    git,
    scopePaths: scope.scopePaths,
    ignoredPaths: scope.ignoredPaths,
    filesScanned: collected.files,
    variables: scanned.variables,
    sampleFiles: scanned.sampleFiles,
    skipped: collected.skipped,
    warnings: [
      ...git.warnings,
      ...scanned.warnings,
      ...(context.enabled ? ["env-audit used adapter-declared safe read paths only"] : []),
      ...(context.present ? [] : ["no project adapter declaration found; env-audit used generic bounded static scan"]),
    ],
    notVerified: NOT_VERIFIED,
    refusedBehavior: REFUSED_BEHAVIOR,
  };
}

export function renderEnvAuditReport(report) {
  const lines = [
    "# Env Audit Report",
    "",
    `Status: ${report.status}`,
    `Core version: ${report.coreVersion}`,
    `Project root: ${report.projectRoot}`,
    "",
    "## Git State",
    `- Git root: ${report.git.root ?? "not detected"}`,
    `- Branch state: ${report.git.branchState ?? "not detected"}`,
    `- Local changes: ${report.git.hasUncommittedChanges ? "detected" : "not detected"}`,
    "",
    "## Adapter Scope",
    `- Adapter present: ${report.adapter.present ? "yes" : "no"}`,
    `- Env-audit enabled: ${report.adapter.enabled ? "yes" : "no"}`,
    `- Mode: ${report.adapter.mode}`,
    "",
    "## Scope Paths",
    ...(report.scopePaths.length ? report.scopePaths.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Ignored Paths",
    ...report.ignoredPaths.map((item) => `- ${item}`),
    "",
    "## Summary",
    `- Static files scanned: ${report.filesScanned.length}`,
    `- Environment variable names found: ${report.variables.length}`,
    `- Sample env files inspected: ${report.sampleFiles.length}`,
    `- Skipped items: ${report.skipped.length}`,
    "",
    "## Environment Variables",
  ];

  if (report.variables.length) {
    for (const variable of report.variables) {
      lines.push(`- ${variable.name} (${variable.classifications.join(", ")})`);
      for (const reference of variable.references.slice(0, 8)) {
        lines.push(`  - ${reference.path} via ${reference.source}`);
      }
      if (variable.references.length > 8) {
        lines.push(`  - ${variable.references.length - 8} additional references omitted`);
      }
    }
  } else {
    lines.push("- none found");
  }

  lines.push("", "## Sample Files Inspected");
  if (report.sampleFiles.length) {
    for (const file of report.sampleFiles) lines.push(`- ${file}`);
  } else {
    lines.push("- none");
  }

  lines.push("", "## Skipped");
  if (report.skipped.length) {
    for (const skipped of report.skipped.slice(0, 40)) {
      lines.push(`- ${skipped.path}: ${skipped.reason}`);
    }
    if (report.skipped.length > 40) {
      lines.push(`- ${report.skipped.length - 40} additional skipped items omitted`);
    }
  } else {
    lines.push("- none");
  }

  lines.push("", "## Not Verified");
  for (const item of report.notVerified) lines.push(`- ${item}`);

  lines.push("", "## Warnings");
  if (report.warnings.length) {
    for (const warning of report.warnings) lines.push(`- ${warning}`);
  } else {
    lines.push("- none");
  }

  lines.push("", "## Refused Behavior");
  for (const item of report.refusedBehavior) lines.push(`- ${item}`);

  lines.push(
    "",
    "No .env, secret-file, credential-store, API, build, test, deploy, migration, package-install, or project-write behavior was performed.",
  );

  return lines.join("\n");
}

export function envAuditCliResult(projectRootInput, options = {}) {
  if (!projectRootInput) {
    return {
      exitCode: 2,
      stream: "stderr",
      lines: ["usage: node scripts/render-env-audit.mjs <project-root>"],
    };
  }

  const report = buildEnvAuditReport(projectRootInput, options);
  return {
    exitCode: report.status === "failed" ? 1 : 0,
    stream: report.status === "failed" ? "stderr" : "stdout",
    lines: renderEnvAuditReport(report).split("\n"),
    report,
  };
}
