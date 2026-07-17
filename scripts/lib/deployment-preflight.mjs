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

const SKILL_ID = "deployment-preflight";

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
  ".dockerfile",
  ".js",
  ".json",
  ".jsonc",
  ".jsx",
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

const DEPLOYMENT_CONFIG_BASENAMES = new Set([
  "Dockerfile",
  "Procfile",
  "app.yaml",
  "app.yml",
  "amplify.yml",
  "cloudbuild.yaml",
  "cloudbuild.yml",
  "docker-compose.yaml",
  "docker-compose.yml",
  "firebase.json",
  "fly.toml",
  "netlify.toml",
  "railway.json",
  "railway.toml",
  "render.yaml",
  "render.yml",
  "sst.config.js",
  "sst.config.mjs",
  "sst.config.ts",
  "vercel.json",
  "wrangler.json",
  "wrangler.jsonc",
  "wrangler.toml",
]);

const DEPLOYMENT_TERMS = [
  ["cloudflare", /\b(?:cloudflare|wrangler|pages_build_output_dir|compatibility_date)\b/i],
  ["vercel", /\b(?:vercel|buildCommand|outputDirectory|rewrites|redirects)\b/i],
  ["netlify", /\b(?:netlify|publish\s*=|functions\s*=|\[\[redirects\]\])\b/i],
  ["docker", /\b(?:FROM\s+\S+|docker-compose|services:|image:)\b/im],
  ["fly", /\b(?:app\s*=|primary_region|fly\.io)\b/i],
  ["railway", /\b(?:railway|startCommand|buildCommand)\b/i],
  ["render", /\b(?:render|services:|envVars:)\b/i],
  ["firebase", /\b(?:firebase|hosting|functions)\b/i],
  ["generic-ci-deploy", /\b(?:deploy|deployment|release|production)\b/i],
];

const REFUSED_BEHAVIOR = [
  "no deployments",
  "no cloud provider API calls",
  "no package installs",
  "no target project builds",
  "no target project tests",
  "no runtime checks",
  "no service or process mutation",
  "no database connections",
  "no migrations",
  "no secret-file reads",
  "no project writes",
];

const NOT_VERIFIED = [
  "provider authentication",
  "cloud project permissions",
  "deployed service state",
  "DNS or domain configuration",
  "environment variable values",
  "build output correctness",
  "CI/CD job results",
  "runtime health checks",
  "rollback behavior",
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
    basename.startsWith(".env.") ||
    basename === ".npmrc" ||
    /\.(?:pem|key|p12|pfx)$/i.test(basename) ||
    /(?:^|\/)(?:secrets?|credentials?|private-key|service-role|tokens?)(?:\/|$)/i.test(normalized)
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
  if (summary.hasUncommittedChanges) summary.warnings.push("working tree has local changes; filenames omitted");
  if (/\[(?:ahead|behind|gone|diverged)[^\]]*\]/i.test(summary.branchState ?? "")) {
    summary.warnings.push("branch state indicates remote divergence; revalidate after update");
  }
  return summary;
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
    return { ok: false, present: false, enabled: false, status: "failed", codes: loaded.codes };
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

  if (!validation.acceptedSkills.includes(SKILL_ID)) {
    return {
      ok: true,
      present: true,
      enabled: false,
      projectRoot: loaded.projectRoot,
      mode: "adapter-present-deployment-preflight-not-enabled",
      declarationPath: loaded.declarationPath,
      declaration: loaded.declaration,
      validation,
      codes: [`${SKILL_ID}-not-enabled-by-adapter`],
    };
  }

  const adapters = [];
  const errors = [];
  const container = path.resolve(loaded.projectRoot, loaded.declaration.adapterRoot);
  if (!inside(loaded.projectRoot, container) || !fs.existsSync(container)) {
    errors.push("adapter-root-not-found");
  } else {
    for (const declaration of loaded.declaration.adapters ?? []) {
      if (!(declaration.skillIds ?? []).includes(SKILL_ID)) continue;
      const manifestPath = path.join(container, declaration.id, ADAPTER_MANIFEST_FILENAME);
      const record = readSafeJsonFile(manifestPath);
      if (!record.value) {
        errors.push(...record.codes);
        continue;
      }
      adapters.push({
        declaration,
        manifestPath: path.relative(loaded.projectRoot, manifestPath),
        manifest: record.value,
      });
    }
  }
  if (errors.length) {
    return { ok: false, present: true, enabled: false, status: "failed", codes: errors, validation };
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

function scopeFromAdapter(context) {
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
  const normalized = toPosix(relativePath);
  const basename = path.posix.basename(normalized);
  const lowerBasename = basename.toLowerCase();
  return (
    TEXT_EXTENSIONS.has(path.extname(lowerBasename)) ||
    DEPLOYMENT_CONFIG_BASENAMES.has(basename) ||
    DEPLOYMENT_CONFIG_BASENAMES.has(lowerBasename) ||
    /(?:^|\/)(?:deploy|deployment|hosting|docker|k8s|kubernetes|helm|terraform|infra|ops|ci|workflows)(?:\/|$)/i.test(normalized)
  );
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
    skipped.push({ path: relative, reason: "not a deployment-preflight candidate file" });
    return;
  }
  files.push(relative);
}

