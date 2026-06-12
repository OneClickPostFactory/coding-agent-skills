export const PILOT_SKILLS = [
  "repo-map",
  "build-verify",
  "git-preflight",
  "runtime-truth",
  "llm-drift-control",
];

export const AUDIT_ONLY_SKILLS = [
  "repo-map",
  "git-preflight",
  "runtime-truth",
  "llm-drift-control",
];

export const RESTRICTED_CATEGORIES = [
  "file-write",
  "package-install",
  "deployment",
  "git-mutation",
  "unrestricted-scan",
  "secret-read",
  "process-mutation",
  "service-mutation",
  "migration-apply",
  "privileged-api",
];

export function completionIssues(evidence) {
  const issues = [];
  const startedAt = Date.parse(evidence.invocation?.startedAt ?? "");
  const endedAt = Date.parse(evidence.invocation?.endedAt ?? "");

  if (!Number.isNaN(startedAt) && !Number.isNaN(endedAt) && endedAt < startedAt) {
    issues.push("invocation ended before it started");
  }

  if (
    AUDIT_ONLY_SKILLS.includes(evidence.skill?.name) &&
    evidence.changedState?.changed === true
  ) {
    issues.push("audit-only skill reported a state change");
  }

  if (evidence.status === "complete") {
    if (evidence.failures?.length) issues.push("complete evidence contains failures");
    if (evidence.unresolvedQuestions?.length) {
      issues.push("complete evidence contains unresolved questions");
    }
    if (evidence.skippedChecks?.some((check) => check.completionPermitted === false)) {
      issues.push("complete evidence skipped a completion-blocking check");
    }
    if (evidence.commands?.some((command) => command.resultStatus !== "success")) {
      issues.push("complete evidence contains a non-success command");
    }
  }

  return issues;
}

export function adapterIssues(adapter) {
  const issues = [];

  if (adapter.adapterVersion !== "1.0.0") issues.push("unsupported adapterVersion");
  if (!PILOT_SKILLS.includes(adapter.skill)) issues.push("unknown pilot skill");
  if (!adapter.project || typeof adapter.project !== "string") {
    issues.push("project must be a non-empty string");
  }
  if (!Array.isArray(adapter.repositoryMarkers) || !adapter.repositoryMarkers.length) {
    issues.push("repositoryMarkers must be a non-empty array");
  }
  if (!Array.isArray(adapter.boundedReadPaths) || !adapter.boundedReadPaths.length) {
    issues.push("boundedReadPaths must be a non-empty array");
  }

  for (const candidate of adapter.boundedReadPaths ?? []) {
    if (
      typeof candidate !== "string" ||
      candidate === "." ||
      candidate.startsWith("/") ||
      candidate.split("/").includes("..") ||
      /(^|\/)\.env(?:\.|$)/.test(candidate)
    ) {
      issues.push(`unsafe boundedReadPath: ${String(candidate)}`);
    }
  }

  const restrictions = new Set(adapter.restrictedCategories ?? []);
  for (const category of RESTRICTED_CATEGORIES) {
    if (!restrictions.has(category)) {
      issues.push(`adapter weakens required restriction: ${category}`);
    }
  }

  return issues;
}

export function restrictedShellReason(line) {
  const command = line.trim();
  if (!command || command.startsWith("#")) return null;
  if (
    /[;&|`]/.test(command) ||
    command.includes("$(") ||
    /(?:^|\s)(?:>{1,2}|<{1,2})(?:\s|[./~])/.test(command)
  ) {
    return "shell composition or redirection is not allowed in safe examples";
  }

  const restrictedPatterns = [
    [/\bgit\s+(?:add|commit|push|pull|fetch|merge|rebase|reset|restore|clean|checkout|switch|stash|tag|update-index)\b/, "Git mutation"],
    [/\b(?:npm\s+(?:install|ci)|pnpm\s+(?:add|install)|yarn\s+(?:add|install))\b/, "package installation"],
    [/\b(?:wrangler|vercel|netlify)\s+(?:deploy|publish)\b/, "deployment"],
    [/\b(?:supabase\s+db\s+push|prisma\s+migrate|sequelize\s+db:migrate)\b/, "migration application"],
    [/\b(?:systemctl|pm2)\s+(?:start|stop|restart|reload|enable|disable|save)\b/, "service mutation"],
    [/\b(?:kill|pkill|killall)\b/, "process mutation"],
    [/\b(?:sudo|su)\b/, "privileged command"],
    [/\bgh\s+api\b/, "privileged API call"],
    [/\bcurl\b.*(?:Authorization:|--user|-u\s|--data|-d\s)/i, "authenticated or mutating HTTP call"],
    [/\b(?:rm|mv|cp|touch|mkdir|chmod|chown|tee)\b/, "filesystem mutation"],
  ];

  for (const [pattern, reason] of restrictedPatterns) {
    if (pattern.test(command)) return reason;
  }

  return null;
}
