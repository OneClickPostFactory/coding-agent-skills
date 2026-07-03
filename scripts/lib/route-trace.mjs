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

const ROUTE_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);

const CONFIG_FILENAMES = new Set([
  "routes.js",
  "routes.jsx",
  "routes.ts",
  "routes.tsx",
  "router.js",
  "router.jsx",
  "router.ts",
  "router.tsx",
  "route-config.js",
  "route-config.ts",
]);

const REFUSED_BEHAVIOR = [
  "no target project builds",
  "no target project tests",
  "no dev servers",
  "no package installs",
  "no app-code execution",
  "no runtime URL probing",
  "no deployments",
  "no migrations",
  "no database inspection",
  "no secret-file reads",
  "no project writes",
];

const NOT_VERIFIED = [
  "runtime-generated routes",
  "middleware rewrites and redirects that require execution",
  "environment-dependent routing",
  "framework plugin routes loaded outside inspected static files",
  "remote or deployed URLs",
];

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function uniqueBy(values, key) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const marker = key(value);
    if (seen.has(marker)) continue;
    seen.add(marker);
    output.push(value);
  }
  return output;
}

function safeRelativePath(candidate) {
  return (
    typeof candidate === "string" &&
    candidate.length > 0 &&
    !candidate.startsWith("/") &&
    !candidate.split(/[\\/]+/).includes("..") &&
    !/(^|\/)\.env(?:\.|$)/.test(candidate)
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
  if (summary.hasUncommittedChanges) {
    summary.warnings.push("working tree has local changes; filenames omitted");
  }
  if (/\[(?:ahead|behind|gone|diverged)[^\]]*\]/i.test(summary.branchState ?? "")) {
    summary.warnings.push("branch state indicates remote divergence; revalidate after update");
  }
  return summary;
}

