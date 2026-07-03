import fs from "node:fs";
import path from "node:path";

import { checkAdapterUpgrade } from "./lib/adapter-upgrade.mjs";
import { checkAdapterUpgradeChain } from "./lib/adapter-upgrade-chain.mjs";
import { validateExternalAdapters } from "./lib/adapter-discovery.mjs";
import {
  buildEvidenceArchiveReport,
  verifyEvidenceBundle,
} from "./lib/evidence-bundle.mjs";
import {
  adapterIssues,
  AUDIT_ONLY_SKILLS,
  auditOnlyDocumentIssues,
  completionIssues,
  detectSensitiveValues,
  PILOT_SKILLS,
  PILOT_VERSION,
  RESTRICTED_CATEGORIES,
  restrictedShellReason,
} from "./lib/pack-rules.mjs";
import { validateProjectAdapters } from "./lib/project-adapter-installation.mjs";
import { validateValue } from "./lib/schema-validator.mjs";

const root = path.resolve(process.argv[2] ?? ".");
const failures = [];
const skillFiles = [
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
const requiredRootFiles = [
  "AGENTS.md",
  "README.md",
  "RUNBOOK.md",
  "CHANGELOG.md",
  "ROADMAP.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "package.json",
  "bin/coding-agent-skills",
  "work-ledger.md",
  "runs/skill-runs.md",
  "docs/architecture/README.md",
  "docs/authoring/README.md",
  "docs/safety/README.md",
  "docs/versioning/README.md",
  "docs/privacy/README.md",
  "docs/adapters/README.md",
  "docs/adapters/discovery.md",
  "docs/adapters/external-adapters.md",
  "docs/adapters/project-installation.md",
  "docs/adapters/upgrades.md",
  "docs/adapters/upgrade-evidence.md",
  "docs/evidence-bundles/README.md",
  "docs/versioning/adapter-compatibility.md",
  "docs/usage/README.md",
  "docs/release/README.md",
  "docs/release/npm-package.md",
  "docs/testing/README.md",
  "contracts/evidence-pack/README.md",
  "contracts/evidence-pack/evidence-pack.schema.json",
  "contracts/evidence-pack/evidence-pack.example.json",
  "schemas/skill-manifest.schema.json",
  "schemas/command-policy.schema.json",
  "schemas/project-adapter.schema.json",
  "schemas/project-adapter-installation.schema.json",
  "schemas/adapter-upgrade-evidence.schema.json",
  "schemas/evidence-bundle.schema.json",
  "schemas/archive-report.schema.json",
  "schemas/archive-index.schema.json",
  "examples/upgrade-evidence/README.md",
  "examples/upgrade-evidence/valid-upgrade.evidence.json",
  "examples/upgrade-evidence/stale-pin.evidence.json",
  "examples/upgrade-evidence/unsafe-upgrade.evidence.json",
  "examples/upgrade-evidence/chain-pass.evidence.json",
  "examples/upgrade-evidence/chain-fail.evidence.json",
  "examples/upgrade-evidence/valid-upgrade.evidence.md",
  "examples/upgrade-evidence/chain-fail.evidence.md",
  "scripts/test-pack.mjs",
  "scripts/run-next",
  "scripts/validate-maintainer-loop.mjs",
  "scripts/verify-evidence-bundle.mjs",
  "scripts/render-evidence-archive-report.mjs",
  "scripts/render-adapter-repo-map.mjs",
  "scripts/render-route-trace.mjs",
  "scripts/check-adapter-upgrade.mjs",
  "scripts/check-adapter-upgrade-chain.mjs",
  "scripts/validate-adapters.mjs",
  "scripts/validate-project-adapters.mjs",
  "scripts/lib/adapter-repo-map.mjs",
  "scripts/lib/route-trace.mjs",
  "scripts/lib/adapter-upgrade.mjs",
  "scripts/lib/adapter-upgrade-chain.mjs",
  "scripts/lib/adapter-discovery.mjs",
  "scripts/lib/project-adapter-installation.mjs",
  "scripts/lib/semver.mjs",
  "scripts/lib/schema-validator.mjs",
  "scripts/lib/pack-rules.mjs",
  "scripts/lib/safe-evidence-output.mjs",
  "scripts/lib/upgrade-evidence.mjs",
  "scripts/lib/evidence-bundle.mjs",
  "tests/README.md",
  "tests/fixtures/README.md",
  "tests/safety/README.md",
  "tests/evidence/README.md",
  "tests/fixtures/triggers/cases.json",
  "tests/fixtures/policy/commands.json",
  "tests/fixtures/policy/properties.json",
  "tests/fixtures/mutation/cases.json",
  "tests/fixtures/privacy/cases.json",
  "tests/fixtures/completion/cases.json",
  "tests/fixtures/adapters/valid-narrowing.json",
  "tests/fixtures/adapters/allow-deploy.json",
  "tests/fixtures/adapters/allow-git-push.json",
  "tests/fixtures/adapters/suppress-failures.json",
  "tests/fixtures/adapters/redefine-completion.json",
  "tests/fixtures/adapters/expose-secrets.json",
  "tests/fixtures/adapters/override-audit-only.json",
  "tests/fixtures/adapters/weakening-repo-map.json",
  "tests/fixtures/adapters/incompatible-version.json",
  "tests/fixtures/adapters/remove-required-evidence.json",
  "tests/fixtures/adapters/expand-scope.json",
  "tests/fixtures/external-adapters/valid-basic/.coding-agent/adapters/basic/adapter.json",
  "tests/fixtures/external-adapters/valid-doc-precedence/coding-agent/adapters/docs/adapter.json",
  "tests/fixtures/external-adapters/valid-runtime-status/adapters/coding-agent/runtime/adapter.json",
  "tests/fixtures/external-adapters/invalid-deploy/.coding-agent/adapters/deploy/adapter.json",
  "tests/fixtures/external-adapters/invalid-git-push/.coding-agent/adapters/publish/adapter.json",
  "tests/fixtures/external-adapters/invalid-path-traversal/.coding-agent/adapters/path/adapter.json",
  "tests/fixtures/project-adapter-installation/valid-exact-pin/.coding-agent/skills.json",
  "tests/fixtures/project-adapter-installation/valid-exact-pin/.coding-agent/adapters/basic/adapter.json",
  "tests/fixtures/evidence-bundles/valid-bundle/evidence-bundle.json",
  "tests/fixtures/evidence-bundles/valid-bundle/evidence/repo-map.evidence.json",
  "tests/fixtures/evidence-bundles/valid-bundle/evidence/valid-upgrade.evidence.json",
  "tests/fixtures/evidence-bundles/valid-bundle/archive/evidence-archive-index.json",
  "tests/fixtures/evidence-bundles/advisory-review-soon/evidence-bundle.json",
  "tests/fixtures/evidence-bundles/invalid-archive-index/evidence-bundle.json",
  "tests/fixtures/evidence-bundles/invalid-signature-plan/evidence-bundle.json",
  "tests/fixtures/project-adapter-installation/valid-compatible-range/coding-agent.skills.json",
  "tests/fixtures/project-adapter-installation/valid-multiple-adapters/.coding-agent/skills.json",
  "tests/fixtures/project-adapter-installation/invalid-missing-declaration/.coding-agent/adapters/basic/adapter.json",
  "tests/fixtures/project-adapter-installation/invalid-unsupported-core-version/.coding-agent/skills.json",
  "tests/fixtures/project-adapter-installation/invalid-bad-semver/.coding-agent/skills.json",
  "tests/fixtures/project-adapter-installation/invalid-unknown-skill/.coding-agent/skills.json",
  "tests/fixtures/project-adapter-installation/invalid-adapter-version-mismatch/.coding-agent/skills.json",
  "tests/fixtures/project-adapter-installation/invalid-adapter-schema-version/.coding-agent/skills.json",
  "tests/fixtures/project-adapter-installation/invalid-adapter-location/.coding-agent/skills.json",
  "tests/fixtures/project-adapter-installation/invalid-skill-mismatch/.coding-agent/skills.json",
  "tests/fixtures/project-adapter-installation/invalid-mode-escalation/.coding-agent/skills.json",
  "tests/fixtures/project-adapter-installation/invalid-failure-suppression/.coding-agent/skills.json",
  "tests/fixtures/project-adapter-installation/invalid-completion-override/.coding-agent/skills.json",
  "tests/fixtures/project-adapter-installation/invalid-weakens-restrictions/.coding-agent/skills.json",
  "tests/fixtures/project-adapter-installation/invalid-secret-exposure/.coding-agent/skills.json",
  "tests/fixtures/project-adapter-installation/invalid-scope-expansion/.coding-agent/skills.json",
  "tests/fixtures/project-adapter-installation/invalid-path-traversal/.coding-agent/skills.json",
  "tests/fixtures/mutation/snapshot-target/README.md",
  "tests/fixtures/mutation/snapshot-target/state.json",
  "examples/README.md",
  "examples/adapters/README.md",
  "examples/adapters/narrow-repo-map.json",
  "examples/adapters/documentation-precedence.json",
  "examples/adapters/runtime-status-hints.json",
];
const sourceCheckoutFiles = [".gitignore", ".github/workflows/validate.yml"];
const upgradeFixtures = [
  "valid-upgrade",
  "stale-exact-pin",
  "stale-compatible-range",
  "unsupported-future-core",
  "unsupported-old-core",
  "adapter-schema-drift",
  "skill-compatibility-drift",
  "unsafe-upgrade-weakens-restrictions",
  "unsafe-upgrade-mode-escalation",
  "unsafe-upgrade-removes-evidence",
  "safe-upgrade-preserves-restrictions",
];
const chainFixtures = {
  valid: ["valid-chain"],
  invalid: [
    "stale-pin-chain",
    "broken-compatibility-chain",
    "unsafe-weakening-chain",
    "schema-drift-chain",
    "skill-drift-chain",
  ],
};

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(relativePath) {
  try {
    return JSON.parse(read(relativePath));
  } catch (error) {
    failures.push(`${relativePath}: ${error.message}`);
    return null;
  }
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

const sourceCheckoutMode = fs.existsSync(path.join(root, ".gitignore"));
const packageInstalledMode =
  !sourceCheckoutMode &&
  fs.existsSync(path.join(root, "package.json")) &&
  !fs.existsSync(path.join(root, ".git"));

if (sourceCheckoutMode) {
  for (const file of sourceCheckoutFiles) {
    if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
  }
} else if (!packageInstalledMode) {
  failures.push("missing .gitignore outside package-installed tree");
}

for (const file of requiredRootFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
}
for (const fixture of upgradeFixtures) {
  for (const revision of ["before", "after"]) {
    for (const relative of [
      ".coding-agent/skills.json",
      ".coding-agent/adapters/fixture-upgrade-adapter/adapter.json",
    ]) {
      const file = path.join(
        "tests",
        "fixtures",
        "project-adapter-upgrades",
        fixture,
        revision,
        relative,
      );
      if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
    }
  }
}
for (const fixture of [...chainFixtures.valid, ...chainFixtures.invalid]) {
  const fixtureRoot = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-upgrade-chains",
    fixture,
  );
  if (!fs.existsSync(fixtureRoot)) failures.push(`missing chain fixture ${fixture}`);
}

const actualSkillFolders = fs
  .readdirSync(path.join(root, "skills"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
if (JSON.stringify(actualSkillFolders) !== JSON.stringify([...PILOT_SKILLS].sort())) {
  failures.push(`unexpected skill folders: ${actualSkillFolders.join(", ")}`);
}

for (const skill of PILOT_SKILLS) {
  for (const file of skillFiles) {
    const target = path.join(root, "skills", skill, file);
    if (!fs.existsSync(target)) failures.push(`missing ${path.relative(root, target)}`);
  }

  for (const file of [
    `examples/manifests/${skill}.json`,
    `examples/command-policies/${skill}.json`,
    `examples/evidence-packs/${skill}.json`,
    `examples/workflows/${skill}.md`,
  ]) {
    if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
  }

  const skillText = read(`skills/${skill}/SKILL.md`);
  if (!skillText.startsWith("---\nname:")) failures.push(`${skill}: invalid frontmatter`);
  if (new RegExp(`\\b${"TO" + "DO"}\\b`).test(skillText)) {
    failures.push(`${skill}: contains unfinished placeholder`);
  }
  for (const heading of requiredSkillHeadings) {
    if (!skillText.includes(`## ${heading}`)) failures.push(`${skill}: missing ${heading}`);
  }

  const metadata = read(`skills/${skill}/agents/openai.yaml`);
  for (const key of ["display_name:", "short_description:", "default_prompt:"]) {
    if (!metadata.includes(key)) failures.push(`${skill}: agents/openai.yaml missing ${key}`);
  }
}

for (const fixture of [
  "valid-basic",
  "valid-doc-precedence",
  "valid-runtime-status",
]) {
  const result = validateExternalAdapters(
    path.join(root, "tests", "fixtures", "external-adapters", fixture),
    { coreRoot: root },
  );
  if (!result.ok || result.accepted.length !== 1) {
    failures.push(`${fixture}: valid external adapter root was rejected`);
  }
}

for (const fixture of ["valid-upgrade", "safe-upgrade-preserves-restrictions"]) {
  const fixtureRoot = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-upgrades",
    fixture,
  );
  const result = checkAdapterUpgrade(
    path.join(fixtureRoot, "before"),
    path.join(fixtureRoot, "after"),
    { coreRoot: root },
  );
  if (!result.ok) failures.push(`${fixture}: safe adapter upgrade was rejected`);
}

for (const fixture of [
  "stale-exact-pin",
  "stale-compatible-range",
  "unsupported-future-core",
  "unsupported-old-core",
  "adapter-schema-drift",
  "skill-compatibility-drift",
  "unsafe-upgrade-weakens-restrictions",
  "unsafe-upgrade-mode-escalation",
  "unsafe-upgrade-removes-evidence",
]) {
  const fixtureRoot = path.join(
    root,
    "tests",
    "fixtures",
    "project-adapter-upgrades",
    fixture,
  );
  const result = checkAdapterUpgrade(
    path.join(fixtureRoot, "before"),
    path.join(fixtureRoot, "after"),
    { coreRoot: root },
  );
  if (result.ok) failures.push(`${fixture}: unsafe adapter upgrade was accepted`);
}

for (const fixture of chainFixtures.valid) {
  const result = checkAdapterUpgradeChain(
    path.join(root, "tests", "fixtures", "project-adapter-upgrade-chains", fixture),
    { coreRoot: root },
  );
  if (!result.ok) failures.push(`${fixture}: safe adapter chain was rejected`);
}
for (const fixture of chainFixtures.invalid) {
  const result = checkAdapterUpgradeChain(
    path.join(root, "tests", "fixtures", "project-adapter-upgrade-chains", fixture),
    { coreRoot: root },
  );
  if (result.ok) failures.push(`${fixture}: unsafe adapter chain was accepted`);
}

for (const fixture of [
  "invalid-deploy",
  "invalid-git-push",
  "invalid-secret-exposure",
  "invalid-mode-escalation",
  "invalid-failure-suppression",
  "invalid-completion-override",
  "invalid-scope-expansion",
  "invalid-version",
  "invalid-skill-id",
  "invalid-skill-version",
  "invalid-path-traversal",
  "invalid-restriction-removal",
  "invalid-evidence-suppression",
  "invalid-malformed",
  "invalid-unknown-manifest",
  "mixed",
]) {
  const result = validateExternalAdapters(
    path.join(root, "tests", "fixtures", "external-adapters", fixture),
    { coreRoot: root },
  );
  if (result.ok) {
    failures.push(`${fixture}: invalid external adapter root was accepted`);
  }
}

for (const fixture of [
  "valid-exact-pin",
  "valid-compatible-range",
  "valid-multiple-adapters",
]) {
  const result = validateProjectAdapters(
    path.join(root, "tests", "fixtures", "project-adapter-installation", fixture),
    { coreRoot: root },
  );
  if (!result.ok) {
    failures.push(`${fixture}: valid project adapter installation was rejected`);
  }
}

for (const fixture of [
  "invalid-missing-declaration",
  "invalid-unsupported-core-version",
  "invalid-bad-semver",
  "invalid-unknown-skill",
  "invalid-adapter-version-mismatch",
  "invalid-adapter-schema-version",
  "invalid-adapter-location",
  "invalid-skill-mismatch",
  "invalid-mode-escalation",
  "invalid-failure-suppression",
  "invalid-completion-override",
  "invalid-weakens-restrictions",
  "invalid-secret-exposure",
  "invalid-scope-expansion",
  "invalid-path-traversal",
]) {
  const result = validateProjectAdapters(
    path.join(root, "tests", "fixtures", "project-adapter-installation", fixture),
    { coreRoot: root },
  );
  if (result.ok) {
    failures.push(`${fixture}: invalid project adapter installation was accepted`);
  }
}

const manifestSchema = readJson("schemas/skill-manifest.schema.json");
const policySchema = readJson("schemas/command-policy.schema.json");
const adapterSchema = readJson("schemas/project-adapter.schema.json");
const projectInstallationSchema = readJson(
  "schemas/project-adapter-installation.schema.json",
);
const evidenceSchema = readJson("contracts/evidence-pack/evidence-pack.schema.json");
const upgradeEvidenceSchema = readJson(
  "schemas/adapter-upgrade-evidence.schema.json",
);
const evidenceBundleSchema = readJson("schemas/evidence-bundle.schema.json");
const evidenceArchiveReportSchema = readJson("schemas/archive-report.schema.json");
const evidenceArchiveIndexSchema = readJson("schemas/archive-index.schema.json");

if (
  manifestSchema &&
  policySchema &&
  adapterSchema &&
  projectInstallationSchema &&
  evidenceSchema &&
  upgradeEvidenceSchema &&
  evidenceBundleSchema &&
  evidenceArchiveReportSchema &&
  evidenceArchiveIndexSchema
) {
  const policiesBySkill = Object.fromEntries(
    PILOT_SKILLS.map((skill) => [
      skill,
      readJson(`examples/command-policies/${skill}.json`),
    ]),
  );
  for (const skill of PILOT_SKILLS) {
    const records = [
      [
        `examples/manifests/${skill}.json`,
        manifestSchema,
      ],
      [
        `examples/command-policies/${skill}.json`,
        policySchema,
      ],
      [
        `examples/evidence-packs/${skill}.json`,
        evidenceSchema,
      ],
    ];

    for (const [file, schema] of records) {
      const value = readJson(file);
      if (!value) continue;
      for (const error of validateValue(schema, value)) failures.push(`${file}: ${error}`);
    }

    const manifest = readJson(`examples/manifests/${skill}.json`);
    const policy = readJson(`examples/command-policies/${skill}.json`);
    const evidence = readJson(`examples/evidence-packs/${skill}.json`);
    if (!manifest || !policy || !evidence) continue;

    if (manifest.name !== skill) failures.push(`${skill}: manifest name mismatch`);
    if (manifest.version !== PILOT_VERSION) failures.push(`${skill}: stale manifest version`);
    if (policy.version !== PILOT_VERSION) failures.push(`${skill}: stale policy version`);
    if (manifest.mode !== policy.mode) failures.push(`${skill}: manifest/policy mode mismatch`);
    if (manifest.adapterCompatibility?.contractVersion !== "1.0.0") {
      failures.push(`${skill}: adapter contract version mismatch`);
    }
    if (!manifest.adapterCompatibility?.compatibleAdapterVersions?.includes("1.0.0")) {
      failures.push(`${skill}: adapter version compatibility missing`);
    }
    if (evidence.skill.name !== skill) failures.push(`${skill}: evidence skill mismatch`);
    if (evidence.skill.version !== PILOT_VERSION) {
      failures.push(`${skill}: stale evidence example version`);
    }
    if (evidence.skill.version !== manifest.version) {
      failures.push(`${skill}: evidence/manifest version mismatch`);
    }

    const restrictions = new Set(policy.restrictedCategories);
    for (const category of RESTRICTED_CATEGORIES) {
      if (!restrictions.has(category)) {
        failures.push(`${skill}: command policy omits ${category}`);
      }
    }
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
      if (policy.parserPolicy?.[invariant] !== true) {
        failures.push(`${skill}: command parser invariant disabled: ${invariant}`);
      }
    }
    for (const family of policy.allowedFamilies ?? []) {
      if (!family.argumentPolicy?.allowedPatterns?.length) {
        failures.push(`${skill}: ${family.name} has no allowed argument patterns`);
      }
      if (!family.argumentPolicy?.deniedPatterns?.length) {
        failures.push(`${skill}: ${family.name} has no denied argument patterns`);
      }
    }
    for (const issue of completionIssues(evidence)) {
      failures.push(`${skill}: ${issue}`);
    }
  }

  for (const file of [
    "examples/adapters/narrow-repo-map.json",
    "examples/adapters/documentation-precedence.json",
    "examples/adapters/runtime-status-hints.json",
  ]) {
    const adapter = readJson(file);
    if (!adapter) continue;
    for (const error of validateValue(adapterSchema, adapter)) {
      failures.push(`${file}: ${error}`);
    }
    for (const error of adapterIssues(adapter, { policies: policiesBySkill })) {
      failures.push(`${file}: ${error}`);
    }
  }

  for (const file of [
    "tests/fixtures/adapters/allow-deploy.json",
    "tests/fixtures/adapters/allow-git-push.json",
    "tests/fixtures/adapters/suppress-failures.json",
    "tests/fixtures/adapters/redefine-completion.json",
    "tests/fixtures/adapters/expose-secrets.json",
    "tests/fixtures/adapters/override-audit-only.json",
    "tests/fixtures/adapters/weakening-repo-map.json",
    "tests/fixtures/adapters/incompatible-version.json",
    "tests/fixtures/adapters/remove-required-evidence.json",
    "tests/fixtures/adapters/expand-scope.json",
  ]) {
    const adapter = readJson(file);
    if (!adapter) continue;
    const rejectionReasons = [
      ...validateValue(adapterSchema, adapter),
      ...adapterIssues(adapter, { policies: policiesBySkill }),
    ];
    if (rejectionReasons.length === 0) {
      failures.push(`${file}: invalid adapter fixture was accepted`);
    }
  }

  for (const file of [
    "examples/upgrade-evidence/valid-upgrade.evidence.json",
    "examples/upgrade-evidence/stale-pin.evidence.json",
    "examples/upgrade-evidence/unsafe-upgrade.evidence.json",
    "examples/upgrade-evidence/chain-pass.evidence.json",
    "examples/upgrade-evidence/chain-fail.evidence.json",
  ]) {
    const evidence = readJson(file);
    if (!evidence) continue;
    for (const error of validateValue(upgradeEvidenceSchema, evidence)) {
      failures.push(`${file}: ${error}`);
    }
    if (evidence.changedState?.changed !== false) {
      failures.push(`${file}: upgrade evidence must declare no project state change`);
    }
  }

  const evidenceBundle = readJson(
    "tests/fixtures/evidence-bundles/valid-bundle/evidence-bundle.json",
  );
  if (evidenceBundle) {
    for (const error of validateValue(evidenceBundleSchema, evidenceBundle)) {
      failures.push(`valid evidence bundle: ${error}`);
    }
    const result = verifyEvidenceBundle(
      path.join(
        root,
        "tests/fixtures/evidence-bundles/valid-bundle/evidence-bundle.json",
      ),
      { coreRoot: root },
    );
    if (!result.ok) failures.push(`valid evidence bundle was rejected: ${result.codes}`);
    const archiveReport = buildEvidenceArchiveReport(
      path.join(
        root,
        "tests/fixtures/evidence-bundles/valid-bundle/evidence-bundle.json",
      ),
      { coreRoot: root },
    );
    if (!archiveReport.ok) {
      failures.push(`valid evidence archive report was rejected: ${archiveReport.codes}`);
    }
    for (const error of validateValue(evidenceArchiveReportSchema, archiveReport.report)) {
      failures.push(`valid evidence archive report: ${error}`);
    }
    const archiveIndex = readJson(
      "tests/fixtures/evidence-bundles/valid-bundle/archive/evidence-archive-index.json",
    );
    for (const error of validateValue(evidenceArchiveIndexSchema, archiveIndex)) {
      failures.push(`valid evidence archive index: ${error}`);
    }
  }
}

const contractExample = readJson("contracts/evidence-pack/evidence-pack.example.json");
if (contractExample?.skill?.version !== PILOT_VERSION) {
  failures.push("evidence-pack contract example has a stale skill version");
}

const packageJson = readJson("package.json");
if (packageJson) {
  const expectedFiles = [
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
  ];
  if (packageJson.name !== "coding-agent-skills") {
    failures.push("package.json has unexpected package name");
  }
  if (packageJson.version !== "0.2.9") {
    failures.push("package.json version must be 0.2.9 for public package validation");
  }
  if (packageJson.type !== "module") failures.push("package.json must preserve ESM mode");
  if (packageJson.private !== false) {
    failures.push("package.json must be public for the approved npm release");
  }
  if (packageJson.license !== "MIT") {
    failures.push("package.json license must be MIT for the public npm release");
  }
  if (!read("LICENSE").includes("Copyright (c) 2026 OneClickPostFactory")) {
    failures.push("LICENSE must contain the approved MIT copyright line");
  }
  if (
    JSON.stringify(packageJson.keywords) !==
    JSON.stringify([
      "coding-agent",
      "agent-skills",
      "repo-map",
      "route-trace",
      "project-adapters",
      "code-validation",
      "cli",
    ])
  ) {
    failures.push("package.json keywords have drifted");
  }
  if (
    packageJson.repository?.type !== "git" ||
    packageJson.repository?.url !==
      "git+https://github.com/OneClickPostFactory/coding-agent-skills.git"
  ) {
    failures.push("package.json repository metadata is missing or incorrect");
  }
  if (
    packageJson.homepage !==
    "https://github.com/OneClickPostFactory/coding-agent-skills#readme"
  ) {
    failures.push("package.json homepage metadata is missing or incorrect");
  }
  if (
    packageJson.bugs?.url !==
    "https://github.com/OneClickPostFactory/coding-agent-skills/issues"
  ) {
    failures.push("package.json bugs metadata is missing or incorrect");
  }
  if (
    packageJson.publishConfig?.access !== "public" ||
    packageJson.publishConfig?.registry !== "https://registry.npmjs.org/"
  ) {
    failures.push("package.json publishConfig must target the public npm registry");
  }
  if (packageJson.bin?.["coding-agent-skills"] !== "bin/coding-agent-skills") {
    failures.push("package.json bin mapping is missing coding-agent-skills");
  }
  if (packageJson.dependencies || packageJson.devDependencies) {
    failures.push("package.json must remain dependency-free");
  }
  if (JSON.stringify(packageJson.files) !== JSON.stringify(expectedFiles)) {
    failures.push("package.json files allowlist has drifted");
  }
  for (const entry of expectedFiles) {
    const target = path.join(root, entry);
    if (entry.endsWith("/")) {
      if (!fs.existsSync(target) || !fs.lstatSync(target).isDirectory()) {
        failures.push(`package files allowlist directory missing: ${entry}`);
      }
    } else if (!fs.existsSync(target) || !fs.lstatSync(target).isFile()) {
      failures.push(`package files allowlist file missing: ${entry}`);
    }
  }
  if (packageJson.scripts?.["pack:dry-run"] !== "npm pack --dry-run") {
    failures.push("package.json must expose a dry-run pack script only");
  }
}

for (const [file, patterns] of [
  [
    "docs/adapters/README.md",
    [/inherit/i, /compatib/i, /must never|cannot/i, /external/i, /discovery/i],
  ],
  [
    "docs/adapters/discovery.md",
    [/adapter\.json/i, /symlink/i, /path traversal/i, /extension-only/i],
  ],
  [
    "docs/adapters/external-adapters.md",
    [/validate-adapters\.mjs/i, /rejection/i, /real project adapters/i],
  ],
  [
    "docs/adapters/project-installation.md",
    [/skills\.json/i, /version pin/i, /extension-only/i, /validate-project-adapters/i],
  ],
  [
    "docs/adapters/upgrades.md",
    [/stale exact pin/i, /stale compatible range/i, /advisory/i, /disposable/i],
  ],
  [
    "docs/adapters/upgrade-evidence.md",
    [/changedState/i, /--json/i, /--output/i, /does not apply/i],
  ],
  [
    "docs/evidence-bundles/README.md",
    [/deterministic/i, /regression/i, /retention/i, /provenance/i, /archive/i, /read-only/i],
  ],
  [
    "docs/release/npm-package.md",
    [/npm install -g coding-agent-skills/i, /MIT/i, /public npm registry/i],
  ],
  [
    "docs/versioning/adapter-compatibility.md",
    [/schema drift/i, /skill compatibility drift/i, /preserve/i, /evidence/i],
  ],
  [
    "docs/versioning/README.md",
    [/exact pin/i, /compatible range/i, />=0\.2\.2 <0\.3\.0/],
  ],
  [
    "docs/testing/README.md",
    [/property-style/i, /not a complete POSIX parser/i],
  ],
  [
    "docs/authoring/README.md",
    [/adapter.*compatib/i, /command.*argument/i],
  ],
]) {
  const text = read(file);
  for (const pattern of patterns) {
    if (!pattern.test(text)) failures.push(`${file}: missing ${pattern}`);
  }
}

const allFiles = walk(root);
const textFiles = allFiles.filter((file) => /\.(?:md|json|yaml|yml|mjs)$/.test(file));

for (const file of textFiles.filter((target) => target.endsWith(".md"))) {
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
    if (!fs.existsSync(target)) {
      failures.push(`${path.relative(root, file)}: broken link ${link}`);
    }
  }
}

