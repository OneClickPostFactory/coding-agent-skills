import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  adapterIssues,
  AUDIT_ONLY_SKILLS,
  completionIssues,
  PILOT_SKILLS,
  RESTRICTED_CATEGORIES,
  restrictedShellReason,
} from "./lib/pack-rules.mjs";
import { validateValue } from "./lib/schema-validator.mjs";

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
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "ROADMAP.md",
  "docs/versioning/README.md",
  "docs/privacy/README.md",
  "docs/adapters/README.md",
  "docs/usage/README.md",
  "docs/release/README.md",
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

const manifestSchema = readJson("schemas/skill-manifest.schema.json");
const policySchema = readJson("schemas/command-policy.schema.json");
const evidenceSchema = readJson("contracts/evidence-pack/evidence-pack.schema.json");

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
  ]);
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
  }
});

test("manifest references resolve and agree with skill policy", () => {
  for (const skill of PILOT_SKILLS) {
    const manifestPath = path.join(root, "examples", "manifests", `${skill}.json`);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const policyPath = path.resolve(path.dirname(manifestPath), manifest.commandPolicy);
    const evidencePath = path.resolve(path.dirname(manifestPath), manifest.evidenceContract);
    const adapterPath = path.resolve(path.dirname(manifestPath), manifest.adapterInterface);

    assert.equal(manifest.name, skill);
    assert.ok(fs.existsSync(policyPath), `${skill}: missing command policy`);
    assert.ok(fs.existsSync(evidencePath), `${skill}: missing evidence contract`);
    assert.ok(fs.existsSync(adapterPath), `${skill}: missing adapter interface`);
    assert.equal(JSON.parse(fs.readFileSync(policyPath, "utf8")).mode, manifest.mode);
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

test("adapters may extend but may not weaken restrictions", () => {
  const valid = readJson("tests/fixtures/adapters/valid-repo-map.json");
  const weakening = readJson("tests/fixtures/adapters/weakening-repo-map.json");
  assert.deepEqual(adapterIssues(valid), []);
  assert.ok(adapterIssues(weakening).some((issue) => issue.includes("weakens")));
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
