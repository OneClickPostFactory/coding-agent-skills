import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  externalAdapterCliResult,
  formatExternalAdapterSummary,
  validateExternalAdapters,
} from "./lib/adapter-discovery.mjs";
import {
  buildEvidenceArchiveReport,
  evidenceArchiveCliResult,
  evidenceBundleCliResult,
  verifyEvidenceBundle,
} from "./lib/evidence-bundle.mjs";
import {
  analyzeCommand,
  adapterIssues,
  AUDIT_ONLY_SKILLS,
  auditOnlyDocumentIssues,
  classifyTrigger,
  commandLooksExecutable,
  commandPolicyDecision,
  completionIssues,
  detectSensitiveValues,
  PILOT_SKILLS,
  PILOT_VERSION,
  redactSensitiveText,
  RESTRICTED_CATEGORIES,
  restrictedShellReason,
} from "./lib/pack-rules.mjs";
import {
  formatProjectAdapterSummary,
  projectAdapterCliResult,
  validateProjectAdapters,
} from "./lib/project-adapter-installation.mjs";
import {
  adapterRepoMapCliResult,
  buildAdapterRepoMapReport,
  renderAdapterRepoMapReport,
} from "./lib/adapter-repo-map.mjs";
import {
  buildRouteTraceReport,
  renderRouteTraceReport,
  routeTraceCliResult,
} from "./lib/route-trace.mjs";
import {
  buildEnvAuditReport,
  envAuditCliResult,
  renderEnvAuditReport,
} from "./lib/env-audit.mjs";
import {
  adapterUpgradeCliResult,
  checkAdapterUpgrade,
  formatAdapterUpgradeSummary,
} from "./lib/adapter-upgrade.mjs";
import {
  adapterChainCliResult,
  checkAdapterUpgradeChain,
  formatAdapterChainSummary,
} from "./lib/adapter-upgrade-chain.mjs";
import { validateValue } from "./lib/schema-validator.mjs";
import { parseSemver, parseVersionPin, satisfiesVersionPin } from "./lib/semver.mjs";

const root = path.resolve(process.argv[2] ?? ".");
const tests = [];
const requiredSkillFiles = [
  "SKILL.md",
  "checklist.md",
  "examples.md",
  "failure-modes.md",
  "adapter-interface.md",
  "evidence-template.md",
  "agents/openai.yaml",
];
const requiredSkillHeadings = [
  "Purpose And Use",
  "Inputs",
  "Procedure",
  "Evidence, Recovery, And Dependencies",
  "Approval Boundary",
  "Completion",
];
const requiredReleaseFiles = [
  ".github/workflows/validate.yml",
  "AGENTS.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "RUNBOOK.md",
  "ROADMAP.md",
  "package.json",
  "work-ledger.md",
  "runs/skill-runs.md",
  "bin/coding-agent-skills",
  "scripts/run-next",
  "scripts/validate-maintainer-loop.mjs",
  "docs/versioning/README.md",
  "docs/privacy/README.md",
  "docs/adapters/README.md",
  "docs/usage/README.md",
  "docs/release/README.md",
  "docs/release/npm-package.md",
  "docs/testing/README.md",
];

function test(name, callback) {
  tests.push({ name, callback });
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function walk(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", "validation-output"].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target, output);
    else output.push(target);
  }
  return output;
}

function assertSchemaValid(schema, value, label) {
  const errors = validateValue(schema, value);
  assert.deepEqual(errors, [], `${label}\n${errors.join("\n")}`);
}

function fencedShellBlocks(text) {
  const blocks = [];
  const pattern = /```(?:bash|sh|shell)\s*\n([\s\S]*?)```/g;
  for (const match of text.matchAll(pattern)) blocks.push(match[1]);
  return blocks;
}

function deepMerge(base, patch) {
  if (
    base === null ||
    patch === null ||
    Array.isArray(base) ||
    Array.isArray(patch) ||
    typeof base !== "object" ||
    typeof patch !== "object"
  ) {
    return structuredClone(patch);
  }

  const merged = structuredClone(base);
  for (const [key, value] of Object.entries(patch)) {
    merged[key] = Object.hasOwn(merged, key)
      ? deepMerge(merged[key], value)
      : structuredClone(value);
  }
  return merged;
}

function snapshotDirectory(relativePath) {
  const directory = path.join(root, relativePath);
  return snapshotAbsoluteDirectory(directory);
}

function snapshotAbsoluteDirectory(directory) {
  const digest = createHash("sha256");
  for (const file of walk(directory).sort()) {
    digest.update(path.relative(directory, file));
    digest.update(fs.readFileSync(file));
  }
  return digest.digest("hex");
}

const manifestSchema = readJson("schemas/skill-manifest.schema.json");
const policySchema = readJson("schemas/command-policy.schema.json");
const adapterSchema = readJson("schemas/project-adapter.schema.json");
const projectInstallationSchema = readJson(
  "schemas/project-adapter-installation.schema.json",
);
const upgradeEvidenceSchema = readJson(
  "schemas/adapter-upgrade-evidence.schema.json",
);
const evidenceBundleSchema = readJson("schemas/evidence-bundle.schema.json");
const evidenceArchiveReportSchema = readJson("schemas/archive-report.schema.json");
const evidenceArchiveIndexSchema = readJson("schemas/archive-index.schema.json");
const evidenceSchema = readJson("contracts/evidence-pack/evidence-pack.schema.json");
const policiesBySkill = Object.fromEntries(
  PILOT_SKILLS.map((skill) => [
    skill,
    readJson(`examples/command-policies/${skill}.json`),
  ]),
);