function discoverRouteTraceAdapters(loaded) {
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
    if (!(declaration.skillIds ?? []).includes("route-trace")) continue;
    const match = manifestCandidates.find(
      (candidate) => candidate.manifest.adapterId === declaration.id,
    );
    if (!match) {
      errors.push("declared-route-trace-adapter-not-found");
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

  if (!validation.acceptedSkills.includes("route-trace")) {
    return {
      ok: true,
      present: true,
      enabled: false,
      projectRoot: loaded.projectRoot,
      mode: "adapter-present-route-trace-not-enabled",
      declarationPath: loaded.declarationPath,
      declaration: loaded.declaration,
      validation,
      codes: ["route-trace-not-enabled-by-adapter"],
    };
  }

  const { adapters, errors } = discoverRouteTraceAdapters(loaded);
  if (errors.length > 0 || adapters.length === 0) {
    return {
      ok: false,
      present: true,
      enabled: false,
      status: "failed",
      codes: errors.length ? [...new Set(errors)] : ["route-trace-adapter-not-found"],
      validation,
    };
  }

  return {
    ok: true,
    present: true,
    enabled: true,
    projectRoot: loaded.projectRoot,
    mode: "adapter-limited",
    declarationPath: loaded.declarationPath,
    declaration: loaded.declaration,
    adapters,
    validation,
    codes: [],
  };
}

function routeFromNextApp(relativePath) {
  const normalized = toPosix(relativePath);
  const parts = normalized.split("/");
  const appIndex = parts.lastIndexOf("app");
  if (appIndex === -1) return null;

  const filename = parts.at(-1);
  if (!/^(?:page|route)\.(?:jsx?|tsx?|mjs|cjs)$/.test(filename)) return null;

  const routeSegments = parts
    .slice(appIndex + 1, -1)
    .filter(
      (segment) =>
        segment &&
        !(segment.startsWith("(") && segment.endsWith(")")) &&
        !segment.startsWith("@"),
    );
  const route = `/${routeSegments.join("/")}`.replace(/\/+/g, "/");
  return {
    route: route === "/" ? "/" : route.replace(/\/$/g, ""),
    kind: filename.startsWith("route.") ? "next-app-api-route-file" : "next-app-page-file",
  };
}

function stripRouteExtension(filename) {
  return filename.replace(/\.(?:jsx?|tsx?|mjs|cjs)$/i, "");
}

function routeFromPages(relativePath) {
  const normalized = toPosix(relativePath);
  const parts = normalized.split("/");
  const pagesIndex = parts.lastIndexOf("pages");
  if (pagesIndex === -1) return null;

  const filename = parts.at(-1);
  if (!ROUTE_EXTENSIONS.has(path.posix.extname(filename))) return null;

  const routeSegments = [...parts.slice(pagesIndex + 1, -1), stripRouteExtension(filename)];
  if (routeSegments.some((segment) => /^_(?:app|document|error)$/.test(segment))) return null;
  if (routeSegments.at(-1) === "index") routeSegments.pop();
  const route = `/${routeSegments.join("/")}`.replace(/\/+/g, "/");
  return {
    route: route === "/" ? "/" : route.replace(/\/$/g, ""),
    kind: routeSegments[0] === "api" ? "next-pages-api-route-file" : "next-pages-route-file",
  };
}

function routeFileFinding(relativePath) {
  const appRoute = routeFromNextApp(relativePath);
  if (appRoute) {
    return {
      route: appRoute.route,
      file: relativePath,
      kind: appRoute.kind,
      confidence: "verified-route-file",
    };
  }
  const pagesRoute = routeFromPages(relativePath);
  if (pagesRoute) {
    return {
      route: pagesRoute.route,
      file: relativePath,
      kind: pagesRoute.kind,
      confidence: "verified-route-file",
    };
  }
  return null;
}

function inferRoutePatterns(relativePath, source) {
  const findings = [];
  const patterns = [
    {
      kind: "react-router-route-declaration",
      regex: /<Route\b[^>]*\bpath=["'`]([^"'`]+)["'`]/g,
      method: null,
    },
    {
      kind: "route-config-path",
      regex: /\bpath\s*:\s*["'`]([^"'`]+)["'`]/g,
      method: null,
    },
    {
      kind: "express-style-route-registration",
      regex: /\b(?:app|router|server)\.(get|post|put|patch|delete|all)\s*\(\s*["'`]([^"'`]+)["'`]/g,
      methodIndex: 1,
      routeIndex: 2,
    },
    {
      kind: "fastify-route-registration",
      regex: /\bfastify\.(get|post|put|patch|delete|all)\s*\(\s*["'`]([^"'`]+)["'`]/g,
      methodIndex: 1,
      routeIndex: 2,
    },
    {
      kind: "hono-route-registration",
      regex: /\b(?:app|router|hono)\.(get|post|put|patch|delete|all)\s*\(\s*["'`]([^"'`]+)["'`]/g,
      methodIndex: 1,
      routeIndex: 2,
    },
    {
      kind: "object-route-registration",
      regex: /\b(?:url|path)\s*:\s*["'`]([^"'`]+)["'`]/g,
      method: null,
    },
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern.regex)) {
      const route = match[pattern.routeIndex ?? 1];
      if (!route || !route.startsWith("/")) continue;
      findings.push({
        route,
        method: pattern.methodIndex ? match[pattern.methodIndex].toUpperCase() : null,
        file: relativePath,
        kind: pattern.kind,
        confidence: "inferred-route-pattern",
      });
    }
  }

  return findings;
}

function collectFiles(projectRoot, scopePaths, ignoredPaths, options = {}) {
  const maxFiles = options.maxFiles ?? 1200;
  const maxDepth = options.maxDepth ?? 8;
  const files = [];
  const skipped = [];

  function addSkip(relativePath, reason) {
    skipped.push({
      path: relativePath || ".",
      reason,
    });
  }

  function visit(absolutePath, relativePath, depth) {
    if (files.length >= maxFiles) {
      addSkip(relativePath, "file limit reached");
      return;
    }
    if (!inside(projectRoot, absolutePath)) {
      addSkip(relativePath, "outside project root");
      return;
    }
    if (secretBearingPath(relativePath)) {
      addSkip(relativePath, "secret-bearing path");
      return;
    }
    if (ignoredBy(relativePath, ignoredPaths)) {
      addSkip(relativePath, "ignored path");
      return;
    }

    const stat = fs.lstatSync(absolutePath);
    if (stat.isSymbolicLink()) {
      addSkip(relativePath, "symlink skipped");
      return;
    }
    if (stat.isDirectory()) {
      if (depth > maxDepth) {
        addSkip(relativePath, "maximum depth reached");
        return;
      }
      for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
        visit(
          path.join(absolutePath, entry.name),
          toPosix(path.join(relativePath, entry.name)),
          depth + 1,
        );
      }
      return;
    }
    if (!stat.isFile()) {
      addSkip(relativePath, "non-regular file");
      return;
    }
    if (stat.size > (options.maxFileBytes ?? 262144)) {
      addSkip(relativePath, "file too large for static route scan");
      return;
    }

    const extension = path.extname(relativePath);
    const basename = path.basename(relativePath);
    const isRouteConfig = CONFIG_FILENAMES.has(basename);
    if (!ROUTE_EXTENSIONS.has(extension) && !isRouteConfig && basename !== "package.json") {
      return;
    }
    files.push(relativePath);
  }

  for (const scopePath of scopePaths) {
    if (scopePath !== "." && !safeRelativePath(scopePath)) {
      addSkip(String(scopePath), "unsafe scope path");
      continue;
    }
    const absolute = path.resolve(projectRoot, scopePath);
    if (!inside(projectRoot, absolute)) {
      addSkip(scopePath, "scope path outside project root");
      continue;
    }
    if (!fs.existsSync(absolute)) {
      addSkip(scopePath, "scope path missing");
      continue;
    }
    visit(absolute, scopePath === "." ? "" : scopePath, 0);
  }

  return {
    files: uniqueBy(files, (file) => file).sort(),
    skipped: uniqueBy(skipped, (record) => `${record.path}:${record.reason}`),
  };
}

function scanFiles(projectRoot, files) {
  const verifiedRouteFiles = [];
  const inferredRoutePatterns = [];
  const skipped = [];

  for (const relativePath of files) {
    const routeFile = routeFileFinding(relativePath);
    if (routeFile) verifiedRouteFiles.push(routeFile);

    const basename = path.basename(relativePath);
    if (!ROUTE_EXTENSIONS.has(path.extname(relativePath)) && !CONFIG_FILENAMES.has(basename)) {
      continue;
    }

    try {
      const source = fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
      inferredRoutePatterns.push(...inferRoutePatterns(relativePath, source));
    } catch {
      skipped.push({
        path: relativePath,
        reason: "file could not be read as utf8",
      });
    }
  }

  return {
    verifiedRouteFiles: uniqueBy(
      verifiedRouteFiles,
      (record) => `${record.route}:${record.file}:${record.kind}`,
    ).sort((a, b) => `${a.route}:${a.file}`.localeCompare(`${b.route}:${b.file}`)),
    inferredRoutePatterns: uniqueBy(
      inferredRoutePatterns,
      (record) => `${record.method ?? ""}:${record.route}:${record.file}:${record.kind}`,
    ).sort((a, b) => `${a.route}:${a.file}`.localeCompare(`${b.route}:${b.file}`)),
    skipped,
  };
}

function adapterScope(context) {
  if (!context.enabled) return null;
  const safeReadPaths = uniqueBy(
    context.adapters.flatMap((adapter) => adapter.manifest.extensions.safeReadPaths ?? []),
    (value) => value,
  );
  const ignoredPaths = uniqueBy(
    [
      ...DEFAULT_IGNORED_PATHS,
      ...context.adapters.flatMap((adapter) => adapter.manifest.extensions.ignoredPaths ?? []),
    ],
    (value) => value,
  );
  return {
    adapterIds: context.adapters.map((adapter) => adapter.manifest.adapterId).sort(),
    manifestPaths: context.adapters.map((adapter) => adapter.manifestPath).sort(),
    scopePaths: safeReadPaths.length ? safeReadPaths : [],
    ignoredPaths,
    requiredEvidence: uniqueBy(
      context.adapters.flatMap((adapter) => adapter.manifest.extensions.requiredEvidence ?? []),
      (value) => value,
    ),
  };
}

export function buildRouteTraceReport(projectRootInput, options = {}) {
  if (!projectRootInput) {
    return {
      ok: false,
      status: "failed",
      codes: ["missing-project-root"],
    };
  }

  const coreRoot = path.resolve(options.coreRoot ?? DEFAULT_CORE_ROOT);
  const projectRoot = path.resolve(projectRootInput);
  if (!fs.existsSync(projectRoot) || !fs.lstatSync(projectRoot).isDirectory()) {
    return {
      ok: false,
      status: "failed",
      codes: ["project-root-not-found"],
    };
  }

  const context = adapterContext(projectRoot, coreRoot);
  if (!context.ok) {
    return {
      ok: false,
      status: "failed",
      codes: context.codes,
      adapter: {
        present: context.present,
        enabled: false,
      },
    };
  }

  const git = gitSummary(projectRoot);
  if (context.present && !context.enabled) {
    return {
      ok: true,
      status: "partial",
      coreVersion: PILOT_VERSION,
      projectRoot,
      adapter: {
        present: true,
        enabled: false,
        mode: context.mode,
        declarationPath: context.declarationPath,
        codes: context.codes,
      },
      git,
      scannedFiles: [],
      verifiedRouteFiles: [],
      inferredRoutePatterns: [],
      skipped: [
        {
          path: ".",
          reason: "project adapter is present but route-trace is not enabled; no route files read",
        },
      ],
      notVerified: NOT_VERIFIED,
      refusedBehavior: REFUSED_BEHAVIOR,
      warnings: [
        ...git.warnings,
        "adapter-limited scope prevented route-trace from reading target files",
      ],
    };
  }

  const scope = adapterScope(context);
  const scopePaths = scope?.scopePaths ?? ["."];
  const ignoredPaths = scope?.ignoredPaths ?? DEFAULT_IGNORED_PATHS;
  const collected = collectFiles(projectRoot, scopePaths, ignoredPaths, options);
  const scanned = scanFiles(projectRoot, collected.files);

  return {
    ok: true,
    status: "complete",
    coreVersion: PILOT_VERSION,
    projectRoot,
    adapter: context.present
      ? {
          present: true,
          enabled: true,
          mode: "adapter-limited",
          declarationPath: context.declarationPath,
          adapterIds: scope.adapterIds,
          manifestPaths: scope.manifestPaths,
          scopePaths,
          ignoredPaths,
          requiredEvidence: scope.requiredEvidence,
        }
      : {
          present: false,
          enabled: false,
          mode: "generic-static",
          scopePaths,
          ignoredPaths,
          requiredEvidence: [],
        },
    git,
    scannedFiles: collected.files,
    verifiedRouteFiles: scanned.verifiedRouteFiles,
    inferredRoutePatterns: scanned.inferredRoutePatterns,
    skipped: uniqueBy([...collected.skipped, ...scanned.skipped], (record) => `${record.path}:${record.reason}`),
    notVerified: NOT_VERIFIED,
    refusedBehavior: REFUSED_BEHAVIOR,
    warnings: uniqueBy(
      [
        ...git.warnings,
        context.present
          ? "route-trace used adapter-declared safe read paths only"
          : "no project adapter declaration found; route-trace used generic bounded static scan",
      ],
      (value) => value,
    ),
  };
}

function listRecords(title, records, formatter) {
  if (!records.length) return [`## ${title}`, "- none"];
  return [`## ${title}`, ...records.map(formatter)];
}

export function renderRouteTraceReport(report) {
  if (!report.ok) {
    return [
      "# Route Trace Report",
      "",
      `Status: ${report.status}`,
      `Rejection codes: ${(report.codes ?? []).join(", ")}`,
      "",
      "No target project build, test, runtime, deployment, migration, package installation, app-code execution, or secret-file read was performed.",
    ].join("\n");
  }

  const lines = [
    "# Route Trace Report",
    "",
    `Status: ${report.status}`,
    `Core version: ${report.coreVersion}`,
    `Project root: ${redactSensitiveText(report.projectRoot)}`,
    "",
    "## Git State",
    `- Git root: ${redactSensitiveText(report.git.root ?? "not detected")}`,
    `- Branch state: ${redactSensitiveText(report.git.branchState ?? "not detected")}`,
    `- Local changes: ${report.git.hasUncommittedChanges ? "present; filenames omitted" : "not detected"}`,
    "",
    "## Adapter Scope",
    `- Adapter present: ${report.adapter.present ? "yes" : "no"}`,
    `- Route-trace enabled: ${report.adapter.enabled ? "yes" : "no"}`,
    `- Mode: ${report.adapter.mode}`,
  ];

  if (report.adapter.declarationPath) {
    lines.push(`- Declaration: ${report.adapter.declarationPath}`);
  }
  if (report.adapter.adapterIds?.length) {
    lines.push(`- Adapter IDs: ${report.adapter.adapterIds.join(", ")}`);
  }
  if (report.adapter.manifestPaths?.length) {
    lines.push(`- Adapter manifests: ${report.adapter.manifestPaths.join(", ")}`);
  }

  lines.push(
    "",
    "## Scope Paths",
    ...(report.adapter.scopePaths?.length ? report.adapter.scopePaths.map((item) => `- ${item}`) : ["- none; route tracing skipped"]),
    "",
    "## Ignored Paths",
    ...(report.adapter.ignoredPaths?.length ? report.adapter.ignoredPaths.map((item) => `- ${item}`) : ["- none declared"]),
    "",
    "## Summary",
    `- Static files scanned: ${report.scannedFiles.length}`,
    `- Verified route files: ${report.verifiedRouteFiles.length}`,
    `- Inferred route patterns: ${report.inferredRoutePatterns.length}`,
    `- Skipped items: ${report.skipped.length}`,
    "",
    ...listRecords(
      "Verified Route Files",
      report.verifiedRouteFiles,
      (record) => `- ${record.route} (${record.kind}) in ${record.file}`,
    ),
    "",
    ...listRecords(
      "Inferred Route Patterns",
      report.inferredRoutePatterns,
      (record) =>
        `- ${record.method ? `${record.method} ` : ""}${record.route} (${record.kind}) in ${record.file}`,
    ),
    "",
    ...listRecords(
      "Skipped",
      report.skipped,
      (record) => `- ${record.path}: ${record.reason}`,
    ),
    "",
    ...listRecords("Not Verified", report.notVerified, (item) => `- ${item}`),
    "",
    ...listRecords("Warnings", report.warnings, (item) => `- ${item}`),
    "",
    ...listRecords("Refused Behavior", report.refusedBehavior, (item) => `- ${item}`),
    "",
    "No target project build, test, runtime, deployment, migration, package installation, app-code execution, or secret-file read was performed.",
  );

  return lines.join("\n");
}

export function routeTraceCliResult(projectRoot, options = {}) {
  if (!projectRoot) {
    return {
      exitCode: 2,
      stream: "stderr",
      lines: ["usage: node scripts/render-route-trace.mjs <project-root>"],
    };
  }

  const report = buildRouteTraceReport(projectRoot, options);
  return {
    exitCode: report.ok ? 0 : 1,
    stream: report.ok ? "stdout" : "stderr",
    lines: renderRouteTraceReport(report).split("\n"),
    report,
  };
}
