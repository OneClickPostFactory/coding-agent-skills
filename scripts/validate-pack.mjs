import fs from "node:fs";
import path from "node:path";

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
  ".gitignore",
  "README.md",
  "CHANGELOG.md",
  "ROADMAP.md",
  "CONTRIBUTING.md",
  ".github/workflows/validate.yml",
  "docs/architecture/README.md",
  "docs/authoring/README.md",
  "docs/safety/README.md",
  "docs/versioning/README.md",
  "docs/privacy/README.md",
  "docs/adapters/README.md",
  "docs/usage/README.md",
  "docs/release/README.md",
  "docs/testing/README.md",
  "contracts/evidence-pack/README.md",
  "contracts/evidence-pack/evidence-pack.schema.json",
  "contracts/evidence-pack/evidence-pack.example.json",
  "schemas/skill-manifest.schema.json",
  "schemas/command-policy.schema.json",
  "schemas/project-adapter.schema.json",
  "scripts/test-pack.mjs",
  "scripts/lib/schema-validator.mjs",
  "scripts/lib/pack-rules.mjs",
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
  "tests/fixtures/mutation/snapshot-target/README.md",
  "tests/fixtures/mutation/snapshot-target/state.json",
  "examples/README.md",
  "examples/adapters/README.md",
  "examples/adapters/narrow-repo-map.json",
  "examples/adapters/documentation-precedence.json",
  "examples/adapters/runtime-status-hints.json",
];

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

for (const file of requiredRootFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
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

const manifestSchema = readJson("schemas/skill-manifest.schema.json");
const policySchema = readJson("schemas/command-policy.schema.json");
const adapterSchema = readJson("schemas/project-adapter.schema.json");
const evidenceSchema = readJson("contracts/evidence-pack/evidence-pack.schema.json");

if (manifestSchema && policySchema && adapterSchema && evidenceSchema) {
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
}

const contractExample = readJson("contracts/evidence-pack/evidence-pack.example.json");
if (contractExample?.skill?.version !== PILOT_VERSION) {
  failures.push("evidence-pack contract example has a stale skill version");
}

for (const [file, patterns] of [
  [
    "docs/adapters/README.md",
    [/inherit/i, /compatib/i, /must never|cannot/i],
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

const ci = read(".github/workflows/validate.yml");
for (const expected of [
  "permissions:\n  contents: read",
  "node scripts/validate-pack.mjs .",
  "node scripts/test-pack.mjs",
  "node --test",
]) {
  if (!ci.includes(expected)) failures.push(`CI missing safe validation step: ${expected}`);
}
for (const match of ci.matchAll(/^\s*run:\s*(.+)$/gm)) {
  const reason = restrictedShellReason(match[1]);
  if (reason) failures.push(`CI contains ${reason}: ${match[1].trim()}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`pilot pack valid: ${PILOT_SKILLS.length} skills, ${textFiles.length} checked files`);