test("the pilot contains exactly the approved skills", () => {
  const actual = fs
    .readdirSync(path.join(root, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(actual, [...PILOT_SKILLS].sort());
});

test("release governance and safe CI files are present", () => {
  for (const file of requiredReleaseFiles) {
    assert.ok(fs.existsSync(path.join(root, file)), file);
  }
  const ci = read(".github/workflows/validate.yml");
  const runCommands = [...ci.matchAll(/^\s*run:\s*(.+)$/gm)].map((match) => match[1]);
  assert.deepEqual(runCommands, [
    "node scripts/validate-pack.mjs .",
    "node scripts/test-pack.mjs",
    "node scripts/validate-maintainer-loop.mjs .",
    "node scripts/validate-adapters.mjs tests/fixtures/external-adapters/valid-basic",
    "node scripts/validate-project-adapters.mjs tests/fixtures/project-adapter-installation/valid-exact-pin",
    "node scripts/check-adapter-upgrade.mjs tests/fixtures/project-adapter-upgrades/valid-upgrade/before tests/fixtures/project-adapter-upgrades/valid-upgrade/after",
    "node scripts/check-adapter-upgrade-chain.mjs tests/fixtures/project-adapter-upgrade-chains/valid-chain",
    "node scripts/verify-evidence-bundle.mjs tests/fixtures/evidence-bundles/valid-bundle/evidence-bundle.json",
    "node scripts/render-evidence-archive-report.mjs tests/fixtures/evidence-bundles/valid-bundle/evidence-bundle.json",
    "node --test",
  ]);
});

test("the maintainer loop is present, executable, and fails closed", () => {
  const runnerPath = path.join(root, "scripts/run-next");
  const runner = read("scripts/run-next");
  assert.notEqual(fs.statSync(runnerPath).mode & 0o111, 0);
  assert.ok(runner.includes("failClosed"));
  assert.ok(runner.includes("blockedMilestoneReason"));
  assert.ok(runner.includes("work-ledger.md"));
  assert.ok(runner.includes("runs/skill-runs.md"));
  assert.ok(!runner.includes(".env"));

  for (const permission of [
    "harness-hardening",
    "docs-hardening",
    "test-hardening",
    "adapter-harness",
    "evidence-harness",
    "release-preflight",
    "commit",
    "tag",
    "push",
  ]) {
    assert.ok(runner.includes(permission), permission);
  }

  for (const args of [[], ["--allow", "unknown-permission"]]) {
    const result = spawnSync(runnerPath, args, {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /run-next refused:/);
  }
});

test("local CLI maps approved commands to existing safe scripts", () => {
  const cliPath = path.join(root, "bin", "coding-agent-skills");
  const cliText = read("bin/coding-agent-skills");
  assert.notEqual(fs.statSync(cliPath).mode & 0o111, 0);
  assert.ok(cliText.includes("scripts/validate-pack.mjs"));
  assert.ok(cliText.includes("scripts/validate-project-adapters.mjs"));
  assert.ok(cliText.includes("scripts/render-adapter-repo-map.mjs"));
  assert.ok(cliText.includes("scripts/render-route-trace.mjs"));
  assert.ok(cliText.includes("scripts/render-env-audit.mjs"));
  assert.ok(cliText.includes("scripts/validate-adapters.mjs"));
  assert.ok(!cliText.includes(".env"));

  const fixtureRoot = path.join(root, "tests", "fixtures");
  const commands = [
    [["validate-pack"], /pilot pack valid/],
    [
      ["validate-adapters", path.join(fixtureRoot, "external-adapters", "valid-basic")],
      /external adapter validation complete/,
    ],
    [
      [
        "validate-project",
        path.join(fixtureRoot, "project-adapter-installation", "valid-exact-pin"),
      ],
      /project adapter validation complete/,
    ],
    [
      ["repo-map", path.join(fixtureRoot, "project-adapter-installation", "valid-exact-pin")],
      /# Adapter-Aware Repo Map/,
    ],
    [
      ["route-trace", path.join(fixtureRoot, "route-trace", "static-project")],
      /# Route Trace Report/,
    ],
    [
      ["env-audit", path.join(fixtureRoot, "env-audit", "static-project")],
      /# Env Audit Report/,
    ],
  ];

  for (const [args, expected] of commands) {
    const result = spawnSync(cliPath, args, {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
    });
    assert.equal(result.status, 0, `${args.join(" ")}\n${result.stderr}`);
    assert.match(result.stdout, expected, args.join(" "));
  }

  const unknown = spawnSync(cliPath, ["deploy"], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /unknown command: deploy/);
});

test("npm package metadata is public-ready and dependency-free", () => {
  const packageJson = readJson("package.json");
  assert.equal(packageJson.name, "coding-agent-skills");
  assert.equal(packageJson.version, "0.2.10");
  assert.equal(
    packageJson.description,
    "Evidence-first, read-only coding-agent skills and project adapter tooling.",
  );
  assert.equal(packageJson.type, "module");
  assert.equal(packageJson.private, false);
  assert.equal(packageJson.license, "MIT");
  assert.deepEqual(packageJson.keywords, [
    "coding-agent",
    "agent-skills",
    "repo-map",
    "route-trace",
    "env-audit",
    "project-adapters",
    "code-validation",
    "cli",
  ]);
  assert.deepEqual(packageJson.repository, {
    type: "git",
    url: "git+https://github.com/OneClickPostFactory/coding-agent-skills.git",
  });
  assert.equal(
    packageJson.homepage,
    "https://github.com/OneClickPostFactory/coding-agent-skills#readme",
  );
  assert.deepEqual(packageJson.bugs, {
    url: "https://github.com/OneClickPostFactory/coding-agent-skills/issues",
  });
  assert.deepEqual(packageJson.publishConfig, {
    access: "public",
    registry: "https://registry.npmjs.org/",
  });
  assert.deepEqual(packageJson.bin, {
    "coding-agent-skills": "bin/coding-agent-skills",
  });
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(packageJson.devDependencies, undefined);
  assert.deepEqual(packageJson.files, [
    "bin/",
    "scripts/",
    "skills/",
    "schemas/",
    "contracts/",
    "docs/",
    "examples/",
    "tests/",
    "AGENTS.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "LICENSE",
    "README.md",
    "ROADMAP.md",
    "RUNBOOK.md",
    "work-ledger.md",
    "runs/skill-runs.md",
  ]);
  assert.equal(packageJson.scripts.validate, "node scripts/validate-pack.mjs .");
  assert.equal(packageJson.scripts["pack:dry-run"], "npm pack --dry-run");
  assert.equal(restrictedShellReason("npm pack --dry-run"), null);
  assert.match(read("LICENSE"), /Copyright \(c\) 2026 OneClickPostFactory/);
  assert.match(read("docs/release/npm-package.md"), /npm install -g coding-agent-skills/);
});

test("route-trace renderer identifies static route files and inferred patterns", () => {
  const result = buildRouteTraceReport(
    path.join(root, "tests", "fixtures", "route-trace", "static-project"),
    { coreRoot: root },
  );
  assert.equal(result.ok, true);
  assert.equal(result.status, "complete");
  assert.equal(result.adapter.present, false);
  assert.ok(
    result.verifiedRouteFiles.some(
      (record) => record.route === "/api/users" && record.file === "app/api/users/route.ts",
    ),
  );
  assert.ok(
    result.verifiedRouteFiles.some(
      (record) => record.route === "/blog/[slug]" && record.file === "app/blog/[slug]/page.tsx",
    ),
  );
  assert.ok(
    result.verifiedRouteFiles.some(
      (record) => record.route === "/api/hello" && record.file === "pages/api/hello.ts",
    ),
  );
  assert.ok(
    result.inferredRoutePatterns.some(
      (record) => record.route === "/dashboard" && record.kind === "react-router-route-declaration",
    ),
  );
  assert.ok(
    result.inferredRoutePatterns.some(
      (record) => record.route === "/health" && record.method === "GET",
    ),
  );
  assert.ok(result.notVerified.includes("runtime-generated routes"));
  assert.ok(renderRouteTraceReport(result).includes("No target project build"));
});

test("route-trace renderer respects adapter-declared scope", () => {
  const result = buildRouteTraceReport(
    path.join(root, "tests", "fixtures", "route-trace", "adapter-project"),
    { coreRoot: root },
  );
  assert.equal(result.ok, true);
  assert.equal(result.status, "complete");
  assert.equal(result.adapter.present, true);
  assert.equal(result.adapter.enabled, true);
  assert.deepEqual(result.adapter.scopePaths, ["app", "pages", "src"]);
  assert.ok(
    result.verifiedRouteFiles.some(
      (record) => record.route === "/api/items" && record.file === "app/api/items/route.ts",
    ),
  );
  assert.ok(
    result.inferredRoutePatterns.some((record) => record.route === "/adapter-health"),
  );

  const cli = routeTraceCliResult(
    path.join(root, "tests", "fixtures", "route-trace", "adapter-project"),
    { coreRoot: root },
  );
  assert.equal(cli.exitCode, 0);
  assert.match(cli.lines.join("\n"), /route-trace used adapter-declared safe read paths only/);
});

test("route-trace does not broaden a repo-map-only project adapter", () => {
  const result = buildRouteTraceReport(
    path.join(root, "tests", "fixtures", "project-adapter-installation", "valid-exact-pin"),
    { coreRoot: root },
  );
  assert.equal(result.ok, true);
  assert.equal(result.status, "partial");
  assert.equal(result.adapter.present, true);
  assert.equal(result.adapter.enabled, false);
  assert.deepEqual(result.scannedFiles, []);
  assert.match(renderRouteTraceReport(result), /route-trace is not enabled/);
});

test("env-audit identifies variable names without reading .env values", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "env-audit-fixture-"));
  fs.cpSync(path.join(root, "tests", "fixtures", "env-audit", "static-project"), temporary, {
    recursive: true,
  });
  fs.writeFileSync(path.join(temporary, ".env"), "SHOULD_NOT_BE_READ=synthetic-fixture-value\n");

  const result = buildEnvAuditReport(
    temporary,
    { coreRoot: root },
  );

  assert.equal(result.status, "complete");
  assert.ok(result.filesScanned.includes(".env.example"));
  assert.ok(!result.filesScanned.includes(".env"));
  assert.ok(result.skipped.some((item) => item.path === ".env"));
  const names = result.variables.map((variable) => variable.name);
  assert.ok(names.includes("DATABASE_URL"));
  assert.ok(names.includes("NEXT_PUBLIC_APP_URL"));
  assert.ok(names.includes("PORT"));
  assert.ok(names.includes("SERVICE_TOKEN"));
  assert.ok(names.includes("DENO_REGION"));
  const rendered = renderEnvAuditReport(result);
  assert.match(rendered, /DATABASE_URL/);
  assert.doesNotMatch(rendered, /synthetic-fixture-value/);
});

test("env-audit respects adapter-declared scope", () => {
  const result = buildEnvAuditReport(
    path.join(root, "tests", "fixtures", "env-audit", "adapter-project"),
    { coreRoot: root },
  );

  assert.equal(result.status, "complete");
  assert.equal(result.adapter.enabled, true);
  assert.deepEqual(result.scopePaths, ["src"]);
  assert.deepEqual(result.filesScanned, ["src/config.ts"]);
  assert.ok(result.variables.some((variable) => variable.name === "ADAPTER_ONLY_VALUE"));
  assert.ok(result.warnings.includes("env-audit used adapter-declared safe read paths only"));
  const cli = envAuditCliResult(
    path.join(root, "tests", "fixtures", "env-audit", "adapter-project"),
    { coreRoot: root },
  );
  assert.equal(cli.exitCode, 0);
  assert.match(cli.lines.join("\n"), /Env-audit enabled: yes/);
});

test("env-audit does not broaden a repo-map-only project adapter", () => {
  const result = buildEnvAuditReport(
    path.join(root, "tests", "fixtures", "project-adapter-installation", "valid-exact-pin"),
    { coreRoot: root },
  );

  assert.equal(result.status, "partial");
  assert.equal(result.filesScanned.length, 0);
  assert.equal(result.variables.length, 0);
  assert.match(renderEnvAuditReport(result), /env-audit is not enabled/);
});

test("validate-pack accepts installed package trees without source-only gitignore", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "installed-package-"));
  const installedRoot = path.join(temporaryRoot, "coding-agent-skills");

  try {
    fs.cpSync(root, installedRoot, {
      recursive: true,
      filter(source) {
        const relative = path.relative(root, source);
        if (relative === "") return true;
        const parts = relative.split(path.sep);
        return ![
          ".git",
          ".github",
          ".gitignore",
          ".env",
          "node_modules",
          "validation-output",
        ].includes(parts[0]);
      },
    });

    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts", "validate-pack.mjs"), installedRoot],
      {
        cwd: root,
        encoding: "utf8",
        stdio: "pipe",
      },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /pilot pack valid/);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("every skill has the required files and sections", () => {
  for (const skill of PILOT_SKILLS) {
    for (const file of requiredSkillFiles) {
      assert.ok(fs.existsSync(path.join(root, "skills", skill, file)), `${skill}: ${file}`);
    }
    const skillText = read(`skills/${skill}/SKILL.md`);
    for (const heading of requiredSkillHeadings) {
      assert.ok(skillText.includes(`## ${heading}`), `${skill}: ${heading}`);
    }
  }
});

test("every JSON file parses", () => {
  for (const file of walk(root).filter((candidate) => candidate.endsWith(".json"))) {
    assert.doesNotThrow(
      () => JSON.parse(fs.readFileSync(file, "utf8")),
      path.relative(root, file),
    );
  }
});

test("all manifests, command policies, and evidence examples satisfy their schemas", () => {
  for (const skill of PILOT_SKILLS) {
    assertSchemaValid(
      manifestSchema,
      readJson(`examples/manifests/${skill}.json`),
      `${skill} manifest`,
    );
    assertSchemaValid(
      policySchema,
      readJson(`examples/command-policies/${skill}.json`),
      `${skill} command policy`,
    );
    assertSchemaValid(
      evidenceSchema,
      readJson(`examples/evidence-packs/${skill}.json`),
      `${skill} evidence pack`,
    );
    assert.equal(readJson(`examples/manifests/${skill}.json`).version, PILOT_VERSION);
    assert.equal(
      readJson(`examples/command-policies/${skill}.json`).version,
      PILOT_VERSION,
    );
    assert.equal(
      readJson(`examples/evidence-packs/${skill}.json`).skill.version,
      PILOT_VERSION,
    );
  }
});

test("project adapter examples satisfy schema and compatibility rules", () => {
  const examples = [
    "narrow-repo-map.json",
    "documentation-precedence.json",
    "runtime-status-hints.json",
  ];

  for (const file of examples) {
    const adapter = readJson(`examples/adapters/${file}`);
    assertSchemaValid(adapterSchema, adapter, file);
    assert.deepEqual(adapterIssues(adapter, { policies: policiesBySkill }), [], file);
  }
});

