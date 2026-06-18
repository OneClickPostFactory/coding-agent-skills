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

const REFUSED_BEHAVIOR = [
  "no target project builds",
  "no target project tests",
  "no package installs",
  "no runtime checks",
  "no deployments",
  "no migrations",
  "no secret-file reads",
  "no project writes",
];

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function unique(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value))];
}

function describeApprovedPath(projectRoot, relativePath) {
  if (
    typeof relativePath !== "string" ||
    !relativePath ||
    relativePath.startsWith("/") ||
    relativePath.split(/[\\/]+/).includes("..") ||
    /(^|\/)\.env(?:\.|$)/.test(relativePath)
  ) {
    return {
      path: String(relativePath),
      status: "unsafe",
      type: "unknown",
    };
  }

  const absolute = path.resolve(projectRoot, relativePath);
  if (!inside(projectRoot, absolute)) {
    return {
      path: relativePath,
      status: "unsafe",
      type: "unknown",
    };
  }

  let current = projectRoot;
  for (const segment of path.relative(projectRoot, absolute).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) {
      return {
        path: relativePath,
        status: "missing",
        type: "unknown",
      };
    }
    if (fs.lstatSync(current).isSymbolicLink()) {
      return {
        path: relativePath,
        status: "symlink",
        type: "unknown",
      };
    }
  }

  const stat = fs.lstatSync(absolute);
  return {
    path: relativePath,
    status: "present",
    type: stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other",
  };
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