if (sourceCheckoutMode) {
  const gitignore = new Set(read(".gitignore").split(/\r?\n/));
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
    if (!gitignore.has(pattern)) failures.push(`.gitignore missing ${pattern}`);
  }
} else if (packageInstalledMode) {
  if (fs.existsSync(path.join(root, ".github"))) {
    failures.push("package-installed tree must not contain .github");
  }
  for (const file of allFiles) {
    const relative = path.relative(root, file);
    const basename = path.basename(file);
    if (basename === ".env" || (basename.startsWith(".env.") && basename !== ".env.example")) {
      failures.push(`${relative}: package-installed tree contains environment file`);
    }
  }
}

const secretPatterns = [
  /\bgh[pousr]_[A-Za-z0-9_]{12,}\b/,
  new RegExp(`\\b${"github" + "_pat_"}[A-Za-z0-9_]{12,}\\b`),
  /\beyJ[A-Za-z0-9._-]{20,}\b/,
  new RegExp(["-----BEGIN ", "(?:RSA |EC |OPENSSH )?", "PRIVATE KEY-----"].join("")),
  /Authorization:\s*Bearer\s+[A-Za-z0-9._-]{8,}/i,
];
for (const file of textFiles) {
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) failures.push(`${path.relative(root, file)}: secret-like value`);
  }
}