test("manifest references resolve and agree with skill policy", () => {
  for (const skill of PILOT_SKILLS) {
    const manifestPath = path.join(root, "examples", "manifests", `${skill}.json`);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const policyPath = path.resolve(path.dirname(manifestPath), manifest.commandPolicy);
    const evidencePath = path.resolve(path.dirname(manifestPath), manifest.evidenceContract);
    const adapterSchemaPath = path.resolve(path.dirname(manifestPath), manifest.adapterSchema);
    const adapterPath = path.resolve(path.dirname(manifestPath), manifest.adapterInterface);

    assert.equal(manifest.name, skill);
    assert.ok(fs.existsSync(policyPath), `${skill}: missing command policy`);
    assert.ok(fs.existsSync(evidencePath), `${skill}: missing evidence contract`);
    assert.ok(fs.existsSync(adapterSchemaPath), `${skill}: missing adapter schema`);
    assert.ok(fs.existsSync(adapterPath), `${skill}: missing adapter interface`);
    assert.equal(JSON.parse(fs.readFileSync(policyPath, "utf8")).mode, manifest.mode);
    assert.equal(manifest.adapterCompatibility.contractVersion, "1.0.0");
    assert.ok(manifest.adapterCompatibility.compatibleAdapterVersions.includes("1.0.0"));
  }
});

test("only build-verify is action-capable", () => {
  for (const skill of PILOT_SKILLS) {
    const manifest = readJson(`examples/manifests/${skill}.json`);
    assert.equal(
      manifest.mode,
      skill === "build-verify" ? "action-capable" : "audit-only",
    );
  }
});

test("every command policy preserves all restricted categories", () => {
  for (const skill of PILOT_SKILLS) {
    const policy = readJson(`examples/command-policies/${skill}.json`);
    assert.deepEqual(
      [...new Set(policy.restrictedCategories)].sort(),
      [...RESTRICTED_CATEGORIES].sort(),
      `${skill}: restriction set changed`,
    );
  }
});

test("command policies use explicit constrained families without restricted executables", () => {
  const restrictedExecutables = new Set([
    "npx",
    "wrangler",
    "vercel",
    "netlify",
    "sudo",
  ]);

  for (const skill of PILOT_SKILLS) {
    const policy = readJson(`examples/command-policies/${skill}.json`);
    const familyNames = policy.allowedFamilies.map((family) => family.name);
    assert.equal(new Set(familyNames).size, familyNames.length, `${skill}: duplicate family`);
    for (const invariant of [
      "inspectEverySegment",
      "inspectScriptBodies",
      "rejectUnknownExecutables",
      "rejectShellWrappers",
      "rejectHeredocs",
      "rejectRedirection",
      "providerSpecificNpx",
      "authenticatedCurlRequiresApproval",
      "boundedReadsRequired",
    ]) {
      assert.equal(policy.parserPolicy[invariant], true, `${skill}: ${invariant}`);
    }
    for (const family of policy.allowedFamilies) {
      assert.ok(family.name.trim(), `${skill}: empty family name`);
      assert.ok(family.executables.length, `${skill}: empty executable list`);
      assert.ok(family.constraints.length, `${skill}: missing constraints`);
      assert.ok(family.argumentPolicy.allowedPatterns.length, `${skill}: allowed patterns`);
      assert.ok(family.argumentPolicy.deniedPatterns.length, `${skill}: denied patterns`);
      for (const executable of family.executables) {
        assert.equal(
          restrictedExecutables.has(executable),
          false,
          `${skill}: restricted executable ${executable}`,
        );
      }
    }
  }
});

test("property-style command-policy cases reject obvious bypass families", () => {
  const fixture = readJson("tests/fixtures/policy/properties.json");

  for (const candidate of fixture.safeByPolicy) {
    const policy = readJson(`examples/command-policies/${candidate.policy}.json`);
    const result = commandPolicyDecision(candidate.command, policy, {
      scripts: candidate.scripts,
    });
    assert.equal(result.allowed, true, candidate.command);
    assert.equal(result.family, candidate.family, candidate.command);
  }

  let generated = 0;
  for (const prefix of fixture.safePrefixes) {
    for (const separator of fixture.separators) {
      for (const suffix of fixture.restrictedSuffixes) {
        const result = analyzeCommand(`${prefix}${separator}${suffix.command}`);
        assert.equal(result.allowed, false, `${prefix}${separator}${suffix.command}`);
        assert.match(result.reasons.join("\n"), new RegExp(suffix.reason, "i"));
        generated += 1;
      }
    }
  }
  assert.ok(generated >= 80, `expected broad generated coverage, received ${generated}`);

  for (const wrapper of fixture.wrappers) {
    for (const suffix of fixture.restrictedSuffixes) {
      const result = analyzeCommand(`${wrapper} '${suffix.command}'`);
      assert.equal(result.allowed, false, `${wrapper}: ${suffix.command}`);
      assert.match(result.reasons.join("\n"), /shell wrapper/i);
    }
  }
  for (const command of fixture.heredocs) {
    assert.match(analyzeCommand(command).reasons.join("\n"), /heredoc/i);
  }
  for (const candidate of fixture.argumentCases) {
    const result = analyzeCommand(candidate.command, {
      approvals: candidate.approvals,
    });
    assert.equal(result.allowed, candidate.allowed, candidate.command);
    if (candidate.reason) {
      assert.match(result.reasons.join("\n"), new RegExp(candidate.reason, "i"));
    }
  }
  for (const candidate of fixture.scriptBodies) {
    const result = analyzeCommand(candidate.command, { scripts: candidate.scripts });
    assert.equal(result.allowed, candidate.allowed, candidate.command);
    if (candidate.reason) {
      assert.match(result.reasons.join("\n"), new RegExp(candidate.reason, "i"));
    }
  }

  assert.match(analyzeCommand("npx wrangler deploy").reasons.join("\n"), /npx wrangler/i);
  assert.match(analyzeCommand("npx supabase db push").reasons.join("\n"), /npx supabase/i);
  assert.match(analyzeCommand("npx unknown-tool check").reasons.join("\n"), /npx execution/i);
});

test("trigger-classification fixtures select only the intended pilot skill", () => {
  const fixture = readJson("tests/fixtures/triggers/cases.json");
  for (const candidate of fixture.cases) {
    const actual = classifyTrigger(candidate.prompt);
    assert.equal(actual, candidate.expectedSkill, candidate.id);
    for (const excluded of candidate.notSkills ?? []) {
      assert.notEqual(actual, excluded, `${candidate.id}: selected ${excluded}`);
    }
  }
});

test("command-parser fixtures reject obvious policy bypasses", () => {
  const fixture = readJson("tests/fixtures/policy/commands.json");
  for (const candidate of fixture.cases) {
    const result = analyzeCommand(candidate.command, {
      scripts: candidate.scripts,
    });
    assert.equal(result.allowed, candidate.allowed, candidate.id);
    if (candidate.reason) {
      assert.match(
        result.reasons.join("\n"),
        new RegExp(candidate.reason, "i"),
        candidate.id,
      );
    }
  }
});

test("audit-only evidence examples declare no state change", () => {
  for (const skill of AUDIT_ONLY_SKILLS) {
    const evidence = readJson(`examples/evidence-packs/${skill}.json`);
    assert.equal(evidence.changedState.changed, false);
    assert.deepEqual(completionIssues(evidence), []);
  }
});

test("all shipped complete evidence examples are semantically eligible", () => {
  for (const skill of PILOT_SKILLS) {
    const evidence = readJson(`examples/evidence-packs/${skill}.json`);
    assert.equal(evidence.status, "complete");
    assert.deepEqual(completionIssues(evidence), [], skill);
  }
});

test("schema-valid false completion is rejected by semantic policy", () => {
  const evidence = readJson("tests/fixtures/completion/false-complete.json");
  assertSchemaValid(evidenceSchema, evidence, "false-complete fixture");
  assert.match(completionIssues(evidence).join("\n"), /completion-blocking check/);
});

test("false-completion matrix rejects every unsupported complete status", () => {
  const fixture = readJson("tests/fixtures/completion/cases.json");
  for (const candidate of fixture.cases) {
    const evidence = deepMerge(fixture.base, candidate.patch);
    assertSchemaValid(evidenceSchema, evidence, candidate.id);
    const issues = completionIssues(evidence);
    if (candidate.expectedIssue === null) {
      assert.deepEqual(issues, [], candidate.id);
    } else {
      assert.match(issues.join("\n"), new RegExp(candidate.expectedIssue, "i"), candidate.id);
    }
  }
});

test("adapters may extend but may not weaken restrictions", () => {
  const valid = readJson("tests/fixtures/adapters/valid-repo-map.json");
  const weakening = readJson("tests/fixtures/adapters/weakening-repo-map.json");
  assertSchemaValid(adapterSchema, valid, "valid-repo-map");
  assert.deepEqual(adapterIssues(valid, { policies: policiesBySkill }), []);
  assert.ok(
    validateValue(adapterSchema, weakening).length > 0 ||
      adapterIssues(weakening, { policies: policiesBySkill }).some((issue) =>
        issue.includes("weakens"),
      ),
  );
});

test("adapter matrix rejects permission, failure, completion, secret, and mode overrides", () => {
  const valid = readJson("tests/fixtures/adapters/valid-narrowing.json");
  assertSchemaValid(adapterSchema, valid, "valid-narrowing");
  assert.deepEqual(adapterIssues(valid, { policies: policiesBySkill }), []);

  const invalid = [
    ["allow-deploy.json", /unsafe command alias/],
    ["allow-git-push.json", /unsafe command alias/],
    ["suppress-failures.json", /suppress failures/],
    ["redefine-completion.json", /redefine completion/],
    ["expose-secrets.json", /expose secrets/],
    ["override-audit-only.json", /override runtime-truth mode/],
    ["weakening-repo-map.json", /weakens required restriction/],
    ["incompatible-version.json", /incompatible/],
    ["remove-required-evidence.json", /remove required evidence/],
    ["expand-scope.json", /approval|expand scope/],
  ];
  for (const [file, expected] of invalid) {
    const adapter = readJson(`tests/fixtures/adapters/${file}`);
    const schemaErrors = validateValue(adapterSchema, adapter);
    const semanticErrors = adapterIssues(adapter, { policies: policiesBySkill });
    assert.ok(schemaErrors.length > 0 || semanticErrors.length > 0, file);
    assert.match([...schemaErrors, ...semanticErrors].join("\n"), expected, file);
  }
});

test("external adapter discovery accepts all supported directory conventions", () => {
  const validRoots = [
    ["valid-basic", "repo-map"],
    ["valid-doc-precedence", "llm-drift-control"],
    ["valid-runtime-status", "runtime-truth"],
  ];

  for (const [fixture, skill] of validRoots) {
    const result = validateExternalAdapters(
      path.join(root, "tests", "fixtures", "external-adapters", fixture),
      { coreRoot: root },
    );
    assert.equal(result.ok, true, fixture);
    assert.equal(result.status, "complete", fixture);
    assert.equal(result.accepted.length, 1, fixture);
    assert.deepEqual(result.accepted[0].skills, [skill], fixture);
    assert.equal(result.rejected.length, 0, fixture);
    assert.equal(result.failures.length, 0, fixture);
  }
});

