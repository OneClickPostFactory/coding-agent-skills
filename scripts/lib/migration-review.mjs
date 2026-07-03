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

const SKILL_ID = "migration-review";

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
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".mts",
  ".prisma",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const MIGRATION_CONFIG_BASENAMES = new Set([
  "dbmate.yml",
  "dbmate.yaml",
  "drizzle.config.js",
  "drizzle.config.mjs",
  "drizzle.config.ts",
  "knexfile.js",
  "knexfile.ts",
  "migrate.config.js",
  "migrate.config.ts",
  "schema.prisma",
  "sequelize.config.js",
  "supabase.toml",
  "typeorm.config.js",
  "typeorm.config.ts",
]);

const REFUSED_BEHAVIOR = [
  "no database connections",
  "no migration apply/status/reset commands",
  "no ORM generation",
  "no target project builds",
  "no target project tests",
  "no package installs",
  "no app-code execution",
  "no deployments",
  "no service or process mutation",
  "no secret-file reads",
  "no project writes",
];

const NOT_VERIFIED = [
  "whether migrations have been applied",
  "database schema currently deployed",
  "rollback behavior",
  "data backfill correctness",
  "production safety or lock behavior",
  "generated ORM clients",
  "runtime database connectivity",
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
    /(?:^|\/)(?:secrets?|credentials?|private-key|service-role)(?:\/|$)/i.test(normalized)
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

  if (!validation.acceptedSkills.includes(SKILL_ID)) {
    return {
      ok: true,
      present: true,
      enabled: false,
      projectRoot: loaded.projectRoot,
      mode: "adapter-present-migration-review-not-enabled",
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
  const basename = path.posix.basename(normalized).toLowerCase();
  return (
    TEXT_EXTENSIONS.has(path.extname(basename)) ||
    MIGRATION_CONFIG_BASENAMES.has(basename) ||
    /(?:^|\/)(?:migrations?|schema|db|database|prisma|drizzle|supabase)(?:\/|$)/i.test(normalized)
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
    skipped.push({ path: relative, reason: "not a migration-review candidate file" });
    return;
  }
  files.push(relative);
}

function detectMigrationFile(relativePath, text) {
  const normalized = toPosix(relativePath);
  const basename = path.posix.basename(normalized).toLowerCase();
  const lower = text.toLowerCase();
  const reasons = [];
  if (/(?:^|\/)migrations?(?:\/|$)/i.test(normalized)) reasons.push("migration-directory");
  if (basename === "migration.sql") reasons.push("canonical-migration-sql");
  if (/^\d{8,}[_-]/.test(basename) || /^\d{4}[_-]\d{2}[_-]\d{2}/.test(basename)) {
    reasons.push("timestamped-migration-file");
  }
  if (/\.(?:sql)$/i.test(basename) && /\b(?:create|alter|drop|rename|truncate)\b/i.test(text)) {
    reasons.push("sql-ddl-content");
  }
  if (lower.includes("prisma migrate") || lower.includes("drizzle-kit") || lower.includes("knex migrate")) {
    reasons.push("migration-tool-reference");
  }
  return reasons;
}

function detectSchemaFile(relativePath, text) {
  const normalized = toPosix(relativePath);
  const basename = path.posix.basename(normalized).toLowerCase();
  const reasons = [];
  if (basename === "schema.prisma") reasons.push("prisma-schema");
  if (/drizzle\/schema|db\/schema|database\/schema|schema\.[jt]sx?$/i.test(normalized)) {
    reasons.push("database-schema-path");
  }
  if (/\bmodel\s+[A-Z][A-Za-z0-9_]*\s*\{/m.test(text)) reasons.push("prisma-model-declaration");
  if (/\b(?:pgTable|mysqlTable|sqliteTable)\s*\(/.test(text)) reasons.push("drizzle-table-declaration");
  if (/\bCREATE\s+TABLE\b/i.test(text)) reasons.push("sql-table-declaration");
  return reasons;
}

function detectConfigFile(relativePath, text) {
  const normalized = toPosix(relativePath);
  const basename = path.posix.basename(normalized).toLowerCase();
  const reasons = [];
  if (MIGRATION_CONFIG_BASENAMES.has(basename)) reasons.push("migration-config-filename");
  if (
    /(?:^|\/)(?:schema\.prisma|drizzle\.config\.[cm]?[jt]s|knexfile\.[jt]s|typeorm\.config\.[jt]s|sequelize\.config\.[jt]s|dbmate\.ya?ml|supabase\/config\.toml)$/i.test(
      normalized,
    )
  ) {
    reasons.push("migration-tool-path");
  }
  if (reasons.length && /migrationsTable|migrationsDir|schema\s*:|out\s*:|migration/i.test(text)) {
    reasons.push("migration-config-indicator");
  }
  return reasons;
}

function detectPackageScriptKeys(relativePath, text) {
  if (path.posix.basename(toPosix(relativePath)) !== "package.json") return [];
  try {
    const parsed = JSON.parse(text);
    const scripts = parsed && typeof parsed === "object" ? parsed.scripts : null;
    if (!scripts || typeof scripts !== "object") return [];
    return Object.entries(scripts)
      .filter(([key, value]) => /migrat|prisma|drizzle|knex|dbmate|typeorm|sequelize/i.test(`${key} ${value}`))
      .map(([key]) => ({ path: relativePath, key }));
  } catch {
    return [{ path: relativePath, key: "unparseable-package-json" }];
  }
}

function detectRiskIndicators(relativePath, text) {
  const indicators = [];
  const checks = [
    ["drop-table", /\bDROP\s+TABLE\b/i],
    ["drop-column", /\bALTER\s+TABLE\b[\s\S]{0,240}\bDROP\s+(?:COLUMN\s+)?/i],
    ["truncate-table", /\bTRUNCATE\s+(?:TABLE\s+)?/i],
    ["delete-without-where", /\bDELETE\s+FROM\b(?![\s\S]{0,160}\bWHERE\b)/i],
    ["rename-object", /\b(?:RENAME\s+(?:TABLE|COLUMN)|ALTER\s+TABLE\b[\s\S]{0,240}\bRENAME\b)/i],
    ["not-null-addition", /\bALTER\s+TABLE\b[\s\S]{0,240}\bSET\s+NOT\s+NULL\b/i],
    ["unique-index-or-constraint", /\b(?:CREATE\s+UNIQUE\s+INDEX|UNIQUE\s+CONSTRAINT|ADD\s+CONSTRAINT\b[\s\S]{0,160}\bUNIQUE)\b/i],
    ["raw-data-update", /\bUPDATE\s+[A-Za-z0-9_.\"]+\s+SET\b/i],
  ];
  for (const [type, pattern] of checks) {
    if (pattern.test(text)) indicators.push({ path: relativePath, type });
  }
  return indicators;
}

function scanMigrations(projectRoot, files) {
  const migrationFiles = [];
  const schemaFiles = [];
  const configFiles = [];
  const packageScriptKeys = [];
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

    const migrationReasons = detectMigrationFile(relative, text);
    if (migrationReasons.length) {
      migrationFiles.push({ path: relative, reasons: [...new Set(migrationReasons)].sort() });
    }
    const schemaReasons = detectSchemaFile(relative, text);
    if (schemaReasons.length) {
      schemaFiles.push({ path: relative, reasons: [...new Set(schemaReasons)].sort() });
    }
    const configReasons = detectConfigFile(relative, text);
    if (configReasons.length) {
      configFiles.push({ path: relative, reasons: [...new Set(configReasons)].sort() });
    }
    packageScriptKeys.push(...detectPackageScriptKeys(relative, text));
    riskIndicators.push(...detectRiskIndicators(relative, text));
  }

  const byPath = (left, right) =>
    `${left.path}:${left.type ?? left.key ?? ""}`.localeCompare(`${right.path}:${right.type ?? right.key ?? ""}`);

  return {
    migrationFiles: migrationFiles.sort(byPath),
    schemaFiles: schemaFiles.sort(byPath),
    configFiles: configFiles.sort(byPath),
    packageScriptKeys: packageScriptKeys.sort(byPath),
    riskIndicators: riskIndicators.sort(byPath),
    warnings,
  };
}

export function buildMigrationReviewReport(projectRootInput, options = {}) {
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
      migrationFiles: [],
      schemaFiles: [],
      configFiles: [],
      packageScriptKeys: [],
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
      migrationFiles: [],
      schemaFiles: [],
      configFiles: [],
      packageScriptKeys: [],
      riskIndicators: [],
      skipped: [{ path: ".", reason: "project adapter is present but does not enable migration-review" }],
      warnings: [
        "migration-review is not enabled by the project adapter; target files were not read",
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
  const scanned = scanMigrations(projectRoot, collected.files);
  return {
    status: "complete",
    coreVersion: PILOT_VERSION,
    projectRoot,
    adapter: context,
    git,
    scopePaths: scope.scopePaths,
    ignoredPaths: scope.ignoredPaths,
    filesScanned: collected.files,
    migrationFiles: scanned.migrationFiles,
    schemaFiles: scanned.schemaFiles,
    configFiles: scanned.configFiles,
    packageScriptKeys: scanned.packageScriptKeys,
    riskIndicators: scanned.riskIndicators,
    skipped: collected.skipped,
    warnings: [
      ...git.warnings,
      ...scanned.warnings,
      ...(context.enabled ? ["migration-review used adapter-declared safe read paths only"] : []),
      ...(context.present ? [] : ["no project adapter declaration found; migration-review used generic bounded static scan"]),
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

export function renderMigrationReviewReport(report) {
  const lines = [
    "# Migration Review Report",
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
    `- Migration-review enabled: ${report.adapter.enabled ? "yes" : "no"}`,
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
    `- Migration files: ${report.migrationFiles.length}`,
    `- Schema files: ${report.schemaFiles.length}`,
    `- Config files: ${report.configFiles.length}`,
    `- Package script keys mentioning migrations: ${report.packageScriptKeys.length}`,
    `- Risk indicators: ${report.riskIndicators.length}`,
    `- Skipped items: ${report.skipped.length}`,
    "",
    "## Migration Files",
    ...renderRecords(report.migrationFiles, (record) => `- ${record.path}: ${record.reasons.join(", ")}`),
    "",
    "## Schema Files",
    ...renderRecords(report.schemaFiles, (record) => `- ${record.path}: ${record.reasons.join(", ")}`),
    "",
    "## Migration Config Files",
    ...renderRecords(report.configFiles, (record) => `- ${record.path}: ${record.reasons.join(", ")}`),
    "",
    "## Package Script Keys",
    ...renderRecords(
      report.packageScriptKeys,
      (record) => `- ${record.path}: ${record.key}`,
      "- none found; command values are not printed",
    ),
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
    "No database connection, migration execution, ORM generation, target project build, test, runtime, deployment, package installation, secret-file read, or project write was performed.",
  );
  return lines.join("\n");
}

export function migrationReviewCliResult(projectRootInput, options = {}) {
  if (!projectRootInput) {
    return {
      exitCode: 2,
      stream: "stderr",
      lines: ["usage: node scripts/render-migration-review.mjs <project-root>"],
    };
  }
  const report = buildMigrationReviewReport(projectRootInput, options);
  return {
    exitCode: report.status === "failed" ? 1 : 0,
    stream: report.status === "failed" ? "stderr" : "stdout",
    lines: renderMigrationReviewReport(report).split("\n"),
    report,
  };
}