function detectDeploymentConfig(relativePath, text) {
  const normalized = toPosix(relativePath);
  const basename = path.posix.basename(normalized);
  const lowerBasename = basename.toLowerCase();
  const reasons = [];
  if (DEPLOYMENT_CONFIG_BASENAMES.has(basename) || DEPLOYMENT_CONFIG_BASENAMES.has(lowerBasename)) {
    reasons.push("deployment-config-filename");
  }
  if (/(?:^|\/)\.github\/workflows\/[^/]+\.ya?ml$/i.test(normalized)) {
    reasons.push("github-actions-workflow");
  }
  if (/(?:^|\/)(?:Dockerfile|docker-compose\.ya?ml)$/i.test(normalized)) {
    reasons.push("container-deployment-config");
  }
  for (const [platform, pattern] of DEPLOYMENT_TERMS) {
    if (pattern.test(text)) reasons.push(`${platform}-indicator`);
  }
  return [...new Set(reasons)].sort();
}

function detectDeploymentDoc(relativePath, text) {
  const normalized = toPosix(relativePath);
  const reasons = [];
  if (/\b(?:deploy|deployment|release|hosting|rollback|production)\b/i.test(text)) {
    reasons.push("deployment-wording");
  }
  if (/(?:^|\/)(?:deploy|deployment|release|hosting|ops|runbook)(?:\/|\.|$)/i.test(normalized)) {
    reasons.push("deployment-doc-path");
  }
  return [...new Set(reasons)].sort();
}

function detectPackageScriptKeys(relativePath, text) {
  if (path.posix.basename(toPosix(relativePath)) !== "package.json") return [];
  try {
    const parsed = JSON.parse(text);
    const scripts = parsed && typeof parsed === "object" ? parsed.scripts : null;
    if (!scripts || typeof scripts !== "object") return [];
    return Object.entries(scripts)
      .filter(([key, value]) =>
        /\b(?:deploy|release|publish|preview|wrangler|vercel|netlify|fly|railway|render|firebase|sst|docker)\b/i.test(
          `${key} ${value}`,
        ),
      )
      .map(([key]) => ({ path: relativePath, key }));
  } catch {
    return [{ path: relativePath, key: "unparseable-package-json" }];
  }
}

function detectPlatformIndicators(relativePath, text) {
  const indicators = [];
  for (const [platform, pattern] of DEPLOYMENT_TERMS) {
    if (pattern.test(text)) indicators.push({ path: relativePath, platform });
  }
  return indicators;
}

function detectRiskIndicators(relativePath, text) {
  const indicators = [];
  const checks = [
    ["deploy-command-reference", /\b(?:deploy|publish|release)\b/i],
    ["production-reference", /\b(?:production|prod|live)\b/i],
    ["force-or-unsafe-flag", /\b(?:--force|--yes|-y|--confirm|--unsafe)\b/i],
    ["secret-like-setting-name", /\b(?:token|secret|password|private[_-]?key|api[_-]?key|service[_-]?role)\b/i],
    ["environment-value-reference", /\b(?:process\.env|import\.meta\.env|\$\{?[A-Z][A-Z0-9_]{2,}\}?|envVars)\b/i],
  ];
  for (const [type, pattern] of checks) {
    if (pattern.test(text)) indicators.push({ path: relativePath, type });
  }
  return indicators;
}

function scanDeploymentPreflight(projectRoot, files) {
  const configFiles = [];
  const deploymentDocs = [];
  const packageScriptKeys = [];
  const platformIndicators = [];
  const riskIndicators = [];
  const warnings = [];

  for (const relative of files) {
    let text = "";
    try {
      text = fs.readFileSync(path.join(projectRoot, relative), "utf8");
    } catch {
      warnings.push(`could not read ${relative}`);
      continue;
    }

    const configReasons = detectDeploymentConfig(relative, text);
    if (configReasons.length) {
      configFiles.push({ path: relative, reasons: configReasons });
    }
    const docReasons = detectDeploymentDoc(relative, text);
    if (docReasons.length) {
      deploymentDocs.push({ path: relative, reasons: docReasons });
    }
    packageScriptKeys.push(...detectPackageScriptKeys(relative, text));
    platformIndicators.push(...detectPlatformIndicators(relative, text));
    riskIndicators.push(...detectRiskIndicators(relative, text));
  }

  const byPath = (left, right) =>
    `${left.path}:${left.type ?? left.key ?? left.platform ?? ""}`.localeCompare(
      `${right.path}:${right.type ?? right.key ?? right.platform ?? ""}`,
    );

  return {
    configFiles: configFiles.sort(byPath),
    deploymentDocs: deploymentDocs.sort(byPath),
    packageScriptKeys: packageScriptKeys.sort(byPath),
    platformIndicators: platformIndicators.sort(byPath),
    riskIndicators: riskIndicators.sort(byPath),
    warnings,
  };
}