test("external adapter discovery rejects incompatible and weakening fixtures", () => {
  const invalidRoots = [
    ["invalid-deploy", "unsafe-command-alias"],
    ["invalid-git-push", "unsafe-command-alias"],
    ["invalid-secret-exposure", "secret-exposure"],
    ["invalid-mode-escalation", "mode-override"],
    ["invalid-failure-suppression", "failure-suppression"],
    ["invalid-completion-override", "completion-override"],
    ["invalid-scope-expansion", "scope-expansion"],
    ["invalid-version", "unsupported-adapter-version"],
    ["invalid-skill-id", "unsupported-skill-id"],
    ["invalid-skill-version", "incompatible-skill-version"],
    ["invalid-path-traversal", "unsafe-path"],
    ["invalid-restriction-removal", "restriction-weakening"],
    ["invalid-evidence-suppression", "required-evidence-removal"],
    ["invalid-malformed", "schema-validation"],
    ["invalid-unknown-manifest", "missing-adapter-manifest"],
  ];

  for (const [fixture, expectedCode] of invalidRoots) {
    const result = validateExternalAdapters(
      path.join(root, "tests", "fixtures", "external-adapters", fixture),
      { coreRoot: root },
    );
    assert.equal(result.ok, false, fixture);
    const codes = [...result.rejected, ...result.failures].flatMap(
      (record) => record.codes,
    );
    assert.ok(codes.includes(expectedCode), `${fixture}: ${codes.join(",")}`);
  }
});

test("external adapter discovery handles mixed, empty, missing, and traversal roots", () => {
  const fixtureRoot = path.join(root, "tests", "fixtures", "external-adapters");
  const mixed = validateExternalAdapters(path.join(fixtureRoot, "mixed"), {
    coreRoot: root,
  });
  assert.equal(mixed.ok, false);
  assert.equal(mixed.accepted.length, 1);
  assert.equal(mixed.rejected.length, 1);

  const empty = validateExternalAdapters(path.join(fixtureRoot, "empty"), {
    coreRoot: root,
  });
  assert.equal(empty.ok, true);
  assert.equal(empty.status, "empty");
  assert.equal(empty.discovered, 0);

  const missing = validateExternalAdapters(path.join(fixtureRoot, "missing"), {
    coreRoot: root,
  });
  assert.equal(missing.ok, false);
  assert.deepEqual(missing.failures[0].codes, ["adapter-root-not-found"]);

  const traversal = validateExternalAdapters("../external-adapters/valid-basic", {
    coreRoot: root,
  });
  assert.equal(traversal.ok, false);
  assert.deepEqual(traversal.failures[0].codes, ["root-path-traversal"]);
});

