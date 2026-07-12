import { redactSensitiveText } from "./pack-rules.mjs";
import { validateValue } from "./schema-validator.mjs";

export const CLI_EXIT_CODES = Object.freeze({
  handled: 0,
  usageError: 2,
  safetyRefusal: 3,
  missingRequiredInput: 4,
  unexpectedFailure: 5,
});

export const PUBLIC_COMMAND_METADATA = Object.freeze({
  "validate-pack": {
    skillId: "pack-validation",
    mode: "validation",
    next: { label: "Select a read-only audit command", reason: "The package is structurally valid; choose the narrowest command for the target task.", requiresApproval: false },
  },
  "validate-project": {
    skillId: "project-adapter-validation",
    mode: "validation",
    next: { label: "Run an adapter-aware read-only report", reason: "The project adapter declaration is valid; use a scoped report command next.", requiresApproval: false },
  },
  "repo-map": {
    skillId: "repo-map",
    mode: "audit-only",
    next: { label: "Review reported repo boundaries", reason: "Use the reported repo boundaries and evidence requirements before choosing another action.", requiresApproval: false },
  },
  "route-trace": {
    skillId: "route-trace",
    mode: "audit-only",
    next: { label: "Review static route findings", reason: "Inspect verified and inferred route surfaces before approving code or runtime work.", requiresApproval: false },
  },
  "env-audit": {
    skillId: "env-audit",
    mode: "audit-only",
    next: { label: "Review variable-name inventory", reason: "Use value-free environment names to plan configuration review without reading secrets.", requiresApproval: false },
  },
  "secret-audit": {
    skillId: "secret-audit",
    mode: "audit-only",
    next: { label: "Review redacted secret-risk findings", reason: "Any remediation or credential rotation needs separate approval.", requiresApproval: true },
  },
  "api-contract-audit": {
    skillId: "api-contract-audit",
    mode: "audit-only",
    next: { label: "Review static API contract surfaces", reason: "Use contract, endpoint, client, and schema evidence before editing API code.", requiresApproval: false },
  },
  "migration-review": {
    skillId: "migration-review",
    mode: "audit-only",
    next: { label: "Review migration evidence", reason: "Database access, migration edits, generation, or execution require separate approval.", requiresApproval: true },
  },
  "github-handoff": {
    skillId: "github-handoff",
    mode: "audit-only",
    next: { label: "Request explicit GitHub handoff approval", reason: "Git publication work is outside this read-only report.", requiresApproval: true },
  },
  "deployment-preflight": {
    skillId: "deployment-preflight",
    mode: "audit-only",
    next: { label: "Request explicit deployment approval", reason: "Deployment, build, runtime, provider, and migration work is outside this read-only report.", requiresApproval: true },
  },
  "validate-adapters": {
    skillId: "external-adapter-validation",
    mode: "validation",
    next: { label: "Use accepted adapters only as narrowing metadata", reason: "Adapters may narrow safe context but cannot grant powers or weaken restrictions.", requiresApproval: false },
  },
  audit: {
    skillId: "audit-bundle",
    mode: "audit-only",
    next: { label: "Review the aggregate evidence bundle", reason: "Use the deterministic static results to select a separately approved next action.", requiresApproval: false },
  },
});

const MISSING_INPUT_CODES = new Set([
  "adapter-root-not-found",
  "project-root-not-directory",
  "project-root-not-found",
]);

const SAFETY_CODE_PATTERN = /(?:unsafe|symlink|traversal|secret|credential|scope-expansion|mode-escalation|weakens|restriction|schema-validation|skill-set-mismatch|adapter|refus)/i;

export function exitCodeMeaning(exitCode) {
  if (exitCode === CLI_EXIT_CODES.handled) return "handled";
  if (exitCode === CLI_EXIT_CODES.usageError) return "usage_error";
  if (exitCode === CLI_EXIT_CODES.safetyRefusal) return "safety_refusal";
  if (exitCode === CLI_EXIT_CODES.missingRequiredInput) return "missing_required_input";
  return "unexpected_internal_or_runtime_failure";
}

function reportCodes(report) {
  return [
    ...(Array.isArray(report?.codes) ? report.codes : []),
    ...(Array.isArray(report?.adapter?.codes) ? report.adapter.codes : []),
    ...(Array.isArray(report?.validation?.codes) ? report.validation.codes : []),
  ].map(String);
}

