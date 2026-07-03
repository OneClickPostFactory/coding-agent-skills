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

const SKILL_ID = "github-handoff";

const REFUSED_BEHAVIOR = [
  "no commits",
  "no pushes",
  "no tags",
  "no branch changes",
  "no pull request creation",
  "no GitHub API mutations",
  "no token reads",
  "no secret-file reads",
  "no project writes",
];

const NOT_VERIFIED = [
  "remote repository permissions",
  "GitHub pull request state",
  "GitHub issue state",
  "GitHub Actions or CI status",
  "whether local commits have been pushed",
  "reviewer assignment or approval state",
  "release publication state",
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

function runGit(projectRoot, args) {
  const result = spawnSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout.trim(),
  };
}

function parseStatusEntry(line) {
  const code = line.slice(0, 2);
  const rawPath = line.slice(3).trim();
  const paths = rawPath.split(" -> ");
  const redacted = paths.some(secretBearingPath);
  return {
    code,
    path: redacted ? "[REDACTED:secret-bearing-path]" : rawPath,
    redacted,
    category: categorizeStatus(code),
  };
}

function categorizeStatus(code) {
  if (code.includes("U") || code === "AA" || code === "DD") return "conflicted";
  if (code === "??") return "untracked";
  if (code.includes("A")) return "added";
  if (code.includes("D")) return "deleted";
  if (code.includes("R")) return "renamed";
  if (code.includes("C")) return "copied";
  if (code.includes("M")) return "modified";
  return "other";
}

function summarizeChanges(entries) {
  const summary = {
    total: entries.length,
    added: 0,
    copied: 0,
    deleted: 0,
    modified: 0,
    renamed: 0,
    untracked: 0,
    conflicted: 0,
    other: 0,
    redacted: 0,
  };
  for (const entry of entries) {
    summary[entry.category] += 1;
    if (entry.redacted) summary.redacted += 1;
  }
  return summary;
}

function gitSummary(projectRoot) {
  const summary = {
    isGitRepo: false,
    root: null,
    branchState: null,
    branch: null,
    head: null,
    headShort: null,
    headSubject: null,
    tagsAtHead: [],
    remoteNames: [],
    changedFiles: [],
    changeSummary: summarizeChanges([]),
    warnings: [],
  };

  const revParse = runGit(projectRoot, ["rev-parse", "--show-toplevel"]);
  if (!revParse.ok) {
    summary.warnings.push("git repository not detected");
    return summary;
  }
  summary.isGitRepo = true;
  summary.root = revParse.stdout;

  const status = runGit(projectRoot, ["status", "--short", "--branch"]);
  if (!status.ok) {
    summary.warnings.push("git status unavailable");
  } else {
    const lines = status.stdout.split(/\r?\n/).filter(Boolean);
    summary.branchState = lines[0] ?? null;
    summary.changedFiles = lines.slice(1).map(parseStatusEntry);
    summary.changeSummary = summarizeChanges(summary.changedFiles);
    if (summary.changedFiles.length) summary.warnings.push("working tree has local changes");
    if (summary.changeSummary.redacted) {
      summary.warnings.push("one or more changed paths were redacted because they look secret-bearing");
    }
    if (/\[(?:ahead|behind|gone|diverged)[^\]]*\]/i.test(summary.branchState ?? "")) {
      summary.warnings.push("branch state indicates remote divergence; revalidate before handoff");
    }
  }

  const branch = runGit(projectRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch.ok) summary.branch = branch.stdout;

  const head = runGit(projectRoot, ["rev-parse", "HEAD"]);
  if (head.ok) {
    summary.head = head.stdout;
    summary.headShort = head.stdout.slice(0, 12);
  }

  const subject = runGit(projectRoot, ["log", "-1", "--format=%s"]);
  if (subject.ok) summary.headSubject = subject.stdout;

  const tags = runGit(projectRoot, ["tag", "--points-at", "HEAD"]);
  if (tags.ok) summary.tagsAtHead = tags.stdout ? tags.stdout.split(/\r?\n/).filter(Boolean).sort() : [];

  const remotes = runGit(projectRoot, ["remote"]);
  if (remotes.ok) summary.remoteNames = remotes.stdout ? remotes.stdout.split(/\r?\n/).filter(Boolean).sort() : [];

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
      mode: "adapter-present-github-handoff-not-enabled",
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

function adapterEvidence(context) {
  const ignoredPaths = new Set([".git", "node_modules", "dist", "build", "coverage", "validation-output"]);
  const requiredEvidence = new Set(["branch state", "HEAD", "working-tree state", "changed-file summary"]);
  for (const adapter of context.adapters ?? []) {
    for (const candidate of adapter.manifest.extensions?.ignoredPaths ?? []) {
      if (safeRelativePath(candidate)) ignoredPaths.add(candidate);
    }
    for (const candidate of adapter.manifest.extensions?.requiredEvidence ?? []) {
      if (typeof candidate === "string" && candidate.trim()) requiredEvidence.add(candidate);
    }
  }
  return {
    ignoredPaths: [...ignoredPaths].sort(),
    requiredEvidence: [...requiredEvidence].sort(),
  };
}