test("external adapter discovery rejects malformed JSON and symlink escapes", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adapter-discovery-"));
  try {
    const malformedDirectory = path.join(
      temporaryRoot,
      "malformed",
      ".coding-agent",
      "adapters",
      "sample",
    );
    fs.mkdirSync(malformedDirectory, { recursive: true });
    fs.copyFileSync(
      path.join(
        root,
        "tests",
        "fixtures",
        "external-adapters",
        "invalid-malformed",
        "malformed-adapter.txt",
      ),
      path.join(malformedDirectory, "adapter.json"),
    );
    const malformed = validateExternalAdapters(
      path.join(temporaryRoot, "malformed"),
      { coreRoot: root },
    );
    assert.equal(malformed.ok, false);
    assert.deepEqual(malformed.rejected[0].codes, ["malformed-json"]);

    const symlinkRoot = path.join(temporaryRoot, "symlink");
    fs.mkdirSync(path.join(symlinkRoot, ".coding-agent"), { recursive: true });
    fs.symlinkSync(
      path.join(
        root,
        "tests",
        "fixtures",
        "external-adapters",
        "valid-basic",
        ".coding-agent",
        "adapters",
      ),
      path.join(symlinkRoot, ".coding-agent", "adapters"),
      "dir",
    );
    const symlink = validateExternalAdapters(symlinkRoot, { coreRoot: root });
    assert.equal(symlink.ok, false);
    assert.deepEqual(symlink.failures[0].codes, ["symlink-escape"]);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("external adapter discovery ignores unrelated secret files and redacts manifest rejection", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adapter-privacy-"));
  const syntheticValue = readJson("tests/fixtures/privacy/cases.json")
    .cases.find((candidate) => candidate.id === "fake-github-token")
    .parts.join("");

  try {
    const safeRoot = path.join(temporaryRoot, "safe");
    const safeDirectory = path.join(
      safeRoot,
      ".coding-agent",
      "adapters",
      "sample",
    );
    fs.mkdirSync(safeDirectory, { recursive: true });
    fs.copyFileSync(
      path.join(
        root,
        "tests",
        "fixtures",
        "external-adapters",
        "valid-basic",
        ".coding-agent",
        "adapters",
        "basic",
        "adapter.json",
      ),
      path.join(safeDirectory, "adapter.json"),
    );
    fs.writeFileSync(path.join(safeRoot, ".env"), `SYNTHETIC=${syntheticValue}\n`);
    const safe = validateExternalAdapters(safeRoot, { coreRoot: root });
    assert.equal(safe.ok, true);

    const rejectedRoot = path.join(temporaryRoot, "rejected");
    const rejectedDirectory = path.join(
      rejectedRoot,
      ".coding-agent",
      "adapters",
      "sample",
    );
    fs.mkdirSync(rejectedDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(rejectedDirectory, "adapter.json"),
      JSON.stringify({ synthetic: syntheticValue }),
    );
    const rejected = validateExternalAdapters(rejectedRoot, { coreRoot: root });
    assert.equal(rejected.ok, false);
    assert.deepEqual(rejected.rejected[0].codes, ["secret-like-content"]);
    assert.doesNotMatch(
      formatExternalAdapterSummary(rejected).join("\n"),
      new RegExp(syntheticValue),
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("external adapter CLI uses stable exit codes and safe summaries", () => {
  const fixtureRoot = path.join(root, "tests", "fixtures", "external-adapters");
  const valid = externalAdapterCliResult(path.join(fixtureRoot, "valid-basic"), {
    coreRoot: root,
  });
  assert.equal(valid.exitCode, 0);
  assert.equal(valid.stream, "stdout");
  assert.match(valid.lines.join("\n"), /1 accepted, 0 rejected/);

  const invalid = externalAdapterCliResult(
    path.join(fixtureRoot, "invalid-deploy"),
    { coreRoot: root },
  );
  assert.equal(invalid.exitCode, 1);
  assert.equal(invalid.stream, "stderr");
  assert.match(invalid.lines.join("\n"), /unsafe-command-alias/);
  assert.doesNotMatch(
    invalid.lines.join("\n"),
    /wrangler|fixture-external|adapterId/i,
  );

  const usage = externalAdapterCliResult(undefined, {
    coreRoot: root,
  });
  assert.equal(usage.exitCode, 2);
  assert.equal(usage.stream, "stderr");
  assert.match(usage.lines.join("\n"), /usage:/i);

  const summary = formatExternalAdapterSummary(
    validateExternalAdapters(path.join(fixtureRoot, "mixed"), { coreRoot: root }),
  ).join("\n");
  assert.doesNotMatch(summary, /git push|fixture-mixed|adapterId/i);
});

test("project adapter declarations satisfy schema and supported pin forms", () => {
  const fixtureRoot = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-installation",
  );
  const declarations = [
    ["valid-exact-pin", ".coding-agent/skills.json"],
    ["valid-compatible-range", "coding-agent.skills.json"],
    ["valid-multiple-adapters", ".coding-agent/skills.json"],
  ];

  for (const [fixture, relative] of declarations) {
    assertSchemaValid(
      projectInstallationSchema,
      JSON.parse(fs.readFileSync(path.join(fixtureRoot, fixture, relative), "utf8")),
      fixture,
    );
  }

  assert.deepEqual(parseSemver("0.1.6"), [0, 1, 6]);
  assert.equal(parseSemver("v0.1.6"), null);
  assert.equal(parseSemver("00.1.6"), null);
  assert.ok(parseVersionPin("0.1.6"));
  assert.ok(parseVersionPin(">=0.1.3 <0.2.0"));
  assert.equal(parseVersionPin("^0.1.6"), null);
  assert.equal(satisfiesVersionPin("0.1.6", "0.1.6"), true);
  assert.equal(satisfiesVersionPin("0.1.6", ">=0.1.3 <0.2.0"), true);
  assert.equal(satisfiesVersionPin("0.1.6", "<0.1.6"), false);
  assert.equal(satisfiesVersionPin("0.1.6", ">=0.2.0"), false);
});

test("project adapter installation accepts exact, range, and multiple adapters", () => {
  const fixtureRoot = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-installation",
  );
  const valid = [
    ["valid-exact-pin", 1, ["repo-map"]],
    ["valid-compatible-range", 1, ["llm-drift-control"]],
    ["valid-multiple-adapters", 2, ["repo-map", "runtime-truth"]],
  ];

  for (const [fixture, adapterCount, skills] of valid) {
    const result = validateProjectAdapters(path.join(fixtureRoot, fixture), {
      coreRoot: root,
    });
    assert.equal(result.ok, true, fixture);
    assert.equal(result.acceptedAdapters, adapterCount, fixture);
    assert.deepEqual(result.acceptedSkills, skills, fixture);
  }
});

test("project adapter installation rejects invalid pins, declarations, and adapters", () => {
  const fixtureRoot = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-installation",
  );
  const invalid = [
    ["invalid-missing-declaration", "missing-project-declaration"],
    ["invalid-unsupported-core-version", "unsupported-core-version"],
    ["invalid-bad-semver", "invalid-semver"],
    ["invalid-unknown-skill", "unsupported-skill-id"],
    ["invalid-adapter-version-mismatch", "adapter-version-mismatch"],
    ["invalid-adapter-schema-version", "unsupported-adapter-version"],
    ["invalid-adapter-location", "invalid-adapter-location"],
    ["invalid-skill-mismatch", "adapter-skill-mismatch"],
    ["invalid-mode-escalation", "mode-override"],
    ["invalid-failure-suppression", "failure-suppression"],
    ["invalid-completion-override", "completion-override"],
    ["invalid-weakens-restrictions", "restriction-weakening"],
    ["invalid-secret-exposure", "secret-exposure"],
    ["invalid-scope-expansion", "scope-expansion"],
    ["invalid-path-traversal", "unsafe-project-path"],
  ];

  for (const [fixture, expectedCode] of invalid) {
    const result = validateProjectAdapters(path.join(fixtureRoot, fixture), {
      coreRoot: root,
    });
    assert.equal(result.ok, false, fixture);
    assert.ok(result.codes.includes(expectedCode), `${fixture}: ${result.codes}`);
  }
});

test("project adapter installation rejects old core pins, ambiguity, and symlink escape", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "project-adapter-"));
  const source = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-installation",
    "valid-exact-pin",
  );

  try {
    const oldCore = path.join(temporaryRoot, "old-core");
    fs.cpSync(source, oldCore, { recursive: true });
    const oldDeclarationPath = path.join(oldCore, ".coding-agent", "skills.json");
    const oldDeclaration = JSON.parse(fs.readFileSync(oldDeclarationPath, "utf8"));
    oldDeclaration.core.expectedVersion = "0.1.0";
    oldDeclaration.core.versionPin = "0.1.0";
    fs.writeFileSync(oldDeclarationPath, JSON.stringify(oldDeclaration));
    const oldResult = validateProjectAdapters(oldCore, { coreRoot: root });
    assert.equal(oldResult.ok, false);
    assert.ok(oldResult.codes.includes("unsupported-core-version"));

    const missingVersion = path.join(temporaryRoot, "missing-version");
    fs.cpSync(source, missingVersion, { recursive: true });
    const missingVersionPath = path.join(
      missingVersion,
      ".coding-agent",
      "skills.json",
    );
    const missingDeclaration = JSON.parse(
      fs.readFileSync(missingVersionPath, "utf8"),
    );
    delete missingDeclaration.core.versionPin;
    fs.writeFileSync(missingVersionPath, JSON.stringify(missingDeclaration));
    const missingVersionResult = validateProjectAdapters(missingVersion, {
      coreRoot: root,
    });
    assert.equal(missingVersionResult.ok, false);
    assert.ok(missingVersionResult.codes.includes("declaration-schema"));
    assert.ok(missingVersionResult.codes.includes("invalid-semver"));

    const ambiguous = path.join(temporaryRoot, "ambiguous");
    fs.cpSync(source, ambiguous, { recursive: true });
    fs.copyFileSync(
      path.join(ambiguous, ".coding-agent", "skills.json"),
      path.join(ambiguous, "coding-agent.skills.json"),
    );
    const ambiguousResult = validateProjectAdapters(ambiguous, { coreRoot: root });
    assert.equal(ambiguousResult.ok, false);
    assert.deepEqual(ambiguousResult.codes, ["ambiguous-project-declaration"]);

    const symlinkRoot = path.join(temporaryRoot, "symlink");
    fs.mkdirSync(path.join(symlinkRoot, ".coding-agent"), { recursive: true });
    fs.symlinkSync(
      path.join(source, ".coding-agent", "skills.json"),
      path.join(symlinkRoot, ".coding-agent", "skills.json"),
    );
    const symlinkResult = validateProjectAdapters(symlinkRoot, { coreRoot: root });
    assert.equal(symlinkResult.ok, false);
    assert.deepEqual(symlinkResult.codes, ["symlink-escape"]);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("project adapter installation ignores .env and keeps summaries secret-safe", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "project-privacy-"));
  const source = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-installation",
    "valid-exact-pin",
  );
  const syntheticValue = readJson("tests/fixtures/privacy/cases.json")
    .cases.find((candidate) => candidate.id === "fake-github-token")
    .parts.join("");

  try {
    const safe = path.join(temporaryRoot, "safe");
    fs.cpSync(source, safe, { recursive: true });
    fs.writeFileSync(path.join(safe, ".env"), `SYNTHETIC=${syntheticValue}\n`);
    assert.equal(validateProjectAdapters(safe, { coreRoot: root }).ok, true);

    const rejected = path.join(temporaryRoot, "rejected");
    fs.cpSync(source, rejected, { recursive: true });
    const declarationPath = path.join(rejected, ".coding-agent", "skills.json");
    const declaration = JSON.parse(fs.readFileSync(declarationPath, "utf8"));
    declaration.syntheticNote = syntheticValue;
    fs.writeFileSync(declarationPath, JSON.stringify(declaration));
    const rejectedResult = validateProjectAdapters(rejected, { coreRoot: root });
    assert.equal(rejectedResult.ok, false);
    assert.deepEqual(rejectedResult.codes, ["secret-like-content"]);
    assert.doesNotMatch(
      formatProjectAdapterSummary(rejectedResult).join("\n"),
      new RegExp(syntheticValue),
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("project adapter CLI uses stable exit codes and safe summaries", () => {
  const fixtureRoot = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-installation",
  );
  const valid = projectAdapterCliResult(path.join(fixtureRoot, "valid-exact-pin"), {
    coreRoot: root,
  });
  assert.equal(valid.exitCode, 0);
  assert.equal(valid.stream, "stdout");
  assert.match(valid.lines.join("\n"), /core pin accepted/);

  const invalid = projectAdapterCliResult(
    path.join(fixtureRoot, "invalid-secret-exposure"),
    { coreRoot: root },
  );
  assert.equal(invalid.exitCode, 1);
  assert.equal(invalid.stream, "stderr");
  assert.match(invalid.lines.join("\n"), /secret-exposure/);
  assert.doesNotMatch(invalid.lines.join("\n"), /fixture-project|adapterId/i);

  const usage = projectAdapterCliResult(undefined, { coreRoot: root });
  assert.equal(usage.exitCode, 2);
  assert.equal(usage.stream, "stderr");
  assert.match(usage.lines.join("\n"), /usage:/i);
});

test("adapter-aware repo-map consumes validated project adapter metadata", () => {
  const fixtureRoot = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-installation",
  );
  const report = buildAdapterRepoMapReport(path.join(fixtureRoot, "valid-exact-pin"), {
    coreRoot: root,
  });
  assert.equal(report.ok, true, report.codes?.join(","));
  assert.deepEqual(report.enabledSkills, ["repo-map"]);
  assert.deepEqual(report.adapterIds, ["fixture-project-basic"]);
  assert.deepEqual(
    report.safeReadPaths.map((record) => record.path),
    ["README.md", "src"],
  );
  assert.deepEqual(report.ignoredPaths, ["dist"]);
  assert.deepEqual(report.requiredEvidence, [
    "repository root",
    "application entry point",
  ]);

  const rendered = renderAdapterRepoMapReport(report);
  assert.match(rendered, /# Adapter-Aware Repo Map/);
  assert.match(rendered, /## Safe Read Paths/);
  assert.match(rendered, /README\.md/);
  assert.match(rendered, /## Ignored Paths/);
  assert.match(rendered, /No target project build, test, runtime, deployment/);
});

test("adapter-aware repo-map fails closed without repo-map compatibility", () => {
  const fixtureRoot = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-installation",
  );
  const report = buildAdapterRepoMapReport(
    path.join(fixtureRoot, "valid-compatible-range"),
    { coreRoot: root },
  );
  assert.equal(report.ok, false);
  assert.deepEqual(report.codes, ["repo-map-not-enabled"]);

  const cli = adapterRepoMapCliResult(path.join(fixtureRoot, "valid-exact-pin"), {
    coreRoot: root,
  });
  assert.equal(cli.exitCode, 0);
  assert.equal(cli.stream, "stdout");
  assert.match(cli.lines.join("\n"), /Enabled skills: repo-map/);

  const usage = adapterRepoMapCliResult(undefined, { coreRoot: root });
  assert.equal(usage.exitCode, 2);
  assert.equal(usage.stream, "stderr");
  assert.match(usage.lines.join("\n"), /usage:/i);
});

test("adapter upgrade accepts safe exact and compatible-range revisions", () => {
  const fixtureRoot = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-upgrades",
  );
  for (const fixture of ["valid-upgrade", "safe-upgrade-preserves-restrictions"]) {
    const result = checkAdapterUpgrade(
      path.join(fixtureRoot, fixture, "before"),
      path.join(fixtureRoot, fixture, "after"),
      { coreRoot: root },
    );
    assert.equal(result.ok, true, `${fixture}: ${result.codes}`);
    assert.equal(result.comparedAdapters, 1);
    assert.equal(result.comparedSkills, 1);
  }
});

test("adapter upgrade detects stale exact pins and compatible ranges", () => {
  const fixtureRoot = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-upgrades",
  );
  for (const [fixture, code] of [
    ["stale-exact-pin", "stale-exact-pin"],
    ["stale-compatible-range", "stale-compatible-range"],
  ]) {
    const result = checkAdapterUpgrade(
      path.join(fixtureRoot, fixture, "before"),
      path.join(fixtureRoot, fixture, "after"),
      { coreRoot: root },
    );
    assert.equal(result.ok, false, fixture);
    assert.ok(result.codes.includes(code), `${fixture}: ${result.codes}`);
  }
});

test("adapter upgrade rejects unsupported cores and compatibility drift", () => {
  const fixtureRoot = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-upgrades",
  );
  for (const [fixture, code] of [
    ["unsupported-future-core", "unsupported-future-core"],
    ["unsupported-old-core", "unsupported-old-core"],
    ["adapter-schema-drift", "adapter-schema-drift"],
    ["skill-compatibility-drift", "skill-compatibility-drift"],
  ]) {
    const result = checkAdapterUpgrade(
      path.join(fixtureRoot, fixture, "before"),
      path.join(fixtureRoot, fixture, "after"),
      { coreRoot: root },
    );
    assert.equal(result.ok, false, fixture);
    assert.ok(result.codes.includes(code), `${fixture}: ${result.codes}`);
  }
});

test("adapter upgrade rejects restriction, mode, and evidence weakening", () => {
  const fixtureRoot = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-upgrades",
  );
  for (const [fixture, code] of [
    ["unsafe-upgrade-weakens-restrictions", "restriction-weakening"],
    ["unsafe-upgrade-mode-escalation", "mode-escalation"],
    ["unsafe-upgrade-removes-evidence", "required-evidence-removal"],
  ]) {
    const result = checkAdapterUpgrade(
      path.join(fixtureRoot, fixture, "before"),
      path.join(fixtureRoot, fixture, "after"),
      { coreRoot: root },
    );
    assert.equal(result.ok, false, fixture);
    assert.ok(result.codes.includes(code), `${fixture}: ${result.codes}`);
  }
});