export function normalizedOutcomeExitCode(outcome) {
  const raw = outcome?.exitCode ?? outcome?.status ?? CLI_EXIT_CODES.unexpectedFailure;
  if (raw === CLI_EXIT_CODES.handled || raw === CLI_EXIT_CODES.usageError) return raw;

  const codes = reportCodes(outcome?.report ?? outcome?.result);
  if (codes.some((code) => SAFETY_CODE_PATTERN.test(code))) {
    return CLI_EXIT_CODES.safetyRefusal;
  }
  if (codes.some((code) => MISSING_INPUT_CODES.has(code))) {
    return CLI_EXIT_CODES.missingRequiredInput;
  }
  if (codes.length > 0) return CLI_EXIT_CODES.safetyRefusal;
  return raw === CLI_EXIT_CODES.safetyRefusal || raw === CLI_EXIT_CODES.missingRequiredInput
    ? raw
    : CLI_EXIT_CODES.unexpectedFailure;
}

function sanitizedLines(text) {
  return redactSensitiveText(text)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
}

function sectionLines(lines, heading) {
  const result = [];
  let active = false;
  for (const line of lines) {
    if (line === `## ${heading}`) {
      active = true;
      continue;
    }
    if (active && line.startsWith("## ")) break;
    if (active && line.trim()) result.push(line.replace(/^- /, ""));
  }
  return result.filter((line) => line !== "none" && line !== "none found");
}

function detectedStatus(lines, exitCode) {
  for (const line of lines) {
    const match = /^Status:\s*([a-z-]+)/i.exec(line);
    if (match) return match[1].toLowerCase();
  }
  return exitCode === 0 ? "complete" : "failed";
}

function normalizedPublicStatus(status, exitCode) {
  if (status === "empty") return "partial";
  if (status === "unsafe") return "blocked";
  if (["complete", "partial", "failed", "blocked"].includes(status)) return status;
  return exitCode === 0 ? "complete" : "failed";
}

function sanitizeStructured(value) {
  return JSON.parse(redactSensitiveText(JSON.stringify(value)));
}

function adapterSummary(lines, report) {
  if (report?.adapter && typeof report.adapter === "object") {
    return sanitizeStructured(report.adapter);
  }
  const adapter = {};
  const adapterLines = [
    ...sectionLines(lines, "Adapter Scope"),
    ...sectionLines(lines, "Adapter Bounds"),
  ];
  for (const line of adapterLines) {
    const match = /^([^:]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1]
      .trim()
      .replace(/[^a-zA-Z0-9]+([a-zA-Z0-9])/g, (_, char) => char.toUpperCase())
      .replace(/^[A-Z]/, (char) => char.toLowerCase());
    adapter[key] = match[2].trim();
  }
  return adapter;
}

function summaryLines(lines) {
  return lines
    .filter((line) => line.trim().length > 0)
    .filter((line) => !line.startsWith("#"))
    .filter((line) => !line.startsWith("## "))
    .filter((line) => !line.startsWith("- "))
    .slice(0, 12);
}

function findingLines(lines) {
  const ignoredSections = new Set([
    "Git State",
    "Adapter Scope",
    "Adapter Bounds",
    "Scope Paths",
    "Ignored Paths",
    "Summary",
    "Skipped",
    "Not Verified",
    "Warnings",
    "Refused Behavior",
  ]);
  const findings = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith("## ")) {
      current = line.replace(/^## /, "");
      continue;
    }
    if (!current || ignoredSections.has(current)) continue;
    if (line.startsWith("- ") && !line.includes("none found")) findings.push(line.slice(2));
  }
  return findings.slice(0, 100);
}

function normalizeOutcome(outcome) {
  const exitCode = normalizedOutcomeExitCode(outcome);
  if (Array.isArray(outcome?.lines)) {
    return {
      exitCode,
      lines: outcome.lines
        .map((line) => redactSensitiveText(String(line)))
        .filter((line) => line.trim().length > 0),
      report: outcome.report ?? outcome.result ?? null,
    };
  }
  return {
    exitCode,
    lines: [
      ...sanitizedLines(outcome?.stdout ?? ""),
      ...sanitizedLines(outcome?.stderr ?? ""),
    ],
    report: null,
  };
}

function serializeItems(items) {
  return items.map((item) =>
    typeof item === "string"
      ? redactSensitiveText(item)
      : redactSensitiveText(JSON.stringify(item)),
  );
}

