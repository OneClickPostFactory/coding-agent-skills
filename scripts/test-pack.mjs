import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

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
    "node --test",
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