test("adapter upgrade rejects dynamic unsafe revision attempts without leaking values", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adapter-upgrade-"));
  const source = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-upgrades",
    "valid-upgrade",
  );
  const syntheticValue = readJson("tests/fixtures/privacy/cases.json")
    .cases.find((candidate) => candidate.id === "fake-github-token")
    .parts.join("");

  function prepare(name) {
    const destination = path.join(temporaryRoot, name);
    fs.cpSync(source, destination, { recursive: true });
    return {
      before: path.join(destination, "before"),
      after: path.join(destination, "after"),
      declaration: path.join(
        destination,
        "after",
        ".coding-agent",
        "skills.json",
      ),
      adapter: path.join(
        destination,
        "after",
        ".coding-agent",
        "adapters",
        "fixture-upgrade-adapter",
        "adapter.json",
      ),
    };
  }

  function editJson(file, callback) {
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    callback(value);
    fs.writeFileSync(file, JSON.stringify(value));
  }

  try {
    for (const [name, code, mutate] of [
      [
        "failure",
        "failure-suppression",
        ({ adapter }) =>
          editJson(adapter, (value) => {
            value.inheritance.allowFailureSuppression = true;
          }),
      ],
      [
        "completion",
        "completion-override",
        ({ adapter }) =>
          editJson(adapter, (value) => {
            value.inheritance.allowCompletionOverride = true;
          }),
      ],
      [
        "adapter-version",
        "adapter-version-drift",
        ({ declaration, adapter }) => {
          editJson(declaration, (value) => {
            value.adapters[0].version = "1.0.1";
          });
          editJson(adapter, (value) => {
            value.adapterVersion = "1.0.1";
          });
        },
      ],
      [
        "unknown-skill",
        "unknown-skill-compatibility",
        ({ declaration, adapter }) => {
          editJson(declaration, (value) => {
            value.compatibleSkillIds = ["future-skill"];
            value.adapters[0].skillIds = ["future-skill"];
          });
          editJson(adapter, (value) => {
            value.supportedSkills[0].id = "future-skill";
          });
        },
      ],
      [
        "path",
        "path-traversal",
        ({ declaration }) =>
          editJson(declaration, (value) => {
            value.evidenceOutput = "../outside/evidence.json";
          }),
      ],
      [
        "scope",
        "scope-expansion",
        ({ adapter }) =>
          editJson(adapter, (value) => {
            value.project.detection.requireApprovalOutsideScope = false;
            value.inheritance.allowScopeExpansionWithoutApproval = true;
          }),
      ],
    ]) {
      const revision = prepare(name);
      mutate(revision);
      const result = checkAdapterUpgrade(revision.before, revision.after, {
        coreRoot: root,
      });
      assert.equal(result.ok, false, name);
      assert.ok(result.codes.includes(code), `${name}: ${result.codes}`);
    }

    const env = prepare("env");
    fs.writeFileSync(path.join(env.after, ".env"), `SYNTHETIC=${syntheticValue}\n`);
    const envResult = checkAdapterUpgrade(env.before, env.after, {
      coreRoot: root,
    });
    assert.equal(envResult.ok, true, envResult.codes.join(","));

    const secret = prepare("secret");
    editJson(secret.declaration, (value) => {
      value.syntheticNote = syntheticValue;
    });
    const secretResult = checkAdapterUpgrade(secret.before, secret.after, {
      coreRoot: root,
    });
    assert.equal(secretResult.ok, false);
    assert.ok(secretResult.codes.includes("secret-exposure"));
    assert.doesNotMatch(
      formatAdapterUpgradeSummary(secretResult).join("\n"),
      new RegExp(syntheticValue),
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("adapter upgrade CLI uses stable exit codes and safe summaries", () => {
  const fixtureRoot = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-upgrades",
  );
  const valid = adapterUpgradeCliResult(
    path.join(fixtureRoot, "valid-upgrade", "before"),
    path.join(fixtureRoot, "valid-upgrade", "after"),
    { coreRoot: root },
  );
  assert.equal(valid.exitCode, 0);
  assert.equal(valid.stream, "stdout");
  assert.match(valid.lines.join("\n"), /target core accepted/);

  const invalid = adapterUpgradeCliResult(
    path.join(fixtureRoot, "stale-exact-pin", "before"),
    path.join(fixtureRoot, "stale-exact-pin", "after"),
    { coreRoot: root },
  );
  assert.equal(invalid.exitCode, 1);
  assert.equal(invalid.stream, "stderr");
  assert.match(invalid.lines.join("\n"), /stale-exact-pin/);
  assert.doesNotMatch(invalid.lines.join("\n"), /fixture-upgrade|adapterId/i);

  const usage = adapterUpgradeCliResult(undefined, undefined, {
    coreRoot: root,
  });
  assert.equal(usage.exitCode, 2);
  assert.equal(usage.stream, "stderr");
  assert.match(usage.lines.join("\n"), /usage:/i);
});

test("upgrade evidence examples validate and declare no project state change", () => {
  for (const file of [
    "valid-upgrade.evidence.json",
    "stale-pin.evidence.json",
    "unsafe-upgrade.evidence.json",
    "chain-pass.evidence.json",
    "chain-fail.evidence.json",
  ]) {
    const evidence = readJson(`examples/upgrade-evidence/${file}`);
    assertSchemaValid(upgradeEvidenceSchema, evidence, file);
    assert.equal(evidence.changedState.changed, false, file);
    assert.doesNotMatch(JSON.stringify(evidence), /\/home\/|projectId|github_pat_|ghp_/i);
  }
});

test("adapter upgrade JSON and explicit output remain schema-valid and bounded", () => {
  const fixtureRoot = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-upgrades",
    "valid-upgrade",
  );
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "upgrade-output-"));

  try {
    const json = adapterUpgradeCliResult(
      path.join(fixtureRoot, "before"),
      path.join(fixtureRoot, "after"),
      { coreRoot: root, json: true },
    );
    assert.equal(json.exitCode, 0);
    assert.equal(json.stream, "stdout");
    assertSchemaValid(upgradeEvidenceSchema, JSON.parse(json.lines[0]), "pair JSON");

    const written = adapterUpgradeCliResult(
      path.join(fixtureRoot, "before"),
      path.join(fixtureRoot, "after"),
      {
        coreRoot: root,
        output: "upgrade.json",
        outputBase: temporaryRoot,
      },
    );
    assert.equal(written.exitCode, 0);
    const output = JSON.parse(
      fs.readFileSync(path.join(temporaryRoot, "upgrade.json"), "utf8"),
    );
    assertSchemaValid(upgradeEvidenceSchema, output, "pair output");
    assert.equal(output.changedState.changed, false);

    const overwrite = adapterUpgradeCliResult(
      path.join(fixtureRoot, "before"),
      path.join(fixtureRoot, "after"),
      {
        coreRoot: root,
        output: "upgrade.json",
        outputBase: temporaryRoot,
      },
    );
    assert.equal(overwrite.exitCode, 2);
    assert.match(overwrite.lines.join("\n"), /output-already-exists/);

    for (const unsafe of ["../outside.json", ".env.json", "/tmp/outside.json"]) {
      const rejected = adapterUpgradeCliResult(
        path.join(fixtureRoot, "before"),
        path.join(fixtureRoot, "after"),
        {
          coreRoot: root,
          output: unsafe,
          outputBase: temporaryRoot,
        },
      );
      assert.equal(rejected.exitCode, 2, unsafe);
      assert.match(rejected.lines.join("\n"), /unsafe-output-path/, unsafe);
    }

    const realOutput = path.join(temporaryRoot, "real");
    fs.mkdirSync(realOutput);
    fs.symlinkSync(realOutput, path.join(temporaryRoot, "linked"));
    const symlinked = adapterUpgradeCliResult(
      path.join(fixtureRoot, "before"),
      path.join(fixtureRoot, "after"),
      {
        coreRoot: root,
        output: "linked/report.json",
        outputBase: temporaryRoot,
      },
    );
    assert.equal(symlinked.exitCode, 2);
    assert.match(symlinked.lines.join("\n"), /output-symlink-escape/);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("adapter upgrade chains accept safe revisions and reject named fixture drift", () => {
  const fixtureRoot = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-upgrade-chains",
  );
  const valid = checkAdapterUpgradeChain(path.join(fixtureRoot, "valid-chain"), {
    coreRoot: root,
  });
  assert.equal(valid.ok, true, valid.codes.join(","));
  assert.equal(valid.revisionCount, 7);
  assert.equal(valid.transitionCount, 6);

  for (const [fixture, code] of [
    ["stale-pin-chain", "stale-exact-pin"],
    ["broken-compatibility-chain", "skill-compatibility-drift"],
    ["unsafe-weakening-chain", "restriction-weakening"],
    ["schema-drift-chain", "adapter-schema-drift"],
    ["skill-drift-chain", "skill-compatibility-drift"],
  ]) {
    const result = checkAdapterUpgradeChain(path.join(fixtureRoot, fixture), {
      coreRoot: root,
    });
    assert.equal(result.ok, false, fixture);
    assert.ok(result.codes.includes(code), `${fixture}: ${result.codes}`);
  }
});

test("adapter chain evidence is schema-valid and summarizes ordinal transitions", () => {
  const fixtureRoot = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-upgrade-chains",
  );
  for (const fixture of ["valid-chain", "unsafe-weakening-chain"]) {
    const result = adapterChainCliResult(path.join(fixtureRoot, fixture), {
      coreRoot: root,
      json: true,
      invocationId: `test-${fixture}`,
      chainId: `test-${fixture}`,
      timestamp: "2026-06-14T12:00:00Z",
    });
    const evidence = JSON.parse(result.lines[0]);
    assertSchemaValid(upgradeEvidenceSchema, evidence, fixture);
    assert.equal(evidence.changedState.changed, false);
    assert.ok(evidence.chainSummary.steps.length > 0);
    assert.match(evidence.chainSummary.steps[0].beforeRevision, /^revision-/);
    assert.doesNotMatch(JSON.stringify(evidence), /01-current|fixture-chain-project/);
  }
});

