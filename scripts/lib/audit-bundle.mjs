import { adapterRepoMapCliResult } from "./adapter-repo-map.mjs";
import { apiContractAuditCliResult } from "./api-contract-audit.mjs";
import { buildCliResult, PUBLIC_COMMAND_METADATA } from "./cli-result.mjs";
import { deploymentPreflightCliResult } from "./deployment-preflight.mjs";
import { envAuditCliResult } from "./env-audit.mjs";
import { githubHandoffCliResult } from "./github-handoff.mjs";
import { migrationReviewCliResult } from "./migration-review.mjs";
import { routeTraceCliResult } from "./route-trace.mjs";
import { secretAuditCliResult } from "./secret-audit.mjs";

export const AUDIT_BUNDLE_COMMANDS = Object.freeze([
  "repo-map",
  "route-trace",
  "env-audit",
  "secret-audit",
  "api-contract-audit",
  "migration-review",
  "github-handoff",
  "deployment-preflight",
]);

const HANDLERS = Object.freeze({
  "repo-map": adapterRepoMapCliResult,
  "route-trace": routeTraceCliResult,
  "env-audit": envAuditCliResult,
  "secret-audit": secretAuditCliResult,
  "api-contract-audit": apiContractAuditCliResult,
  "migration-review": migrationReviewCliResult,
  "github-handoff": githubHandoffCliResult,
  "deployment-preflight": deploymentPreflightCliResult,
});

const REFUSED_BEHAVIOR = [
  "no target project commands",
  "no package installation",
  "no builds or tests",
  "no runtime or service mutation",
  "no deployments",
  "no database access or migrations",
  "no secret or .env reads",
  "no project writes",
];

function unique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function bounded(values, limit, label) {
  const deduplicated = unique(values);
  if (deduplicated.length <= limit) return deduplicated;
  return [
    ...deduplicated.slice(0, limit),
    `${deduplicated.length - limit} additional ${label} omitted from bounded aggregate output`,
  ];
}

function compactResult(result) {
  const limits = {
    summary: 20,
    findings: 100,
    warnings: 80,
    risks: 100,
    skipped: 80,
    notVerified: 80,
    refusedBehavior: 40,
  };
  const compact = { ...result };
  const originalCounts = {};
  for (const [key, limit] of Object.entries(limits)) {
    const values = Array.isArray(result[key]) ? result[key] : [];
    originalCounts[key] = values.length;
    compact[key] = bounded(values, limit, key);
  }
  compact.metrics = {
    ...(result.metrics ?? {}),
    originalCounts,
    boundedOutput: true,
  };
  return compact;
}

function statusFor(results) {
  if (results.some((result) => result.exitCode === 3)) return "blocked";
  if (results.some((result) => result.exitCode === 4 || result.exitCode === 5)) return "failed";
  if (results.some((result) => result.status !== "complete")) return "partial";
  return "complete";
}

export function buildAuditBundleReport(projectRoot, options = {}) {
  const packageVersion = options.packageVersion;
  const coreRoot = options.coreRoot;
  const results = AUDIT_BUNDLE_COMMANDS.map((command) => {
    const outcome = HANDLERS[command](projectRoot, { coreRoot });
    return compactResult(buildCliResult(command, [projectRoot], outcome, {
      packageVersion,
      commandMetadata: PUBLIC_COMMAND_METADATA,
    }));
  });
  const repoMap = results[0];
  const status = statusFor(results);
  const counts = Object.fromEntries(
    ["complete", "partial", "failed", "blocked"].map((candidate) => [
      candidate,
      results.filter((result) => result.status === candidate).length,
    ]),
  );
  const adapterPresent = repoMap.adapter?.present === true || repoMap.adapter?.adapterPresent === "yes";
  const mode = adapterPresent ? "adapter-limited" : "generic-safe-discovery";
  const findings = bounded(results.flatMap((result) => result.findings), 300, "findings");
  const warnings = bounded(results.flatMap((result) => result.warnings), 200, "warnings");
  const risks = bounded(results.flatMap((result) => result.risks), 300, "risks");
  const skipped = bounded(results.flatMap((result) => result.skipped), 200, "skipped items");
  const notVerified = bounded(results.flatMap((result) => result.notVerified), 200, "not-verified items");

  return {
    status,
    mode,
    adapter: {
      present: adapterPresent,
      mode,
      confidence: adapterPresent ? "adapter-declared" : "reduced",
    },
    summary: [
      `${results.length} read-only static audit surfaces evaluated in deterministic order`,
      `${counts.complete} complete, ${counts.partial} partial, ${counts.failed} failed, ${counts.blocked} blocked`,
      adapterPresent
        ? "validated project adapter metadata narrowed eligible audit scope"
        : "adapterPresent: false; generic safe discovery used with reduced confidence",
      "no project commands run; no secrets read; no files changed",
    ],
    findings,
    warnings,
    riskIndicators: risks,
    skipped,
    notVerified,
    refusedBehavior: REFUSED_BEHAVIOR,
    results,
    metrics: {
      total: results.length,
      ...counts,
      findings: findings.length,
      warnings: warnings.length,
      risks: risks.length,
      boundedOutput: true,
    },
    details: {
      commandOrder: [...AUDIT_BUNDLE_COMMANDS],
      adapterPresent,
      mode,
      confidence: adapterPresent ? "adapter-declared" : "reduced",
      projectCommandsRun: false,
      secretsRead: false,
    },
    recommendedNextAction: {
      label: risks.length > 0 ? "Review aggregate risks before approving changes" : "Review aggregate evidence",
      reason: "The audit bundle is evidence only; any repository mutation or external action needs its own approval and validation.",
      requiresApproval: risks.length > 0,
    },
  };
}

export function renderAuditBundleReport(report) {
  const lines = [
    "# Aggregate Repository Audit",
    "",
    `Status: ${report.status}`,
    `Mode: ${report.mode}`,
    `Adapter present: ${report.adapter.present ? "yes" : "no"}`,
    "",
    "## Summary",
    ...report.summary.map((item) => `- ${item}`),
    "",
    "## Audit Results",
    ...report.results.map((result) => `- ${result.command}: ${result.status} (${result.exitCodeMeaning})`),
    "",
    "## Warnings",
    ...(report.warnings.length ? report.warnings.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Risk Indicators",
    ...(report.riskIndicators.length ? report.riskIndicators.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Refused Behavior",
    ...report.refusedBehavior.map((item) => `- ${item}`),
    "",
    "No target project command, build, test, install, runtime probe, deploy, migration, secret read, or project write was performed.",
  ];
  return lines.join("\n");
}

export function auditBundleCliResult(projectRoot, options = {}) {
  if (!projectRoot) {
    return {
      exitCode: 2,
      stream: "stderr",
      lines: ["usage: node scripts/render-audit-bundle.mjs <project-root>"],
    };
  }
  const report = buildAuditBundleReport(projectRoot, options);
  const exitCode = report.status === "blocked" ? 3 : report.status === "failed" ? 5 : 0;
  return {
    exitCode,
    stream: exitCode === 0 ? "stdout" : "stderr",
    lines: renderAuditBundleReport(report).split("\n"),
    report,
  };
}
