export const PILOT_SKILLS = [
  "repo-map",
  "route-trace",
  "env-audit",
  "secret-audit",
  "build-verify",
  "git-preflight",
  "runtime-truth",
  "llm-drift-control",
];

export const PILOT_VERSION = "0.2.3";
export const PREVIOUS_PILOT_VERSION = "0.2.2";

export const AUDIT_ONLY_SKILLS = [
  "repo-map",
  "route-trace",
  "env-audit",
  "secret-audit",
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
  "./bin/coding-agent-skills",
  "bin/coding-agent-skills",
  "cat",
  "coding-agent-skills",
  "curl",
  "docker",
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
  "ps",
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

function versionMatches(candidate, currentVersion) {
  if (candidate === currentVersion) return true;
  const [major, minor] = currentVersion.split(".");
  return candidate === `${major}.${minor}.x`;
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

export function adapterIssues(adapter, options = {}) {
  const issues = [];
  const skillVersion = options.skillVersion ?? PILOT_VERSION;

  if (!adapter || typeof adapter !== "object") return ["adapter must be an object"];
  if (!adapter.adapterId || typeof adapter.adapterId !== "string") {
    issues.push("adapterId must be a non-empty string");
  }
  if (adapter.adapterVersion !== "1.0.0") issues.push("unsupported adapterVersion");

  const supportedSkills = adapter.supportedSkills ?? [];
  if (!Array.isArray(supportedSkills) || supportedSkills.length === 0) {
    issues.push("adapter must declare supported skills");
  }
  for (const skill of supportedSkills) {
    if (!PILOT_SKILLS.includes(skill.id)) {
      issues.push(`unknown pilot skill: ${String(skill.id)}`);
      continue;
    }
    if (skill.declaredMode !== expectedMode(skill.id)) {
      issues.push(`adapter cannot override ${skill.id} mode`);
    }
    if (
      !(skill.compatibleVersions ?? []).some((version) =>
        versionMatches(version, skillVersion),
      )
    ) {
      issues.push(`adapter is incompatible with ${skill.id} ${skillVersion}`);
    }
  }

  const detection = adapter.project?.detection;
  if (!detection || !Array.isArray(detection.rootMarkers) || !detection.rootMarkers.length) {
    issues.push("project detection must include root markers");
  }
  if (detection?.scope !== "declared-project-root") {
    issues.push("adapter scope must remain the declared project root");
  }
  if (detection?.requireApprovalOutsideScope !== true) {
    issues.push("adapter must require approval outside declared scope");
  }
  if (!Number.isInteger(detection?.maximumDepth) || detection.maximumDepth < 0) {
    issues.push("project detection maximumDepth must be a non-negative integer");
  }

  const relativePaths = [
    ...(detection?.rootMarkers ?? []).map((marker) => marker.path),
    ...(adapter.extensions?.safeReadPaths ?? []),
    ...(adapter.extensions?.ignoredPaths ?? []),
    ...(adapter.extensions?.documentationPrecedence ?? []),
  ];
  for (const candidate of relativePaths) {
    if (
      typeof candidate !== "string" ||
      candidate === "." ||
      candidate.startsWith("/") ||
      candidate.split("/").includes("..") ||
      /(^|\/)\.env(?:\.|$)/.test(candidate)
    ) {
      issues.push(`unsafe adapter path: ${String(candidate)}`);
    }
  }

  const inheritance = adapter.inheritance ?? {};
  const restrictions = new Set(inheritance.deniedOperationCategories ?? []);
  for (const category of RESTRICTED_CATEGORIES) {
    if (!restrictions.has(category)) {
      issues.push(`adapter weakens required restriction: ${category}`);
    }
  }
  if (inheritance.sharedRestrictions !== "required") {
    issues.push("adapter must inherit shared restrictions");
  }
  const forbiddenInheritanceFlags = [
    ["allowRestrictionRemoval", "remove shared restrictions"],
    ["allowModeOverride", "override skill mode"],
    ["allowFailureSuppression", "suppress failures"],
    ["allowCompletionOverride", "redefine completion"],
    ["allowSecretExposure", "expose secrets"],
    ["allowRequiredEvidenceRemoval", "remove required evidence"],
    ["allowScopeExpansionWithoutApproval", "expand scope without approval"],
  ];
  for (const [field, description] of forbiddenInheritanceFlags) {
    if (inheritance[field] !== false) issues.push(`adapter cannot ${description}`);
  }

  const supportedIds = new Set(supportedSkills.map((skill) => skill.id));
  for (const alias of adapter.extensions?.commandAliases ?? []) {
    if (!supportedIds.has(alias.skillId)) {
      issues.push(`command alias targets unsupported skill: ${String(alias.skillId)}`);
    }
    const policy = options.policies?.[alias.skillId];
    const result = policy
      ? commandPolicyDecision(alias.command, policy)
      : analyzeCommand(alias.command);
    if (!result.allowed) {
      issues.push(`unsafe command alias ${alias.alias}: ${result.reasons.join(", ")}`);
    }
    if (policy && result.family !== alias.family) {
      issues.push(
        `command alias ${alias.alias} declares ${alias.family} but matches ${String(result.family)}`,
      );
    }
  }
  for (const status of adapter.extensions?.safeStatusCommands ?? []) {
    const result = analyzeCommand(status.command);
    if (!result.allowed) {
      issues.push(`unsafe status command: ${result.reasons.join(", ")}`);
    }
    if (
      !/^(?:systemctl\s+(?:--user\s+)?status|pm2\s+(?:list|status)|docker\s+(?:ps|inspect)|ps\b|pgrep\b|ss\b)/.test(
        status.command,
      )
    ) {
      issues.push("adapter status command is not status-only");
    }
  }
  if (
    (adapter.extensions?.safeStatusCommands ?? []).length > 0 &&
    !supportedIds.has("runtime-truth")
  ) {
    issues.push("status commands require runtime-truth compatibility");
  }
  if (
    !Array.isArray(adapter.extensions?.requiredEvidence) ||
    adapter.extensions.requiredEvidence.length === 0
  ) {
    issues.push("adapter cannot remove required evidence");
  } else if (
    adapter.extensions.requiredEvidence.some(
      (evidence) => typeof evidence !== "string" || !evidence.trim(),
    )
  ) {
    issues.push("adapter required evidence must be explicit");
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
    /\b(?:route trace|trace.*routes?|route surface|routes?.*static|api route files?|next\.js routes?|react router|express routes?|fastify routes?|hono routes?)\b/.test(
      text,
    )
  ) {
    return "route-trace";
  }
  if (
    /\b(?:env audit|environment variables?|env vars?|process\.env|import\.meta\.env|\.env\.example|configuration requirements?)\b/.test(
      text,
    )
  ) {
    return "env-audit";
  }
  if (
    /\b(?:secret audit|secrets? scan|secret exposure|credential exposure|tracked secrets?|hardcoded secrets?|private keys?|api keys?|tokens? in source)\b/.test(
      text,
    )
  ) {
    return "secret-audit";
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

function classifySegment(segment, options = {}) {
  if (/(?:^|\s)(?:source|\.)\s+[^\s]*\.env\b/.test(segment) || /\bcat\s+[^\s]*\.env\b/.test(segment)) {
    return "secret-file read";
  }
  if (/\bgit\s+(?:add|commit|push|pull|fetch|merge|rebase|reset|restore|clean|checkout|switch|stash|tag|update-index)\b/.test(segment)) {
    return "Git mutation";
  }
  if (/\b(?:npm\s+(?:install|ci)|pnpm\s+(?:add|install)|yarn\s+(?:add|install))\b/.test(segment)) {
    return "package installation";
  }
  if (/\bnpx\s+wrangler\b/.test(segment)) {
    return "npx wrangler is deployment-capable";
  }
  if (/\bnpx\s+supabase\b/.test(segment)) {
    return "npx supabase is database-capable";
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
    const isAuthenticated = /Authorization:|--user|-u\s/i.test(segment);
    const url = segment.match(/https?:\/\/[^\s'"]+/i)?.[0];
    if (
      isAuthenticated &&
      options.approvals?.includes("authenticated-local-health") &&
      /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/.*health/i.test(url ?? "")
    ) {
      return null;
    }
    return isAuthenticated ? "authenticated HTTP request" : "mutating HTTP request";
  }
  if (/\bcurl\b\s+\S*https?:\/\/[^/\s:@]+:[^@\s/]+@/i.test(segment)) {
    return "URL credentials";
  }
  if (/\bfind\s+(?:\/|\/home\b|~)\b/.test(segment) || (/\bfind\b/.test(segment) && !/-maxdepth\s+\d+/.test(segment))) {
    return "unbounded filesystem scan";
  }
  if (/\b(?:sed|head|jq|rg|ls)\b.*(?:\/home\/|~\/)/.test(segment)) {
    return "read path is outside declared scope";
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
  if (executable === "npm" && !/^npm\s+(?:run\s+(?:lint|typecheck|test|build|check|validate)|test|pack\s+--dry-run\b)\b/.test(segment)) {
    if (!/^npm\s+pkg\s+get\s+scripts\b/.test(segment)) return "unsafe npm script";
  }
  if (executable === "pnpm" && !/^pnpm\s+(?:run\s+)?(?:lint|typecheck|test|build|check|validate)\b/.test(segment)) {
    return "unsafe pnpm script";
  }
  if (executable === "yarn" && !/^yarn\s+(?:run\s+)?(?:lint|typecheck|test|build|check|validate)\b/.test(segment)) {
    return "unsafe yarn script";
  }
  if (
    executable === "node" &&
    !/^node\s+(?:--check\b|--test\b|scripts\/(?:validate-pack|validate-maintainer-loop|validate-adapters|validate-project-adapters|check-adapter-upgrade|check-adapter-upgrade-chain|verify-evidence-bundle|render-evidence-archive-report|render-adapter-repo-map|render-route-trace|render-env-audit|render-secret-audit|test-pack)\.mjs\b)/.test(
      segment,
    )
  ) {
    return "node execution is not allowlisted";
  }
  if (
    ["coding-agent-skills", "bin/coding-agent-skills", "./bin/coding-agent-skills"].includes(
      executable,
    ) &&
    !/^(?:\.\/)?(?:bin\/)?coding-agent-skills\s+(?:validate-pack|validate-project\s+\S+|repo-map\s+\S+|route-trace\s+\S+|env-audit\s+\S+|secret-audit\s+\S+|validate-adapters\s+\S+|help|--help|-h)\s*$/.test(
      segment,
    )
  ) {
    return "local CLI command is not allowlisted";
  }
  if (executable === "systemctl" && !/^systemctl\s+(?:--user\s+)?status\b/.test(segment)) {
    return "systemctl operation is not status-only";
  }
  if (executable === "pm2" && !/^pm2\s+(?:list|status)\b/.test(segment)) {
    return "pm2 operation is not status-only";
  }
  if (executable === "docker" && !/^docker\s+(?:ps|inspect)\b/.test(segment)) {
    return "docker operation is not status-only";
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
    const reason = classifySegment(segment, options);
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

export function commandPolicyDecision(command, policy, options = {}) {
  const analysis = analyzeCommand(command, options);
  const executable = firstToken(analysis.segments[0] ?? "");
  const family = policy.allowedFamilies?.find((candidate) =>
    candidate.executables.includes(executable),
  );
  const reasons = [...analysis.reasons];

  if (!family) reasons.push(`executable is not allowed by policy: ${executable}`);
  if (
    analysis.segments.length > 1 &&
    policy.parserPolicy?.allowedComposition !== "read-only"
  ) {
    reasons.push("policy does not allow command composition");
  }

  return {
    allowed: reasons.length === 0,
    family: family?.name ?? null,
    reasons: [...new Set(reasons)],
    segments: analysis.segments,
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