test("adapter chains reject dynamic evidence, mode, failure, completion, and version drift", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "chain-drift-"));
  const source = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-upgrade-chains",
    "valid-chain",
  );

  function prepare(name) {
    const destination = path.join(temporaryRoot, name);
    fs.cpSync(source, destination, { recursive: true });
    return {
      root: destination,
      declaration: path.join(destination, "03-upgrade", ".coding-agent", "skills.json"),
      adapter: path.join(
        destination,
        "03-upgrade",
        ".coding-agent",
        "adapters",
        "fixture-chain-adapter",
        "adapter.json",
      ),
      middleDeclaration: path.join(
        destination,
        "02-upgrade",
        ".coding-agent",
        "skills.json",
      ),
      middleAdapter: path.join(
        destination,
        "02-upgrade",
        ".coding-agent",
        "adapters",
        "fixture-chain-adapter",
        "adapter.json",
      ),
    };
  }

  function editJson(file, callback) {
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    callback(value);
    fs.writeFileSync(file, JSON.stringify(value));
  }

  try {
    for (const [name, code, mutate] of [
      [
        "evidence",
        "required-evidence-removal",
        ({ adapter }) =>
          editJson(adapter, (value) => {
            value.extensions.requiredEvidence = ["repository root"];
          }),
      ],
      [
        "failure",
        "failure-suppression",
        ({ adapter }) =>
          editJson(adapter, (value) => {
            value.inheritance.allowFailureSuppression = true;
          }),
      ],
      [
        "completion",
        "completion-override",
        ({ adapter }) =>
          editJson(adapter, (value) => {
            value.inheritance.allowCompletionOverride = true;
          }),
      ],
      [
        "mode",
        "mode-escalation",
        ({ adapter }) =>
          editJson(adapter, (value) => {
            value.supportedSkills[0].declaredMode = "action-capable";
          }),
      ],
      [
        "adapter-version",
        "adapter-version-drift",
        ({ declaration, adapter }) => {
          editJson(declaration, (value) => {
            value.adapters[0].version = "1.0.1";
          });
          editJson(adapter, (value) => {
            value.adapterVersion = "1.0.1";
          });
        },
      ],
      [
        "core-jump",
        "incompatible-core-chain",
        ({ middleDeclaration, middleAdapter }) => {
          editJson(middleDeclaration, (value) => {
            value.core.expectedVersion = "0.1.6";
            value.core.versionPin = "0.1.6";
          });
          editJson(middleAdapter, (value) => {
            value.supportedSkills[0].compatibleVersions = ["0.1.6"];
          });
        },
      ],
    ]) {
      const chain = prepare(name);
      mutate(chain);
      const result = checkAdapterUpgradeChain(chain.root, { coreRoot: root });
      assert.equal(result.ok, false, name);
      assert.ok(result.codes.includes(code), `${name}: ${result.codes}`);
    }
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("adapter chain discovery ignores .env, preserves revisions, and redacts secrets", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "chain-privacy-"));
  const source = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-upgrade-chains",
    "valid-chain",
  );
  const syntheticValue = readJson("tests/fixtures/privacy/cases.json")
    .cases.find((candidate) => candidate.id === "fake-github-token")
    .parts.join("");

  try {
    const safe = path.join(temporaryRoot, "safe");
    fs.cpSync(source, safe, { recursive: true });
    fs.writeFileSync(path.join(safe, ".env"), `SYNTHETIC=${syntheticValue}\n`);
    fs.writeFileSync(
      path.join(safe, "02-upgrade", ".env.local"),
      `SYNTHETIC=${syntheticValue}\n`,
    );
    const before = snapshotAbsoluteDirectory(safe);
    const safeResult = checkAdapterUpgradeChain(safe, { coreRoot: root });
    const after = snapshotAbsoluteDirectory(safe);
    assert.equal(safeResult.ok, true, safeResult.codes.join(","));
    assert.equal(after, before, "chain validation mutated a project revision");

    const secret = path.join(temporaryRoot, "secret");
    fs.cpSync(source, secret, { recursive: true });
    const declaration = path.join(
      secret,
      "03-upgrade",
      ".coding-agent",
      "skills.json",
    );
    const value = JSON.parse(fs.readFileSync(declaration, "utf8"));
    value.syntheticNote = syntheticValue;
    fs.writeFileSync(declaration, JSON.stringify(value));
    const secretResult = checkAdapterUpgradeChain(secret, { coreRoot: root });
    assert.equal(secretResult.ok, false);
    assert.ok(secretResult.codes.includes("secret-exposure"));
    assert.doesNotMatch(
      formatAdapterChainSummary(secretResult).join("\n"),
      new RegExp(syntheticValue),
    );
    const evidence = adapterChainCliResult(secret, {
      coreRoot: root,
      json: true,
    }).lines[0];
    assert.doesNotMatch(evidence, new RegExp(syntheticValue));
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("adapter chain discovery rejects symlink escapes and non-contiguous order", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "chain-path-"));
  const source = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-upgrade-chains",
    "valid-chain",
  );

  try {
    const rootLink = path.join(temporaryRoot, "root-link");
    fs.symlinkSync(source, rootLink);
    assert.deepEqual(checkAdapterUpgradeChain(rootLink, { coreRoot: root }).codes, [
      "symlink-escape",
    ]);

    const linkedRevision = path.join(temporaryRoot, "linked-revision");
    fs.cpSync(source, linkedRevision, { recursive: true });
    fs.symlinkSync(
      path.join(source, "03-upgrade"),
      path.join(linkedRevision, "04-linked"),
    );
    assert.ok(
      checkAdapterUpgradeChain(linkedRevision, { coreRoot: root }).codes.includes(
        "symlink-escape",
      ),
    );

    const gap = path.join(temporaryRoot, "gap");
    fs.cpSync(source, gap, { recursive: true });
    fs.renameSync(path.join(gap, "07-upgrade"), path.join(gap, "08-upgrade"));
    assert.ok(
      checkAdapterUpgradeChain(gap, { coreRoot: root }).codes.includes(
        "non-contiguous-chain-order",
      ),
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("adapter chain CLI uses stable exits, safe JSON, and bounded output", () => {
  const fixtureRoot = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-upgrade-chains",
  );
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "chain-output-"));

  try {
    const valid = adapterChainCliResult(path.join(fixtureRoot, "valid-chain"), {
      coreRoot: root,
    });
    assert.equal(valid.exitCode, 0);
    assert.equal(valid.stream, "stdout");
    assert.match(valid.lines.join("\n"), /6 transitions accepted/);

    const invalid = adapterChainCliResult(
      path.join(fixtureRoot, "stale-pin-chain"),
      { coreRoot: root },
    );
    assert.equal(invalid.exitCode, 1);
    assert.equal(invalid.stream, "stderr");
    assert.match(invalid.lines.join("\n"), /stale-exact-pin/);

    const written = adapterChainCliResult(path.join(fixtureRoot, "valid-chain"), {
      coreRoot: root,
      output: "chain.json",
      outputBase: temporaryRoot,
    });
    assert.equal(written.exitCode, 0);
    assertSchemaValid(
      upgradeEvidenceSchema,
      JSON.parse(fs.readFileSync(path.join(temporaryRoot, "chain.json"), "utf8")),
      "chain output",
    );

    const traversal = adapterChainCliResult(
      path.join(fixtureRoot, "valid-chain"),
      {
        coreRoot: root,
        output: "../chain.json",
        outputBase: temporaryRoot,
      },
    );
    assert.equal(traversal.exitCode, 2);
    assert.match(traversal.lines.join("\n"), /unsafe-output-path/);

    const usage = adapterChainCliResult(undefined, { coreRoot: root });
    assert.equal(usage.exitCode, 2);
    assert.match(usage.lines.join("\n"), /usage:/i);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("evidence bundles verify hashes, schemas, replay, and regression state", () => {
  const fixtureRoot = path.join(root, "tests", "fixtures", "evidence-bundles");
  const bundle = readJson("tests/fixtures/evidence-bundles/valid-bundle/evidence-bundle.json");
  assertSchemaValid(evidenceBundleSchema, bundle, "valid evidence bundle");

  const first = verifyEvidenceBundle(
    path.join(fixtureRoot, "valid-bundle", "evidence-bundle.json"),
    { coreRoot: root },
  );
  const second = verifyEvidenceBundle(
    path.join(fixtureRoot, "valid-bundle", "evidence-bundle.json"),
    { coreRoot: root },
  );
  assert.equal(first.ok, true, first.codes.join(","));
  assert.equal(first.entryCount, 2);
  assert.equal(first.replay.deterministic, true);
  assert.equal(first.replay.reportHash, second.replay.reportHash);
  assert.deepEqual(first.regression.codes, []);
  assert.deepEqual(first.retention.codes, []);
  assert.equal(first.retention.expiryAdvisory.status, "retained");
  assert.equal(first.retention.expiryAdvisory.deleteAutomatically, false);
  assert.deepEqual(first.provenance.codes, []);
  assert.equal(first.provenance.signature.verificationPlan.validatesSignatureNow, false);
  assert.deepEqual(first.archive.codes, []);
  assert.equal(first.archive.index.status, "present");
  assert.deepEqual(first.archive.index.entryIds, ["repo-map-evidence", "upgrade-evidence"]);
  assert.equal(first.changedState.changed, false);
});

test("evidence bundles report retention-expiry advisories without deleting", () => {
  const fixtureRoot = path.join(root, "tests", "fixtures", "evidence-bundles");
  const result = verifyEvidenceBundle(
    path.join(fixtureRoot, "advisory-review-soon", "evidence-bundle.json"),
    { coreRoot: root },
  );
  assert.equal(result.ok, true, result.codes.join(","));
  assert.equal(result.retention.expiryAdvisory.status, "review-soon");
  assert.equal(result.retention.expiryAdvisory.advisoryOnly, true);
  assert.equal(result.retention.expiryAdvisory.deleteAutomatically, false);
});

test("evidence bundles reject hash, missing-entry, regression, path, and archive failures", () => {
  const fixtureRoot = path.join(root, "tests", "fixtures", "evidence-bundles");
  for (const [fixture, code] of [
    ["invalid-hash", "hash-mismatch"],
    ["invalid-missing-entry", "entry-missing"],
    ["invalid-regression", "missing-baseline-entry"],
    ["invalid-path", "entry-path-traversal"],
    ["invalid-retention", "retention-retain-until-too-soon"],
    ["invalid-provenance", "provenance-tag-mismatch"],
    ["invalid-archive", "archive-raw-evidence-enabled"],
    ["invalid-archive-index", "archive-index-bundle-mismatch"],
    ["invalid-signature-plan", "provenance-verification-plan-runs-signature-check"],
  ]) {
    const result = verifyEvidenceBundle(
      path.join(fixtureRoot, fixture, "evidence-bundle.json"),
      { coreRoot: root },
    );
    assert.equal(result.ok, false, fixture);
    assert.ok(result.codes.includes(code), `${fixture}: ${result.codes}`);
  }
});

test("evidence bundle CLI uses stable exits and sanitized reports", () => {
  const fixtureRoot = path.join(root, "tests", "fixtures", "evidence-bundles");
  const valid = evidenceBundleCliResult(
    path.join(fixtureRoot, "valid-bundle", "evidence-bundle.json"),
    { coreRoot: root },
  );
  assert.equal(valid.exitCode, 0);
  assert.equal(valid.stream, "stdout");
  assert.match(valid.lines.join("\n"), /deterministic replay accepted/);

  const invalid = evidenceBundleCliResult(
    path.join(fixtureRoot, "invalid-hash", "evidence-bundle.json"),
    { coreRoot: root },
  );
  assert.equal(invalid.exitCode, 1);
  assert.equal(invalid.stream, "stderr");
  assert.match(invalid.lines.join("\n"), /hash-mismatch/);

  const json = evidenceBundleCliResult(
    path.join(fixtureRoot, "valid-bundle", "evidence-bundle.json"),
    { coreRoot: root, json: true },
  );
  assert.equal(json.exitCode, 0);
  assert.doesNotMatch(json.lines[0], /Repository identity|outputSummary/);
  assert.doesNotMatch(json.lines[0], /\/home\/|github_pat_|Authorization: Bearer/);
});

test("evidence archive reports are schema-valid, deterministic, and sanitized", () => {
  const fixtureRoot = path.join(root, "tests", "fixtures", "evidence-bundles");
  const first = buildEvidenceArchiveReport(
    path.join(fixtureRoot, "valid-bundle", "evidence-bundle.json"),
    { coreRoot: root },
  );
  const second = buildEvidenceArchiveReport(
    path.join(fixtureRoot, "valid-bundle", "evidence-bundle.json"),
    { coreRoot: root },
  );
  assert.equal(first.ok, true, first.codes.join(","));
  assert.equal(first.deterministic, true);
  assert.equal(first.reportHash, second.reportHash);
  assertSchemaValid(evidenceArchiveReportSchema, first.report, "archive report");
  assert.equal(first.report.changedState.changed, false);
  assert.equal(first.report.archive.writePolicy, "no-write-without-approval");
  assert.equal(first.report.archive.index.status, "present");
  assert.equal(first.report.retention.expiryAdvisory.status, "retained");
  assert.equal(first.report.retention.expiryAdvisory.deleteAutomatically, false);
  assert.equal(
    first.report.provenance.signature.verificationPlan.mode,
    "detached-signature-verification-plan",
  );
  assert.equal(first.report.provenance.signature.verificationPlan.validatesSignatureNow, false);
  assertSchemaValid(
    evidenceArchiveIndexSchema,
    readJson("tests/fixtures/evidence-bundles/valid-bundle/archive/evidence-archive-index.json"),
    "archive index",
  );
  const encoded = JSON.stringify(first.report);
  assert.doesNotMatch(
    encoded,
    /commandExecutionRecords|rawEvidence|github_pat_|Authorization: Bearer|\/home\//,
  );
});

test("evidence archive CLI uses stable exits and bounded sanitized summaries", () => {
  const fixtureRoot = path.join(root, "tests", "fixtures", "evidence-bundles");
  const valid = evidenceArchiveCliResult(
    path.join(fixtureRoot, "valid-bundle", "evidence-bundle.json"),
    { coreRoot: root },
  );
  assert.equal(valid.exitCode, 0);
  assert.equal(valid.stream, "stdout");
  assert.match(valid.lines.join("\n"), /sanitized summary accepted/);

  const json = evidenceArchiveCliResult(
    path.join(fixtureRoot, "valid-bundle", "evidence-bundle.json"),
    { coreRoot: root, json: true },
  );
  assert.equal(json.exitCode, 0);
  assertSchemaValid(evidenceArchiveReportSchema, JSON.parse(json.lines[0]), "archive CLI JSON");

  const invalid = evidenceArchiveCliResult(
    path.join(fixtureRoot, "invalid-archive", "evidence-bundle.json"),
    { coreRoot: root },
  );
  assert.equal(invalid.exitCode, 1);
  assert.equal(invalid.stream, "stderr");
  assert.match(invalid.lines.join("\n"), /archive-raw-evidence-enabled/);
  assert.doesNotMatch(
    invalid.lines.join("\n"),
    /repo-map\.evidence|valid-upgrade\.evidence|\/home\//,
  );

  const usage = evidenceArchiveCliResult(undefined, { coreRoot: root });
  assert.equal(usage.exitCode, 2);
  assert.match(usage.lines.join("\n"), /usage:/i);
});

test("audit-only agent prompts preserve their non-mutation boundary", () => {
  for (const skill of AUDIT_ONLY_SKILLS) {
    const metadata = read(`skills/${skill}/agents/openai.yaml`);
    assert.match(metadata, /default_prompt:/);
    assert.match(metadata, /without (?:modifying|changing|rewriting)/i);
  }
});

test("internal Markdown links resolve", () => {
  for (const file of walk(root).filter((candidate) => candidate.endsWith(".md"))) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const link = match[1];
      if (
        link.startsWith("#") ||
        /^[a-z]+:/i.test(link) ||
        link.includes("<") ||
        link.includes(">")
      ) {
        continue;
      }
      const target = path.resolve(path.dirname(file), link.split("#")[0]);
      assert.ok(fs.existsSync(target), `${path.relative(root, file)}: ${link}`);
    }
  }
});