export function buildCliResult(commandName, args, outcome, options) {
  const normalized = normalizeOutcome(outcome);
  const lines = normalized.lines;
  const report = normalized.report;
  const metadata = options.commandMetadata[commandName] ?? {
    skillId: commandName,
    mode: "unknown",
    next: null,
  };
  const status = normalizedPublicStatus(
    report?.status ?? detectedStatus(lines, normalized.exitCode),
    normalized.exitCode,
  );
  const summary = summaryLines(lines);
  const warnings = [
    ...(Array.isArray(report?.warnings) ? serializeItems(report.warnings) : []),
    ...sectionLines(lines, "Warnings"),
    ...lines.filter((line) => /\bwarning\b/i.test(line) && !line.startsWith("## ")),
  ];
  const defaultFailureNext = normalized.exitCode === 2
    ? { label: "Correct the command arguments", reason: "Use the documented command shape and try again.", requiresApproval: false }
    : normalized.exitCode === 3
      ? { label: "Review the rejected input", reason: "The command failed closed because a safety or validation boundary was detected.", requiresApproval: false }
      : normalized.exitCode === 4
        ? { label: "Provide the required input", reason: "The command requires an existing file or directory before inspection can begin.", requiresApproval: false }
        : { label: "Report the command failure", reason: "An unexpected internal or runtime failure requires package review before relying on this result.", requiresApproval: false };
  const next = report?.recommendedNextAction ?? (normalized.exitCode === 0 ? metadata.next : defaultFailureNext);
  const result = {
    success: normalized.exitCode === CLI_EXIT_CODES.handled,
    status,
    tool: "coding-agent-skills",
    command: commandName,
    skillId: metadata.skillId,
    packageVersion: options.packageVersion,
    mode: report?.mode ?? metadata.mode,
    changedState: false,
    summary: Array.isArray(report?.summary)
      ? serializeItems(report.summary)
      : summary.length > 0
        ? summary
        : [normalized.exitCode === 0 ? `${commandName} completed successfully` : `${commandName} did not complete successfully`],
    findings: Array.isArray(report?.findings) ? serializeItems(report.findings) : findingLines(lines),
    warnings: [...new Set(warnings)],
    risks: Array.isArray(report?.riskIndicators)
      ? serializeItems(report.riskIndicators)
      : Array.isArray(report?.risks)
        ? serializeItems(report.risks)
        : sectionLines(lines, "Risk Indicators"),
    skipped: Array.isArray(report?.skipped) ? serializeItems(report.skipped) : sectionLines(lines, "Skipped"),
    notVerified: Array.isArray(report?.notVerified) ? serializeItems(report.notVerified) : sectionLines(lines, "Not Verified"),
    refusedBehavior: Array.isArray(report?.refusedBehavior) ? serializeItems(report.refusedBehavior) : sectionLines(lines, "Refused Behavior"),
    adapter: adapterSummary(lines, report),
    recommendedNextAction: next,
    safety: {
      readOnly: true,
      secretsRead: false,
      targetCommandsRun: false,
      mutationsPerformed: false,
    },
    exitCode: normalized.exitCode,
    exitCodeMeaning: exitCodeMeaning(normalized.exitCode),
    invocation: {
      args: args.map((arg) => redactSensitiveText(String(arg))),
      outputFormat: "json",
    },
  };

  for (const key of ["details", "evidence", "results", "metrics"]) {
    if (report && Object.hasOwn(report, key)) result[key] = sanitizeStructured(report[key]);
  }
  return result;
}

export function cliResultSemanticIssues(result, packageVersion) {
  const issues = [];
  if (result.packageVersion !== packageVersion) issues.push("packageVersion must match package.json");
  if (result.changedState !== false) issues.push("audit CLI results must declare changedState false");
  if (result.safety?.readOnly !== true) issues.push("audit CLI results must remain read-only");
  if (result.safety?.secretsRead !== false) issues.push("audit CLI results must declare secretsRead false");
  if (result.safety?.targetCommandsRun !== false) issues.push("static audit results must declare targetCommandsRun false");
  if (result.safety?.mutationsPerformed !== false) issues.push("audit CLI results must declare mutationsPerformed false");
  if (result.status === "complete" && result.exitCode !== 0) issues.push("complete cannot coexist with a nonzero exit code");
  if (result.exitCode === 4 && result.exitCodeMeaning !== "missing_required_input") issues.push("missing input must use missing_required_input");
  if (result.exitCode === 3 && result.exitCodeMeaning !== "safety_refusal") issues.push("safety refusal must use safety_refusal");
  if (!result.recommendedNextAction) issues.push("recommendedNextAction is required");
  return issues;
}

export function validateCliResult(schema, result, packageVersion) {
  return [
    ...validateValue(schema, result),
    ...cliResultSemanticIssues(result, packageVersion),
  ];
}
