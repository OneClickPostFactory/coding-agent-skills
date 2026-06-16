import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const failures = [];
const permissionFlags = [
  "harness-hardening",
  "docs-hardening",
  "test-hardening",
  "adapter-harness",
  "evidence-harness",
  "release-preflight",
  "commit",
  "tag",
  "push",
];
const requiredFiles = [
  "AGENTS.md",
  "RUNBOOK.md",
  "work-ledger.md",
  "runs/skill-runs.md",
  "scripts/run-next",
  "scripts/validate-maintainer-loop.mjs",
];
const ledgerSections = [
  "Current State",
  "Last Completed Version",
  "Current Recommended Milestone",
  "Allowed Next Actions",
  "Blocked Actions",
  "Evidence Required",
  "Stop Conditions",
  "Human Approval Required For",
  "Next Run Command",
];
const runLogFields = [
  "Run ID",
  "Timestamp",
  "Command used",
  "Permissions granted",
  "Files changed",
  "Validation commands",
  "Validation result",
  "Commit/tag/push status",
  "Next state",
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
}

if (fs.existsSync(path.join(root, "work-ledger.md"))) {
  const ledger = read("work-ledger.md");
  for (const section of ledgerSections) {
    if (!ledger.includes(`## ${section}`)) {
      failures.push(`work-ledger.md missing ${section}`);
    }
  }
  if (!/## Last Completed Version\s+`v\d+\.\d+\.\d+`/m.test(ledger)) {
    failures.push("work-ledger.md must declare a last completed version");
  }
}

if (fs.existsSync(path.join(root, "runs/skill-runs.md"))) {
  const runLog = read("runs/skill-runs.md");
  for (const field of runLogFields) {
    if (!runLog.includes(field)) failures.push(`runs/skill-runs.md missing ${field}`);
  }
}

if (fs.existsSync(path.join(root, "scripts/run-next"))) {
  const stat = fs.statSync(path.join(root, "scripts/run-next"));
  if ((stat.mode & 0o111) === 0) failures.push("scripts/run-next is not executable");

  const runner = read("scripts/run-next");
  if (!runner.startsWith("#!/usr/bin/env node")) {
    failures.push("scripts/run-next must be a Node executable");
  }
  for (const flag of permissionFlags) {
    if (!runner.includes(flag)) failures.push(`scripts/run-next missing ${flag}`);
  }
  if (runner.includes(".env")) failures.push("scripts/run-next must not reference .env");
  const deniedCommandPatterns = [
    /\bgit\s+(?:reset|restore|checkout|clean|commit|push|stash)\b/,
    /\bgit\s+tag\s+-a\b/,
    /\bnpm\s+(?:install|ci)\b/,
    /\bnpx\s+(?:wrangler|supabase)\b/,
    /\b(?:docker|pm2|systemctl|kill|ssh)\b/,
    /\bcurl\b/,
  ];
  for (const pattern of deniedCommandPatterns) {
    if (pattern.test(runner)) {
      failures.push(`scripts/run-next contains denied command pattern ${pattern}`);
    }
  }
  if (!runner.includes("failClosed")) failures.push("scripts/run-next must fail closed");
  if (!runner.includes("blockedMilestoneReason")) {
    failures.push("scripts/run-next must reject out-of-scope ledger milestones");
  }

  const unknown = spawnSync(path.join(root, "scripts/run-next"), ["--allow", "unknown"], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (unknown.status === 0) {
    failures.push("scripts/run-next accepted an unknown permission flag");
  }
}

const readme = fs.existsSync(path.join(root, "README.md")) ? read("README.md") : "";
if (!readme.includes("scripts/run-next")) {
  failures.push("README.md must document the maintainer loop");
}

const roadmap = fs.existsSync(path.join(root, "ROADMAP.md")) ? read("ROADMAP.md") : "";
if (!roadmap.includes("work-ledger.md") || !roadmap.includes("maintainer loop")) {
  failures.push("ROADMAP.md must link maintainer-loop state");
}

const safety = fs.existsSync(path.join(root, "docs/safety/README.md"))
  ? read("docs/safety/README.md")
  : "";
if (!safety.includes("Maintainer Loop") || !safety.includes("Stop Boundaries")) {
  failures.push("docs/safety/README.md must explain maintainer-loop stop boundaries");
}

const ci = fs.existsSync(path.join(root, ".github/workflows/validate.yml"))
  ? read(".github/workflows/validate.yml")
  : "";
if (!ci.includes("node scripts/validate-maintainer-loop.mjs .")) {
  failures.push("CI must run maintainer-loop validation");
}

if (failures.length) {
  console.error("maintainer-loop validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("maintainer loop valid");
