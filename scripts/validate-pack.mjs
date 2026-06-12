import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const skills = [
  "repo-map",
  "build-verify",
  "git-preflight",
  "runtime-truth",
  "llm-drift-control",
];
const skillFiles = [
  "SKILL.md",
  "checklist.md",
  "examples.md",
  "failure-modes.md",
  "adapter-interface.md",
  "evidence-template.md",
  "agents/openai.yaml",
];
const jsonFiles = [
  "contracts/evidence-pack/evidence-pack.schema.json",
  "contracts/evidence-pack/evidence-pack.example.json",
  "schemas/skill-manifest.schema.json",
  "schemas/command-policy.schema.json",
];
const failures = [];
const requiredRootFiles = [
  ".gitignore",
  "README.md",
  "docs/architecture/README.md",
  "docs/authoring/README.md",
  "docs/safety/README.md",
  "contracts/evidence-pack/README.md",
  "tests/README.md",
];
const requiredSkillHeadings = [
  "Purpose And Use",
  "Inputs",
  "Procedure",
  "Evidence, Recovery, And Dependencies",
  "Approval Boundary",
  "Completion",
];

for (const file of requiredRootFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
}

for (const skill of skills) {
  for (const file of skillFiles) {
    const target = path.join(root, "skills", skill, file);
    if (!fs.existsSync(target)) failures.push(`missing ${path.relative(root, target)}`);
  }
  const skillText = fs.readFileSync(path.join(root, "skills", skill, "SKILL.md"), "utf8");
  if (!skillText.startsWith("---\nname:")) failures.push(`${skill}: invalid frontmatter`);
  if (new RegExp(`\\b${"TO" + "DO"}\\b`).test(skillText)) {
    failures.push(`${skill}: contains unfinished placeholder`);
  }
  for (const heading of requiredSkillHeadings) {
    if (!skillText.includes(`## ${heading}`)) failures.push(`${skill}: missing ${heading}`);
  }
  const metadata = fs.readFileSync(path.join(root, "skills", skill, "agents/openai.yaml"), "utf8");
  for (const key of ["display_name:", "short_description:", "default_prompt:"]) {
    if (!metadata.includes(key)) failures.push(`${skill}: agents/openai.yaml missing ${key}`);
  }
}

for (const file of jsonFiles) {
  try {
    JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  } catch (error) {
    failures.push(`${file}: ${error.message}`);
  }
}

const forbiddenSkillFolders = [
  "cloudflare-deploy",
  "supabase-rls-audit",
  "github-handoff",
  "deployment-preflight",
];
for (const folder of forbiddenSkillFolders) {
  if (fs.existsSync(path.join(root, "skills", folder))) {
    failures.push(`out-of-scope skill exists: ${folder}`);
  }
}

const textFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (/\.(?:md|json|yaml|yml|mjs)$/.test(entry.name)) textFiles.push(target);
  }
}
walk(root);

const actualSkillFolders = fs
  .readdirSync(path.join(root, "skills"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
if (JSON.stringify(actualSkillFolders) !== JSON.stringify([...skills].sort())) {
  failures.push(`unexpected skill folders: ${actualSkillFolders.join(", ")}`);
}

const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8").split(/\r?\n/);
for (const pattern of [".env", ".env.*", "!.env.example", "*.log", "tmp/", ".vscode/"]) {
  if (!gitignore.includes(pattern)) failures.push(`.gitignore missing ${pattern}`);
}

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

const auditOnlySkills = ["repo-map", "git-preflight", "runtime-truth", "llm-drift-control"];
for (const skill of auditOnlySkills) {
  const text = fs.readFileSync(path.join(root, "skills", skill, "SKILL.md"), "utf8");
  if (!/\baudit-only\b/i.test(text)) failures.push(`${skill}: audit-only boundary missing`);
  if (!/no mutation|no state changed|must not change|without changing|must not alter/i.test(text)) {
    failures.push(`${skill}: explicit no-mutation completion boundary missing`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`pilot pack valid: ${skills.length} skills, ${textFiles.length} checked files`);