export function buildGithubHandoffReport(projectRootInput, options = {}) {
  const coreRoot = options.coreRoot ?? DEFAULT_CORE_ROOT;
  const context = adapterContext(projectRootInput, coreRoot);
  const projectRoot = context.projectRoot ?? path.resolve(projectRootInput ?? ".");
  const git = gitSummary(projectRoot);
  const base = {
    coreVersion: PILOT_VERSION,
    projectRoot,
    adapter: context,
    git,
    ignoredPaths: [".git", "node_modules", "dist", "build", "coverage", "validation-output"],
    requiredEvidence: ["branch state", "HEAD", "working-tree state", "changed-file summary"],
    changedFiles: [],
    changeSummary: summarizeChanges([]),
    skipped: [],
    warnings: [...git.warnings],
    notVerified: NOT_VERIFIED,
    refusedBehavior: REFUSED_BEHAVIOR,
  };

  if (!context.ok) {
    return {
      ...base,
      status: "failed",
      warnings: [...(context.codes ?? []), ...git.warnings],
    };
  }

  if (!git.isGitRepo) {
    return {
      ...base,
      status: "failed",
      skipped: [{ path: ".", reason: "project root is not a Git repository" }],
    };
  }

  if (context.present && !context.enabled) {
    return {
      ...base,
      status: "partial",
      skipped: [{ path: ".", reason: "project adapter is present but does not enable github-handoff" }],
      warnings: [
        "github-handoff is not enabled by the project adapter; changed-file details were not listed",
        ...git.warnings,
      ],
    };
  }

  const evidence = context.enabled ? adapterEvidence(context) : {
    ignoredPaths: base.ignoredPaths,
    requiredEvidence: base.requiredEvidence,
  };

  return {
    ...base,
    status: "complete",
    ignoredPaths: evidence.ignoredPaths,
    requiredEvidence: evidence.requiredEvidence,
    changedFiles: git.changedFiles,
    changeSummary: git.changeSummary,
    warnings: [
      ...git.warnings,
      ...(context.enabled ? ["github-handoff used adapter-declared handoff evidence metadata"] : []),
      "remote URLs were not printed to avoid credential exposure",
    ],
  };
}

function listOrNone(items) {
  return items.length ? items.join(", ") : "none";
}

function renderChangeSummary(summary) {
  return [
    `- Total changed entries: ${summary.total}`,
    `- Added: ${summary.added}`,
    `- Modified: ${summary.modified}`,
    `- Deleted: ${summary.deleted}`,
    `- Renamed: ${summary.renamed}`,
    `- Copied: ${summary.copied}`,
    `- Untracked: ${summary.untracked}`,
    `- Conflicted: ${summary.conflicted}`,
    `- Redacted paths: ${summary.redacted}`,
  ];
}

export function renderGithubHandoffReport(report) {
  const lines = [
    "# GitHub Handoff Report",
    "",
    `Status: ${report.status}`,
    `Core version: ${report.coreVersion}`,
    `Project root: ${report.projectRoot}`,
    "",
    "## Git State",
    `- Git root: ${report.git.root ?? "not detected"}`,
    `- Branch state: ${report.git.branchState ?? "not detected"}`,
    `- Current branch: ${report.git.branch ?? "not detected"}`,
    `- HEAD: ${report.git.headShort ?? "not detected"}`,
    `- HEAD subject: ${report.git.headSubject ?? "not detected"}`,
    `- Tags at HEAD: ${listOrNone(report.git.tagsAtHead)}`,
    `- Remote names: ${listOrNone(report.git.remoteNames)}`,
    "",
    "## Adapter Scope",
    `- Adapter present: ${report.adapter.present ? "yes" : "no"}`,
    `- Github-handoff enabled: ${report.adapter.enabled ? "yes" : "no"}`,
    `- Mode: ${report.adapter.mode ?? "unknown"}`,
    "",
    "## Required Evidence",
    ...report.requiredEvidence.map((item) => `- ${item}`),
    "",
    "## Ignored Paths",
    ...report.ignoredPaths.map((item) => `- ${item}`),
    "",
    "## Change Summary",
    ...renderChangeSummary(report.changeSummary),
    "",
    "## Changed Files",
  ];

  if (report.changedFiles.length) {
    for (const entry of report.changedFiles) {
      lines.push(`- ${entry.code} ${entry.path}`);
    }
  } else {
    lines.push("- none listed");
  }

  lines.push(
    "",
    "## Skipped",
    ...(report.skipped.length ? report.skipped.map((item) => `- ${item.path}: ${item.reason}`) : ["- none"]),
    "",
    "## Not Verified",
    ...report.notVerified.map((item) => `- ${item}`),
    "",
    "## Warnings",
    ...(report.warnings.length ? report.warnings.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Refused Behavior",
    ...report.refusedBehavior.map((item) => `- ${item}`),
    "",
    "No commit, push, tag, branch change, pull request creation, GitHub API mutation, token read, secret-file read, or project write was performed.",
  );

  return `${lines.join("\n")}\n`;
}

export function githubHandoffCliResult(projectRootInput, options = {}) {
  const report = buildGithubHandoffReport(projectRootInput, options);
  return {
    exitCode: report.status === "failed" ? 1 : 0,
    report,
    lines: renderGithubHandoffReport(report).trimEnd().split("\n"),
  };
}