for (const skill of AUDIT_ONLY_SKILLS) {
  const skillText = read(`skills/${skill}/SKILL.md`);
  const metadata = read(`skills/${skill}/agents/openai.yaml`);
  if (!/\baudit-only\b/i.test(skillText)) failures.push(`${skill}: audit-only boundary missing`);
  if (!/no mutation|no state changed|must not change|without changing|must not alter/i.test(skillText)) {
    failures.push(`${skill}: explicit no-mutation completion boundary missing`);
  }
  if (!/without (?:modifying|changing|rewriting)/i.test(metadata)) {
    failures.push(`${skill}: agent prompt does not preserve audit-only behavior`);
  }
  for (const file of allFiles.filter(
    (candidate) =>
      candidate.startsWith(path.join(root, "skills", skill)) &&
      candidate.endsWith(".md"),
  )) {
    for (const issue of auditOnlyDocumentIssues(fs.readFileSync(file, "utf8"))) {
      failures.push(
        `${path.relative(root, file)}:${issue.line}: audit-only mutation guidance: ${issue.reasons.join(", ")}`,
      );
    }
  }
}

for (const directory of ["skills", "examples"]) {
  for (const file of allFiles.filter(
    (candidate) =>
      candidate.startsWith(path.join(root, directory)) &&
      /\.(?:md|json|yaml|yml)$/.test(candidate),
  )) {
    const sensitiveTypes = detectSensitiveValues(fs.readFileSync(file, "utf8"));
    if (sensitiveTypes.length) {
      failures.push(
        `${path.relative(root, file)}: sensitive-looking reusable content: ${sensitiveTypes.join(", ")}`,
      );
    }
  }
}

const executableExampleFiles = [
  "CONTRIBUTING.md",
  ...PILOT_SKILLS.map((skill) => `examples/workflows/${skill}.md`),
];
for (const file of executableExampleFiles) {
  const text = read(file);
  for (const match of text.matchAll(/```(?:bash|sh|shell)\s*\n([\s\S]*?)```/g)) {
    for (const line of match[1].split(/\r?\n/)) {
      const reason = restrictedShellReason(line);
      if (reason) failures.push(`${file}: ${reason}: ${line.trim()}`);
    }
  }
}

if (sourceCheckoutMode) {
  const ci = read(".github/workflows/validate.yml");
  for (const expected of [
    "permissions:\n  contents: read",
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
  ]) {
    if (!ci.includes(expected)) failures.push(`CI missing safe validation step: ${expected}`);
  }
  for (const match of ci.matchAll(/^\s*run:\s*(.+)$/gm)) {
    const reason = restrictedShellReason(match[1]);
    if (reason) failures.push(`CI contains ${reason}: ${match[1].trim()}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`pilot pack valid: ${PILOT_SKILLS.length} skills, ${textFiles.length} checked files`);