function loadRepoMapAdapters(loaded) {
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
    if (!(declaration.skillIds ?? []).includes("repo-map")) continue;
    const match = manifestCandidates.find(
      (candidate) => candidate.manifest.adapterId === declaration.id,
    );
    if (!match) {
      errors.push("declared-repo-map-adapter-not-found");
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

export function buildAdapterRepoMapReport(projectRootInput, options = {}) {
  const coreRoot = path.resolve(options.coreRoot ?? DEFAULT_CORE_ROOT);
  const validation = validateProjectAdapters(projectRootInput, { coreRoot });
  if (!validation.ok) {
    return {
      ok: false,
      status: "failed",
      codes: validation.codes,
      validation,
    };
  }
  if (!validation.acceptedSkills.includes("repo-map")) {
    return {
      ok: false,
      status: "failed",
      codes: ["repo-map-not-enabled"],
      validation,
    };
  }

  const loaded = readProjectAdapterDeclaration(projectRootInput);
  if (!loaded.ok) {
    return {
      ok: false,
      status: "failed",
      codes: loaded.codes,
      validation,
    };
  }

  const { adapters, errors } = loadRepoMapAdapters(loaded);
  if (errors.length > 0 || adapters.length === 0) {
    return {
      ok: false,
      status: "failed",
      codes: errors.length > 0 ? unique(errors) : ["repo-map-adapter-not-found"],
      validation,
    };
  }

  const rootMarkers = adapters.flatMap(
    (adapter) => adapter.manifest.project?.detection?.rootMarkers ?? [],
  );
  const maximumDepth = Math.max(
    ...adapters.map((adapter) => adapter.manifest.project?.detection?.maximumDepth ?? 0),
  );
  const documentationPrecedence = unique(
    adapters.flatMap((adapter) => adapter.manifest.extensions.documentationPrecedence),
  ).map((relativePath) => describeApprovedPath(loaded.projectRoot, relativePath));
  const safeReadPaths = unique(
    adapters.flatMap((adapter) => adapter.manifest.extensions.safeReadPaths),
  ).map((relativePath) => describeApprovedPath(loaded.projectRoot, relativePath));
  const ignoredPaths = unique(
    adapters.flatMap((adapter) => adapter.manifest.extensions.ignoredPaths),
  );
  const requiredEvidence = unique(
    adapters.flatMap((adapter) => adapter.manifest.extensions.requiredEvidence),
  );
  const packageManagers = unique(
    adapters.flatMap((adapter) => adapter.manifest.extensions.expectedPackageManagers),
  );
  const git = gitSummary(loaded.projectRoot);

  return {
    ok: true,
    status: "complete",
    coreVersion: PILOT_VERSION,
    projectRoot: loaded.projectRoot,
    declarationPath: loaded.declarationPath,
    adapterRoot: loaded.declaration.adapterRoot,
    projectId: loaded.declaration.projectId,
    adapterIds: adapters.map((adapter) => adapter.manifest.adapterId).sort(),
    manifestPaths: adapters.map((adapter) => adapter.manifestPath).sort(),
    enabledSkills: ["repo-map"],
    rootMarkers,
    maximumDepth,
    scope: "declared-project-root",
    requireApprovalOutsideScope: true,
    documentationPrecedence,
    safeReadPaths,
    ignoredPaths,
    requiredEvidence,
    packageManagers,
    git,
    warnings: unique([
      ...git.warnings,
      "adapter-aware repo-map is metadata-only and read-only",
    ]),
    refusedBehavior: REFUSED_BEHAVIOR,
    validation,
  };
}

function formatPathRecord(record, index, numbered = false) {
  const prefix = numbered ? `${index + 1}.` : "-";
  return `${prefix} ${record.path} (${record.type} ${record.status})`;
}

function formatList(title, values) {
  if (!values.length) return [`## ${title}`, "- none declared"];
  return [`## ${title}`, ...values.map((value) => `- ${value}`)];
}

export function renderAdapterRepoMapReport(report) {
  if (!report.ok) {
    return [
      "# Adapter-Aware Repo Map",
      "",
      `Status: ${report.status}`,
      `Rejection codes: ${(report.codes ?? []).join(", ")}`,
    ].join("\n");
  }

  const lines = [
    "# Adapter-Aware Repo Map",
    "",
    `Status: ${report.status}`,
    `Core version: ${report.coreVersion}`,
    `Project ID: ${report.projectId}`,
    `Project root: ${redactSensitiveText(report.projectRoot)}`,
    `Declaration: ${report.declarationPath}`,
    `Adapter root: ${report.adapterRoot}`,
    `Adapter IDs: ${report.adapterIds.join(", ")}`,
    `Adapter manifests: ${report.manifestPaths.join(", ")}`,
    `Enabled skills: ${report.enabledSkills.join(", ")}`,
    "",
    "## Git State",
    `- Git root: ${redactSensitiveText(report.git.root ?? "not detected")}`,
    `- Branch state: ${redactSensitiveText(report.git.branchState ?? "not detected")}`,
    `- Local changes: ${report.git.hasUncommittedChanges ? "present; filenames omitted" : "not detected"}`,
    "",
    "## Adapter Bounds",
    `- Scope: ${report.scope}`,
    `- Maximum detection depth: ${report.maximumDepth}`,
    `- Approval outside scope: ${report.requireApprovalOutsideScope ? "required" : "not declared"}`,
    ...report.rootMarkers.map(
      (marker) => `- Root marker: ${marker.kind} ${marker.path}`,
    ),
    "",
    "## Documentation Precedence",
    ...(report.documentationPrecedence.length
      ? report.documentationPrecedence.map((record, index) =>
          formatPathRecord(record, index, true),
        )
      : ["- none declared"]),
    "",
    "## Safe Read Paths",
    ...(report.safeReadPaths.length
      ? report.safeReadPaths.map((record, index) => formatPathRecord(record, index))
      : ["- none declared"]),
    "",
    ...formatList("Ignored Paths", report.ignoredPaths),
    "",
    ...formatList("Required Evidence", report.requiredEvidence),
    "",
    ...formatList("Package Manager Hints", report.packageManagers),
    "",
    ...formatList("Warnings", report.warnings),
    "",
    ...formatList("Refused Behavior", report.refusedBehavior),
    "",
    "No target project build, test, runtime, deployment, migration, package installation, or secret-file read was performed.",
  ];

  return lines.join("\n");
}

export function adapterRepoMapCliResult(projectRoot, options = {}) {
  if (!projectRoot) {
    return {
      exitCode: 2,
      stream: "stderr",
      lines: ["usage: node scripts/render-adapter-repo-map.mjs <project-root>"],
    };
  }

  const report = buildAdapterRepoMapReport(projectRoot, options);
  return {
    exitCode: report.ok ? 0 : 1,
    stream: report.ok ? "stdout" : "stderr",
    lines: renderAdapterRepoMapReport(report).split("\n"),
    report,
  };
}