test("tracked candidate files contain no obvious secret values", () => {
  const patterns = [
    /\bgh[pousr]_[A-Za-z0-9_]{12,}\b/,
    new RegExp(`\\b${"github" + "_pat_"}[A-Za-z0-9_]{12,}\\b`),
    /\beyJ[A-Za-z0-9._-]{20,}\b/,
    new RegExp(["-----BEGIN ", "(?:RSA |EC |OPENSSH )?", "PRIVATE KEY-----"].join("")),
    /Authorization:\s*Bearer\s+[A-Za-z0-9._-]{8,}/i,
  ];

  for (const file of walk(root).filter((candidate) =>
    /\.(?:md|json|yaml|yml|mjs|js)$/.test(candidate),
  )) {
    const text = fs.readFileSync(file, "utf8");
    for (const pattern of patterns) {
      assert.equal(pattern.test(text), false, path.relative(root, file));
    }
  }
});

test("privacy fixtures detect and redact synthetic sensitive shapes", () => {
  const fixture = readJson("tests/fixtures/privacy/cases.json");
  assert.equal(fixture.synthetic, true);
  assert.equal(fixture.encoding, "ordered-parts");

  for (const candidate of fixture.cases) {
    const syntheticValue = candidate.parts.join("");
    const detected = detectSensitiveValues(syntheticValue);
    for (const expected of candidate.expectedTypes) {
      assert.ok(detected.includes(expected), `${candidate.id}: missing ${expected}`);
    }
    const redacted = redactSensitiveText(syntheticValue);
    assert.deepEqual(detectSensitiveValues(redacted), [], candidate.id);
    assert.ok(redacted.includes("[REDACTED:"), candidate.id);
  }
});

test("reusable skill content contains no sensitive-looking values", () => {
  const reusableFiles = walk(path.join(root, "skills"))
    .concat(walk(path.join(root, "examples")))
    .filter((file) => /\.(?:md|json|yaml|yml)$/.test(file));

  for (const file of reusableFiles) {
    assert.deepEqual(
      detectSensitiveValues(fs.readFileSync(file, "utf8")),
      [],
      path.relative(root, file),
    );
  }
});

test("safe executable examples do not contain restricted shell operations", () => {
  const files = [
    "CONTRIBUTING.md",
    ...PILOT_SKILLS.map((skill) => `examples/workflows/${skill}.md`),
  ];

  for (const file of files) {
    for (const block of fencedShellBlocks(read(file))) {
      for (const line of block.split(/\r?\n/)) {
        const reason = restrictedShellReason(line);
        assert.equal(reason, null, `${file}: ${reason}: ${line}`);
      }
    }
  }
});

test("mutation fixtures distinguish procedures from explicit denials", () => {
  const fixture = readJson("tests/fixtures/mutation/cases.json");
  for (const candidate of fixture.cases) {
    const issues = auditOnlyDocumentIssues(candidate.document);
    assert.equal(issues.length, candidate.issues, candidate.id);
  }
});

test("audit-only skill documents remain non-mutating and snapshot state is unchanged", () => {
  const snapshotPath = "tests/fixtures/mutation/snapshot-target";
  const before = snapshotDirectory(snapshotPath);

  for (const skill of AUDIT_ONLY_SKILLS) {
    const skillDirectory = path.join(root, "skills", skill);
    for (const file of walk(skillDirectory).filter((candidate) => candidate.endsWith(".md"))) {
      assert.deepEqual(
        auditOnlyDocumentIssues(fs.readFileSync(file, "utf8")),
        [],
        path.relative(root, file),
      );
    }
  }

  assert.equal(snapshotDirectory(snapshotPath), before);
});

test("restricted inline commands are absent from safe skill example sections", () => {
  const files = PILOT_SKILLS.flatMap((skill) => [
    `skills/${skill}/examples.md`,
    `examples/workflows/${skill}.md`,
  ]);

  for (const file of files) {
    let unsafeSection = false;
    for (const line of read(file).split(/\r?\n/)) {
      if (/^#{1,6}\s+/.test(line)) unsafeSection = /\b(?:unsafe|denied)\b/i.test(line);
      if (/^\*\*Unsafe(?: and denied)?:\*\*/i.test(line)) unsafeSection = true;
      for (const match of line.matchAll(/`([^`\n]+)`/g)) {
        if (!commandLooksExecutable(match[1])) continue;
        const reason = restrictedShellReason(match[1]);
        assert.ok(!reason || unsafeSection, `${file}: ${reason}: ${match[1]}`);
      }
    }
  }
});

test("the sample repository remains dependency-free and runnable with built-in Node", async () => {
  const packageJson = readJson("tests/fixtures/sample-repo/package.json");
  assert.equal(packageJson.private, true);
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(packageJson.devDependencies, undefined);

  const module = await import(
    `${path.join(root, "tests/fixtures/sample-repo/src/index.js")}?fixture=${Date.now()}`
  );
  assert.equal(module.greeting("pilot"), "Hello, pilot.");
});

test(".gitignore protects local environments and generated validation output", () => {
  const patterns = new Set(read(".gitignore").split(/\r?\n/));
  for (const pattern of [
    ".env",
    ".env.*",
    "!.env.example",
    "*.log",
    "tmp/",
    ".vscode/",
    "validation-output/",
    "test-results/",
  ]) {
    assert.ok(patterns.has(pattern), `missing .gitignore rule ${pattern}`);
  }
});

let passed = 0;
for (const { name, callback } of tests) {
  try {
    await callback();
    passed += 1;
    console.log(`ok ${passed} - ${name}`);
  } catch (error) {
    console.error(`not ok ${passed + 1} - ${name}`);
    console.error(error.stack ?? error.message);
    process.exit(1);
  }
}

console.log(`release tests passed: ${passed}`);
