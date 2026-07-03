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
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const REFUSED_BEHAVIOR = [
  "no .env reads",
  "no secret-file reads",
  "no matched value printing",
  "no credential stores",
  "no credential rotation",
  "no API calls",
  "no target project builds",
  "no target project tests",
  "no package installs",
  "no deployments",
  "no migrations",
  "no project writes",
];

const NOT_VERIFIED = [
  "ignored secret files such as .env",
  "credential stores and local keychains",
  "runtime-injected secrets",
  "remote repository history",
  "cloud provider secret stores",
  "whether a redacted finding is active or revoked",
];

const SECRET_PATTERNS = [
  {
    type: "private-key",
    pattern:
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    type: "authorization-header",
    pattern: /Authorization:\s*Bearer\s+[A-Za-z0-9._-]{12,}/gi,
  },
  {
    type: "github-token",
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  },
  {
    type: "github-token",
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/gi,
  },
  {
    type: "jwt",
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  },
  {
    type: "url-credentials",
    pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^@\s/]+@[^\s]+/gi,
  },
  {
    type: "secret-assignment",
    pattern:
      /(?:^|\n)[A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PRIVATE_KEY|DATABASE_URL|API_KEY)=[^\s"'`]+/g,
  },
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

  if (!validation.acceptedSkills.includes("secret-audit")) {
    return {
      ok: true,
      present: true,
      enabled: false,
      projectRoot: loaded.projectRoot,
      mode: "adapter-present-secret-audit-not-enabled",
      declarationPath: loaded.declarationPath,
      declaration: loaded.declaration,
      validation,
      codes: ["secret-audit-not-enabled-by-adapter"],
    };
  }

  const adapters = [];
  const errors = [];
  const container = path.resolve(loaded.projectRoot, loaded.declaration.adapterRoot);
  if (!inside(loaded.projectRoot, container) || !fs.existsSync(container)) {
    errors.push("adapter-root-not-found");
  } else {
    for (const declaration of loaded.declaration.adapters ?? []) {
      if (!(declaration.skillIds ?? []).includes("secret-audit")) continue;
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
  const basename = path.posix.basename(toPosix(relativePath));
  if (basename === ".env.example") return true;
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
    skipped.push({ path: relative, reason: "not a secret-audit candidate file" });
    return;
  }
  files.push(relative);
}

function scanSecrets(projectRoot, files) {
  const findings = [];
  const warnings = [];
  for (const relative of files) {
    let text = "";
    try {
      text = fs.readFileSync(path.join(projectRoot, relative), "utf8");
    } catch {
      warnings.push(`could not read ${relative}`);
      continue;
    }
    for (const secretPattern of SECRET_PATTERNS) {
      secretPattern.pattern.lastIndex = 0;
      let count = 0;
      for (const _match of text.matchAll(secretPattern.pattern)) count += 1;
      if (count > 0) findings.push({ path: relative, type: secretPattern.type, count });
    }
  }
  return { findings: findings.sort((a, b) => `${a.path}:${a.type}`.localeCompare(`${b.path}:${b.type}`)), warnings };
}

export function buildSecretAuditReport(projectRootInput, options = {}) {
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
      findings: [],
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
      findings: [],
      skipped: [{ path: ".", reason: "project adapter is present but does not enable secret-audit" }],
      warnings: [
        "secret-audit is not enabled by the project adapter; target files were not read",
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
  const scanned = scanSecrets(projectRoot, collected.files);
  return {
    status: "complete",
    coreVersion: PILOT_VERSION,
    projectRoot,
    adapter: context,
    git,
    scopePaths: scope.scopePaths,
    ignoredPaths: scope.ignoredPaths,
    filesScanned: collected.files,
    findings: scanned.findings,
    skipped: collected.skipped,
    warnings: [
      ...git.warnings,
      ...scanned.warnings,
      ...(context.enabled ? ["secret-audit used adapter-declared safe read paths only"] : []),
      ...(context.present ? [] : ["no project adapter declaration found; secret-audit used generic bounded static scan"]),
    ],
    notVerified: NOT_VERIFIED,
    refusedBehavior: REFUSED_BEHAVIOR,
  };
}

export function renderSecretAuditReport(report) {
  const totalFindings = report.findings.reduce((sum, finding) => sum + finding.count, 0);
  const lines = [
    "# Secret Audit Report",
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
    `- Secret-audit enabled: ${report.adapter.enabled ? "yes" : "no"}`,
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
    `- Secret-like findings: ${totalFindings}`,
    `- Files with findings: ${new Set(report.findings.map((finding) => finding.path)).size}`,
    `- Skipped items: ${report.skipped.length}`,
    "",
    "## Findings",
  ];
  if (report.findings.length) {
    for (const finding of report.findings) {
      lines.push(`- ${finding.path}: ${finding.count} ${finding.type} match(es); values omitted`);
    }
  } else {
    lines.push("- none found");
  }

  lines.push("", "## Skipped");
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
    "No .env, secret-file, credential-store, API, build, test, deploy, migration, package-install, value-printing, rotation, or project-write behavior was performed.",
  );
  return lines.join("\n");
}

export function secretAuditCliResult(projectRootInput, options = {}) {
  if (!projectRootInput) {
    return {
      exitCode: 2,
      stream: "stderr",
      lines: ["usage: node scripts/render-secret-audit.mjs <project-root>"],
    };
  }
  const report = buildSecretAuditReport(projectRootInput, options);
  return {
    exitCode: report.status === "failed" ? 1 : 0,
    stream: report.status === "failed" ? "stderr" : "stdout",
    lines: renderSecretAuditReport(report).split("\n"),
    report,
  };
}