export function buildDeploymentPreflightReport(projectRootInput, options = {}) {
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
      configFiles: [],
      deploymentDocs: [],
      packageScriptKeys: [],
      platformIndicators: [],
      riskIndicators: [],
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
      configFiles: [],
      deploymentDocs: [],
      packageScriptKeys: [],
      platformIndicators: [],
      riskIndicators: [],
      skipped: [{ path: ".", reason: "project adapter is present but does not enable deployment-preflight" }],
      warnings: [
        "deployment-preflight is not enabled by the project adapter; target files were not read",
        ...git.warnings,
      ],
      notVerified: NOT_VERIFIED,
      refusedBehavior: REFUSED_BEHAVIOR,
    };
  }

  const scope = context.enabled
    ? scopeFromAdapter(context)
    : { scopePaths: ["."], ignoredPaths: DEFAULT_IGNORED_PATHS };
  const collected = collectFiles(projectRoot, scope.scopePaths, scope.ignoredPaths);
  const scanned = scanDeploymentPreflight(projectRoot, collected.files);
  return {
    status: "complete",
    coreVersion: PILOT_VERSION,
    projectRoot,
    adapter: context,
    git,
    scopePaths: scope.scopePaths,
    ignoredPaths: scope.ignoredPaths,
    filesScanned: collected.files,
    configFiles: scanned.configFiles,
    deploymentDocs: scanned.deploymentDocs,
    packageScriptKeys: scanned.packageScriptKeys,
    platformIndicators: scanned.platformIndicators,
    riskIndicators: scanned.riskIndicators,
    skipped: collected.skipped,
    warnings: [
      ...git.warnings,
      ...scanned.warnings,
      ...(context.enabled ? ["deployment-preflight used adapter-declared safe read paths only"] : []),
      ...(context.present ? [] : ["no project adapter declaration found; deployment-preflight used generic bounded static scan"]),
    ],
    notVerified: NOT_VERIFIED,
    refusedBehavior: REFUSED_BEHAVIOR,
  };
}

function renderRecords(records, formatter, empty = "- none found") {
  if (!records.length) return [empty];
  return records.slice(0, 80).map(formatter).concat(
    records.length > 80 ? [`- ${records.length - 80} additional records omitted`] : [],
  );
}

export function renderDeploymentPreflightReport(report) {
  const lines = [
    "# Deployment Preflight Report",
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
    `- Deployment-preflight enabled: ${report.adapter.enabled ? "yes" : "no"}`,
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
    `- Deployment config files: ${report.configFiles.length}`,
    `- Deployment docs: ${report.deploymentDocs.length}`,
    `- Package script keys mentioning deployment: ${report.packageScriptKeys.length}`,
    `- Platform indicators: ${report.platformIndicators.length}`,
    `- Risk indicators: ${report.riskIndicators.length}`,
    `- Skipped items: ${report.skipped.length}`,
    "",
    "## Deployment Config Files",
    ...renderRecords(report.configFiles, (record) => `- ${record.path}: ${record.reasons.join(", ")}`),
    "",
    "## Deployment Docs",
    ...renderRecords(report.deploymentDocs, (record) => `- ${record.path}: ${record.reasons.join(", ")}`),
    "",
    "## Package Script Keys",
    ...renderRecords(
      report.packageScriptKeys,
      (record) => `- ${record.path}: ${record.key}`,
      "- none found; command values are not printed",
    ),
    "",
    "## Platform Indicators",
    ...renderRecords(report.platformIndicators, (record) => `- ${record.path}: ${record.platform}`),
    "",
    "## Risk Indicators",
    ...renderRecords(report.riskIndicators, (record) => `- ${record.path}: ${record.type}`),
    "",
    "## Skipped",
  ];
  if (report.skipped.length) {
    for (const skipped of report.skipped.slice(0, 40)) {
      lines.push(`- ${skipped.path}: ${skipped.reason}`);
    }
    if (report.skipped.length > 40) lines.push(`- ${report.skipped.length - 40} additional skipped items omitted`);
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
    "No deployment, cloud provider API call, package installation, target project build, test, runtime check, service mutation, database connection, migration, secret-file read, or project write was performed.",
  );
  return lines.join("\n");
}

export function deploymentPreflightCliResult(projectRootInput, options = {}) {
  if (!projectRootInput) {
    return {
      exitCode: 2,
      stream: "stderr",
      lines: ["usage: node scripts/render-deployment-preflight.mjs <project-root>"],
    };
  }
  const report = buildDeploymentPreflightReport(projectRootInput, options);
  return {
    exitCode: report.status === "failed" ? 1 : 0,
    stream: report.status === "failed" ? "stderr" : "stdout",
    lines: renderDeploymentPreflightReport(report).split("\n"),
    report,
  };
}
