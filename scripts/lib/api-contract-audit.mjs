import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ADAPTER_MANIFEST_FILENAME,
  readSafeJsonFile,
} from "./adapter-discovery.mjs";
import { PILOT_VERSION, redactSensitiveText } from "./pack-rules.mjs";
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
  ".gql",
  ".graphql",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

const REFUSED_BEHAVIOR = [
  "no target project builds",
  "no target project tests",
  "no app-code execution",
  "no URL probing",
  "no API calls",
  "no package installs",
  "no schema generation",
  "no client generation",
  "no deployments",
  "no migrations",
  "no secret-file reads",
  "no project writes",
];

const NOT_VERIFIED = [
  "runtime route registration",
  "deployed API behavior",
  "database-backed schema behavior",
  "authentication and authorization behavior",
  "generated clients not present as static files",
  "whether static contract and implementation are semantically equivalent",
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
    /(?:^|\/)(?:secrets?|credentials?|private-key)(?:\/|$)/i.test(normalized)
  );
}

function ignoredBy(relativePath, ignoredPaths) {
  const normalized = toPosix(relativePath);
  return ignoredPaths.some((ignored) => {
    const clean = toPosix(ignored).replace(/\/+$/g, "");
    return normalized === clean || normalized.startsWith(`${clean}/`);
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

  if (!validation.acceptedSkills.includes("api-contract-audit")) {
    return {
      ok: true,
      present: true,
      enabled: false,
      projectRoot: loaded.projectRoot,
      mode: "adapter-present-api-contract-audit-not-enabled",
      declarationPath: loaded.declarationPath,
      declaration: loaded.declaration,
      validation,
      codes: ["api-contract-audit-not-enabled-by-adapter"],
    };
  }

  const adapters = [];
  const errors = [];
  const container = path.resolve(loaded.projectRoot, loaded.declaration.adapterRoot);
  if (!inside(loaded.projectRoot, container) || !fs.existsSync(container)) {
    errors.push("adapter-root-not-found");
  } else {
    for (const declaration of loaded.declaration.adapters ?? []) {
      if (!(declaration.skillIds ?? []).includes("api-contract-audit")) continue;
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
  return TEXT_EXTENSIONS.has(path.extname(path.posix.basename(toPosix(relativePath))));
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
    skipped.push({ path: relative, reason: "not an api-contract-audit candidate file" });
    return;
  }
  files.push(relative);
}

function routeFromApiFile(relativePath) {
  const normalized = toPosix(relativePath);
  let route = null;
  if (/^app\/api\/.+\/route\.[jt]sx?$/.test(normalized)) {
    route = normalized
      .replace(/^app\/api\//, "/api/")
      .replace(/\/route\.[jt]sx?$/, "")
      .replace(/\[([^\]]+)\]/g, ":$1");
  } else if (/^pages\/api\/.+\.[jt]sx?$/.test(normalized)) {
    route = normalized
      .replace(/^pages\/api\//, "/api/")
      .replace(/\.[jt]sx?$/, "")
      .replace(/\/index$/, "")
      .replace(/\[([^\]]+)\]/g, ":$1");
  }
  return route;
}

function detectContractFiles(relativePath, text) {
  const normalized = toPosix(relativePath);
  const basename = path.posix.basename(normalized).toLowerCase();
  const lower = text.toLowerCase();
  const reasons = [];
  if (/openapi|swagger/.test(basename)) reasons.push("openapi-or-swagger-filename");
  if (/api[-_.]?contract|contract[-_.]?api/.test(basename)) reasons.push("contract-filename");
  if (/"openapi"\s*:|"swagger"\s*:/.test(text)) reasons.push("openapi-json-indicator");
  if (/^\s*openapi\s*:/im.test(text) || /^\s*swagger\s*:/im.test(text)) {
    reasons.push("openapi-yaml-indicator");
  }
  if (/^\s*\/[A-Za-z0-9_/{:[\].-]+:\s*$/m.test(text) && /(?:get|post|put|patch|delete)\s*:/i.test(text)) {
    reasons.push("path-method-map");
  }
  if (lower.includes("graphql") && /\.(?:gql|graphql|md)$/i.test(normalized)) {
    reasons.push("graphql-contract-indicator");
  }
  return reasons;
}

function detectSchemaFiles(relativePath, text) {
  const normalized = toPosix(relativePath);
  const basename = path.posix.basename(normalized).toLowerCase();
  const reasons = [];
  if (/(schema|schemas|types|dto|contract|model)/i.test(normalized)) {
    reasons.push("schema-or-type-path");
  }
  if (/\bz\.object\s*\(|\bJoi\.object\s*\(|\byup\.object\s*\(/.test(text)) {
    reasons.push("runtime-schema-declaration");
  }
  if (/^\s*(?:export\s+)?(?:interface|type)\s+[A-Z][A-Za-z0-9_]+/m.test(text)) {
    reasons.push("typescript-type-declaration");
  }
  if (/"\$schema"\s*:/.test(text) || /"type"\s*:\s*"object"/.test(text)) {
    reasons.push("json-schema-indicator");
  }
  if (basename.endsWith(".graphql") || basename.endsWith(".gql")) {
    reasons.push("graphql-schema-file");
  }
  return reasons;
}

function detectEndpoints(relativePath, text) {
  const findings = [];
  const route = routeFromApiFile(relativePath);
  if (route) {
    const methodMatches = [...text.matchAll(/\bexport\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g)];
    const methods = methodMatches.length ? methodMatches.map((match) => match[1]) : ["UNKNOWN"];
    for (const method of methods) {
      findings.push({ path: relativePath, method, route, source: "file-route" });
    }
  }

  const methodPattern = /\b(?:app|router|server|api)\.(get|post|put|patch|delete|options|head)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
  for (const match of text.matchAll(methodPattern)) {
    findings.push({
      path: relativePath,
      method: match[1].toUpperCase(),
      route: match[2],
      source: "handler-declaration",
    });
  }

  const openApiPattern = /^\s*["']?(\/[A-Za-z0-9_/{:[\].-]+)["']?\s*:\s*(?:\{)?\s*$/gm;
  for (const match of text.matchAll(openApiPattern)) {
    const near = text.slice(match.index, match.index + 320);
    const method = HTTP_METHODS.find((candidate) => new RegExp(`\\b${candidate.toLowerCase()}\\s*:`, "i").test(near));
    if (method) {
      findings.push({
        path: relativePath,
        method,
        route: match[1],
        source: "contract-path",
      });
    }
  }

  return findings;
}

function detectClientCalls(relativePath, text) {
  const calls = [];
  const fetchPattern = /\bfetch\s*\(\s*["'`]([^"'`]+)["'`]/g;
  for (const match of text.matchAll(fetchPattern)) {
    if (match[1].startsWith("/api/") || /^https?:\/\//.test(match[1])) {
      calls.push({ path: relativePath, target: redactSensitiveText(match[1]), source: "fetch" });
    }
  }
  const axiosPattern = /\baxios\.(get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
  for (const match of text.matchAll(axiosPattern)) {
    if (match[2].startsWith("/api/") || /^https?:\/\//.test(match[2])) {
      calls.push({
        path: relativePath,
        method: match[1].toUpperCase(),
        target: redactSensitiveText(match[2]),
        source: "axios",
      });
    }
  }
  return calls;
}

function scanContracts(projectRoot, files) {
  const contractFiles = [];
  const endpointDeclarations = [];
  const clientCalls = [];
  const schemaFiles = [];
  const warnings = [];

  for (const relative of files) {
    let text = "";
    try {
      text = fs.readFileSync(path.join(projectRoot, relative), "utf8");
    } catch {
      warnings.push(`could not read ${relative}`);
      continue;
    }

    const contractReasons = detectContractFiles(relative, text);
    if (contractReasons.length) {
      contractFiles.push({ path: relative, reasons: [...new Set(contractReasons)].sort() });
    }
    endpointDeclarations.push(...detectEndpoints(relative, text));
    clientCalls.push(...detectClientCalls(relative, text));
    const schemaReasons = detectSchemaFiles(relative, text);
    if (schemaReasons.length) {
      schemaFiles.push({ path: relative, reasons: [...new Set(schemaReasons)].sort() });
    }
  }

  const sortByPath = (left, right) =>
    `${left.path}:${left.route ?? left.target ?? ""}`.localeCompare(
      `${right.path}:${right.route ?? right.target ?? ""}`,
    );

  return {
    contractFiles: contractFiles.sort(sortByPath),
    endpointDeclarations: endpointDeclarations.sort(sortByPath),
    clientCalls: clientCalls.sort(sortByPath),
    schemaFiles: schemaFiles.sort(sortByPath),
    warnings,
  };
}

export function buildApiContractAuditReport(projectRootInput, options = {}) {
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
      contractFiles: [],
      endpointDeclarations: [],
      clientCalls: [],
      schemaFiles: [],
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
      contractFiles: [],
      endpointDeclarations: [],
      clientCalls: [],
      schemaFiles: [],
      skipped: [{ path: ".", reason: "project adapter is present but does not enable api-contract-audit" }],
      warnings: [
        "api-contract-audit is not enabled by the project adapter; target files were not read",
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
  const scanned = scanContracts(projectRoot, collected.files);
  return {
    status: "complete",
    coreVersion: PILOT_VERSION,
    projectRoot,
    adapter: context,
    git,
    scopePaths: scope.scopePaths,
    ignoredPaths: scope.ignoredPaths,
    filesScanned: collected.files,
    contractFiles: scanned.contractFiles,
    endpointDeclarations: scanned.endpointDeclarations,
    clientCalls: scanned.clientCalls,
    schemaFiles: scanned.schemaFiles,
    skipped: collected.skipped,
    warnings: [
      ...git.warnings,
      ...scanned.warnings,
      ...(context.enabled ? ["api-contract-audit used adapter-declared safe read paths only"] : []),
      ...(context.present ? [] : ["no project adapter declaration found; api-contract-audit used generic bounded static scan"]),
    ],
    notVerified: NOT_VERIFIED,
    refusedBehavior: REFUSED_BEHAVIOR,
  };
}

function renderRecords(records, formatter) {
  if (!records.length) return ["- none found"];
  return records.slice(0, 80).map(formatter).concat(
    records.length > 80 ? [`- ${records.length - 80} additional records omitted`] : [],
  );
}

export function renderApiContractAuditReport(report) {
  const lines = [
    "# API Contract Audit Report",
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
    `- API-contract-audit enabled: ${report.adapter.enabled ? "yes" : "no"}`,
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
    `- Contract files: ${report.contractFiles.length}`,
    `- Endpoint declarations: ${report.endpointDeclarations.length}`,
    `- Client call patterns: ${report.clientCalls.length}`,
    `- Schema/type files: ${report.schemaFiles.length}`,
    `- Skipped items: ${report.skipped.length}`,
    "",
    "## Contract Files",
    ...renderRecords(
      report.contractFiles,
      (record) => `- ${record.path}: ${record.reasons.join(", ")}`,
    ),
    "",
    "## Endpoint Declarations",
    ...renderRecords(
      report.endpointDeclarations,
      (record) => `- ${record.method ?? "UNKNOWN"} ${record.route} in ${record.path} (${record.source})`,
    ),
    "",
    "## Client Call Patterns",
    ...renderRecords(
      report.clientCalls,
      (record) => `- ${record.method ?? "UNKNOWN"} ${record.target} in ${record.path} (${record.source})`,
    ),
    "",
    "## Schema And Type Files",
    ...renderRecords(
      report.schemaFiles,
      (record) => `- ${record.path}: ${record.reasons.join(", ")}`,
    ),
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
    "No target project build, test, runtime, URL probe, API call, schema generation, client generation, deployment, migration, package installation, secret-file read, or project write was performed.",
  );
  return lines.join("\n");
}

export function apiContractAuditCliResult(projectRootInput, options = {}) {
  if (!projectRootInput) {
    return {
      exitCode: 2,
      stream: "stderr",
      lines: ["usage: node scripts/render-api-contract-audit.mjs <project-root>"],
    };
  }
  const report = buildApiContractAuditReport(projectRootInput, options);
  return {
    exitCode: report.status === "failed" ? 1 : 0,
    stream: report.status === "failed" ? "stderr" : "stdout",
    lines: renderApiContractAuditReport(report).split("\n"),
    report,
  };
}
