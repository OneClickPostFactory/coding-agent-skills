export const PILOT_SKILLS = [
  "repo-map",
  "build-verify",
  "git-preflight",
  "runtime-truth",
  "llm-drift-control",
];

export const PILOT_VERSION = "0.1.1";

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

const KNOWN_COMMANDS = new Set([
  "cat",
  "curl",
  "find",
  "gh",
  "git",
  "head",
  "jq",
  "kill",
  "ls",
  "node",
  "npm",
  "npx",
  "pgrep",
  "pm2",
  "pnpm",
  "prisma",
  "pwd",
  "rg",
  "sed",
  "ss",
  "systemctl",
  "touch",
  "wrangler",
  "yarn",
]);

const SENSITIVE_PATTERNS = [
  {
    type: "private-key",
    pattern:
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    type: "authorization-header",
    pattern: /Authorization:\s*Bearer\s+[A-Za-z0-9._-]{8,}/gi,
  },
  {
    type: "github-token",
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{16,}\b/g,
  },
  {
    type: "github-token",
    pattern: /\bgithub_pat_[A-Za-z0-9_]{16,}\b/gi,
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
    type: "env-secret",
    pattern:
      /(?:^|\n)[A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PRIVATE_KEY|DATABASE_URL|API_KEY)=[^\s]+/g,
  },
  {
    type: "local-home-path",
    pattern: /\/home\/[^/\s]+\/[^\s"'`]+/g,
  },
  {
    type: "private-domain",
    pattern: /\b(?:[a-z0-9-]+\.)+(?:internal|local|corp\.example\.invalid)\b/gi,
  },
];

function expectedMode(skill) {
  return AUDIT_ONLY_SKILLS.includes(skill) ? "audit-only" : "action-capable";
}

function hasMaterialRisk(risks = []) {
  return risks.some((risk) => /\bmaterial\b/i.test(risk.summary ?? ""));
}

function hasSupportingEvidence(evidence) {
  const successfulCommands = (evidence.commands ?? []).filter(
    (command) => command.resultStatus === "success",
  );
  const findingReferences = (evidence.findings ?? []).flatMap(
    (finding) => finding.evidence ?? [],
  );
  return successfulCommands.length > 0 || findingReferences.length > 0;
}

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
    if (
      evidence.skippedChecks?.some(
        (check) =>
          !(check.reason ?? "").trim() || !(check.consequence ?? "").trim(),
      )
    ) {
      issues.push("complete evidence contains a skipped check missing consequence or reason");
    }
    if (evidence.commands?.some((command) => command.resultStatus !== "success")) {
      issues.push("complete evidence contains a non-success command");
    }
    if (hasMaterialRisk(evidence.risks)) {
      issues.push("complete evidence contains an unresolved material risk");
    }
    if (
      /\b(?:unknown|not determined|unverified|could not be determined)\b/i.test(
        evidence.changedState?.summary ?? "",
      )
    ) {
      issues.push("complete evidence state change is unknown");
    }
    if (!(evidence.confidence?.reason ?? "").trim()) {
      issues.push("complete evidence lacks a confidence reason");
    }
    if (!evidence.repository?.root && !evidence.repository?.head) {
      issues.push("complete evidence lacks repository identity");
    }
    if (!hasSupportingEvidence(evidence)) {
      issues.push("complete evidence has no supporting evidence");
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

  if (adapter.mode && adapter.mode !== expectedMode(adapter.skill)) {
    issues.push(`adapter cannot override ${adapter.skill} mode`);
  }
  if (
    (adapter.allowedOperations ?? []).some((operation) =>
      /\b(?:deploy|publish|push|commit|install|migrate|secret|restart|write)\b/i.test(
        operation,
      ),
    )
  ) {
    issues.push("adapter allows a restricted operation");
  }
  if (adapter.suppressFailures === true) issues.push("adapter cannot suppress failures");
  if (adapter.completionOverride !== undefined && adapter.completionOverride !== null) {
    issues.push("adapter cannot redefine completion");
  }
  if ((adapter.secretPaths ?? []).length > 0 || adapter.readSecrets === true) {
    issues.push("adapter cannot expose secrets");
  }

  return issues;
}

export function classifyTrigger(prompt) {
  const text = prompt.toLowerCase();

  if (
    /\b(?:deploy|install|update the lockfile|commit these|publish the branch|restart|enable it|rewrite the documentation)\b/.test(
      text,
    )
  ) {
    return null;
  }
  if (
    /\b(?:disagree|contradict|reconcile|classify the claim|claim.*(?:stale|wrong)|docs?.*code)\b/.test(
      text,
    )
  ) {
    return "llm-drift-control";
  }
  if (
    /\b(?:actually running|claimed to be live|live state|listener|health endpoint|expected port|process.*running)\b/.test(
      text,
    )
  ) {
    return "runtime-truth";
  }
  if (
    /\b(?:git working tree|staged files?|untracked files?|whitespace state|ready for push|before i commit|branch.*head)\b/.test(
      text,
    )
  ) {
    return "git-preflight";
  }
  if (
    /\b(?:typecheck|project-native|test and build|tests and build|validate the changed code|implementation is finished)\b/.test(
      text,
    )
  ) {
    return "build-verify";
  }
  if (
    /\b(?:unfamiliar repository|canonical repository root|canonical repo|map the current packages|map this repository|identify its entry points|nested directory)\b/.test(
      text,
    )
  ) {
    return "repo-map";
  }

  return null;
}

function splitShellSegments(command) {
  const segments = [];
  let current = "";
  let quote = null;

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    const next = command[index + 1];

    if (quote) {
      current += character;
      if (character === quote && command[index - 1] !== "\\") quote = null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      current += character;
      continue;
    }
    if (character === "\n" || character === ";" || character === "|") {
      if (character === "|" && next === "|") index += 1;
      if (current.trim()) segments.push(current.trim());
      current = "";
      continue;
    }
    if (character === "&" && next === "&") {
      index += 1;
      if (current.trim()) segments.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }

  if (current.trim()) segments.push(current.trim());
  return { segments, balanced: quote === null };
}

function firstToken(segment) {
  return segment.trim().split(/\s+/)[0]?.replace(/^['"]|['"]$/g, "");
}

function classifySegment(segment) {
  if (/(?:^|\s)(?:source|\.)\s+[^\s]*\.env\b/.test(segment) || /\bcat\s+[^\s]*\.env\b/.test(segment)) {
    return "secret-file read";
  }
  if (/\bgit\s+(?:add|commit|push|pull|fetch|merge|rebase|reset|restore|clean|checkout|switch|stash|tag|update-index)\b/.test(segment)) {
    return "Git mutation";
  }
  if (/\b(?:npm\s+(?:install|ci)|pnpm\s+(?:add|install)|yarn\s+(?:add|install))\b/.test(segment)) {
    return "package installation";
  }
  if (/\b(?:wrangler|vercel|netlify)\s+(?:deploy|publish)\b/.test(segment)) {
    return "deployment";
  }
  if (/\b(?:supabase\s+db\s+push|prisma\s+migrate|sequelize\s+db:migrate)\b/.test(segment)) {
    return "migration application";
  }
  if (
    /\bsystemctl(?:\s+--user)?\s+(?:start|stop|restart|reload|enable|disable)\b/.test(
      segment,
    ) ||
    /\bpm2\s+(?:start|stop|restart|reload|save)\b/.test(segment)
  ) {
    return "service mutation";
  }
  if (/\b(?:kill|pkill|killall)\b/.test(segment)) return "process mutation";
  if (/\bgh\s+api\b/.test(segment)) return "privileged API";
  if (/\b(?:rm|mv|cp|touch|mkdir|chmod|chown|tee)\b/.test(segment)) {
    return "filesystem mutation";
  }
  if (/\bnpx\b/.test(segment)) return "npx execution is not allowlisted";
  if (
    /\bcurl\b.*(?:Authorization:|--user|-u\s|--data(?:-raw|-binary)?|-d\s|--form|-F\s|--upload-file|-T\s)/i.test(
      segment,
    )
  ) {
    return /Authorization:|--user|-u\s/i.test(segment)
      ? "authenticated HTTP request"
      : "mutating HTTP request";
  }
  if (/\bcurl\b\s+\S*https?:\/\/[^/\s:@]+:[^@\s/]+@/i.test(segment)) {
    return "URL credentials";
  }
  if (/\bfind\s+(?:\/|\/home\b|~)\b/.test(segment) || (/\bfind\b/.test(segment) && !/-maxdepth\s+\d+/.test(segment))) {
    return "unbounded filesystem scan";
  }
  if (/\bnpm\s+run\s+\S*(?:fix|deploy|migrate|install|snapshot|update|watch|dev|start)\S*/i.test(segment)) {
    return "unsafe npm script";
  }

  const executable = firstToken(segment);
  if (!KNOWN_COMMANDS.has(executable)) return `executable not allowlisted: ${executable}`;

  if (executable === "git") {
    if (
      !/^git\s+(?:rev-parse|remote\s+-v|status\b|branch\s+--show-current|log\b|diff\b|ls-files\b|show\b)/.test(
        segment,
      )
    ) {
      return "Git command is not read-only allowlisted";
    }
  }
  if (executable === "npm" && !/^npm\s+(?:run\s+(?:lint|typecheck|test|build|check|validate)|test)\b/.test(segment)) {
    return "unsafe npm script";
  }
  if (executable === "pnpm" && !/^pnpm\s+(?:run\s+)?(?:lint|typecheck|test|build|check|validate)\b/.test(segment)) {
    return "unsafe pnpm script";
  }
  if (executable === "yarn" && !/^yarn\s+(?:run\s+)?(?:lint|typecheck|test|build|check|validate)\b/.test(segment)) {
    return "unsafe yarn script";
  }
  if (executable === "node" && !/^node\s+(?:--check\b|--test\b|scripts\/(?:validate-pack|test-pack)\.mjs\b)/.test(segment)) {
    return "node execution is not allowlisted";
  }
  if (executable === "systemctl" && !/^systemctl\s+(?:--user\s+)?status\b/.test(segment)) {
    return "systemctl operation is not status-only";
  }
  if (executable === "pm2" && !/^pm2\s+(?:list|status)\b/.test(segment)) {
    return "pm2 operation is not status-only";
  }
  if (executable === "curl") {
    const url = segment.match(/https?:\/\/[^\s'"]+/i)?.[0];
    if (!url || !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//i.test(url)) {
      return "curl target is not an approved local health endpoint";
    }
  }
  if (executable === "cat") return "cat is not allowlisted for reusable procedures";
  if (executable === "prisma" || executable === "wrangler") {
    return `${executable} operation is not allowlisted`;
  }

  return null;
}

export function analyzeCommand(command, options = {}) {
  const text = String(command ?? "").trim();
  const policyText = text
    .replace(/<port>/gi, "3000")
    .replace(/<[A-Za-z][A-Za-z0-9_-]*>/g, "placeholder");
  const reasons = [];

  if (!text) return { allowed: false, reasons: ["empty command"], segments: [] };
  if (/<<-?\s*['"]?[A-Za-z_][A-Za-z0-9_]*['"]?/.test(policyText)) {
    reasons.push("heredoc is not allowed");
  }
  if (/(?:^|\s)(?:bash|sh|zsh|fish)\s+-c\b|\beval\b/.test(policyText)) {
    reasons.push("shell wrapper is not allowed");
  }
  if (/\$\(|`/.test(policyText)) reasons.push("command substitution is not allowed");
  if (/(?:^|\s)(?:>{1,2}|<{1,2})(?=\s|[./~A-Za-z0-9_-])/.test(policyText)) {
    reasons.push("redirection is not allowed");
  }

  const parsed = splitShellSegments(policyText);
  if (!parsed.balanced) reasons.push("unbalanced shell quoting");
  for (const segment of parsed.segments) {
    const reason = classifySegment(segment);
    if (reason) reasons.push(reason);

    const npmScript = segment.match(/^npm\s+run\s+([^\s]+)/)?.[1];
    if (npmScript && options.scripts) {
      if (!Object.hasOwn(options.scripts, npmScript)) {
        reasons.push(`npm script is not defined: ${npmScript}`);
      } else {
        const scriptResult = analyzeCommand(options.scripts[npmScript]);
        if (!scriptResult.allowed) {
          reasons.push(
            `npm script definition is unsafe: ${scriptResult.reasons.join(", ")}`,
          );
        }
      }
    }
  }

  return {
    allowed: reasons.length === 0,
    reasons: [...new Set(reasons)],
    segments: parsed.segments,
  };
}

export function restrictedShellReason(command) {
  if (!String(command ?? "").trim() || String(command).trim().startsWith("#")) return null;
  return analyzeCommand(command).reasons[0] ?? null;
}

function isDeniedContext(line, deniedSection) {
  return (
    deniedSection ||
    /\b(?:do not|never|must not|cannot|reject|denied|unsafe|prohibit|restricted|outside this skill|without performing)\b/i.test(
      line,
    )
  );
}

export function commandLooksExecutable(value) {
  return KNOWN_COMMANDS.has(firstToken(value));
}

export function auditOnlyDocumentIssues(markdown) {
  const issues = [];
  let deniedSection = false;
  let inShellFence = false;

  for (const [index, line] of String(markdown).split(/\r?\n/).entries()) {
    if (/^#{1,6}\s+/.test(line)) {
      deniedSection = /\b(?:unsafe|denied|restricted|approval boundary|safety boundary)\b/i.test(
        line,
      );
    }
    if (/^```(?:bash|sh|shell)\s*$/.test(line)) {
      inShellFence = true;
      continue;
    }
    if (/^```\s*$/.test(line)) {
      inShellFence = false;
      continue;
    }

    const candidates = [];
    if (inShellFence && line.trim()) candidates.push(line.trim());
    for (const match of line.matchAll(/`([^`\n]+)`/g)) {
      if (commandLooksExecutable(match[1])) candidates.push(match[1]);
    }

    for (const candidate of candidates) {
      const result = analyzeCommand(candidate);
      if (!result.allowed && !isDeniedContext(line, deniedSection)) {
        issues.push({
          line: index + 1,
          command: candidate,
          reasons: result.reasons,
        });
      }
    }

    if (
      !isDeniedContext(line, deniedSection) &&
      /^\s*(?:\d+\.\s+|[-*]\s+)?(?:run\s+)?(?:install|deploy|restart|kill|commit|push|stage|write|delete|migrate|source\s+\S*\.env|read\s+\S*\.env|scan\s+(?:\/home|the home directory))\b/i.test(
        line,
      )
    ) {
      issues.push({
        line: index + 1,
        command: line.trim(),
        reasons: ["plain-language mutation instruction"],
      });
    }
  }

  return issues;
}

export function detectSensitiveValues(text) {
  const findings = [];
  for (const { type, pattern } of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(String(text))) findings.push(type);
  }
  return [...new Set(findings)];
}

export function redactSensitiveText(text) {
  let redacted = String(text);
  for (const { type, pattern } of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, `[REDACTED:${type}]`);
  }
  return redacted;
}
