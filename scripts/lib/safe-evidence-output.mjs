import fs from "node:fs";
import path from "node:path";

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function resolveSafeEvidenceOutput(outputPath, options = {}) {
  const value = String(outputPath ?? "");
  if (!value.trim()) return { ok: false, code: "missing-output-path" };
  if (path.isAbsolute(value) || value.split(/[\\/]+/).includes("..")) {
    return { ok: false, code: "unsafe-output-path" };
  }
  if (
    value.split(/[\\/]+/).some((segment) => /^\.env(?:\.|$)/.test(segment)) ||
    path.extname(value) !== ".json"
  ) {
    return { ok: false, code: "unsafe-output-path" };
  }

  const base = path.resolve(options.baseDirectory ?? process.cwd());
  if (
    !fs.existsSync(base) ||
    fs.lstatSync(base).isSymbolicLink() ||
    !fs.lstatSync(base).isDirectory()
  ) {
    return { ok: false, code: "output-base-unavailable" };
  }
  const target = path.resolve(base, value);
  if (!inside(base, target)) return { ok: false, code: "unsafe-output-path" };

  let current = base;
  for (const segment of path.relative(base, target).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) break;
    if (fs.lstatSync(current).isSymbolicLink()) {
      return { ok: false, code: "output-symlink-escape" };
    }
  }

  const parent = path.dirname(target);
  if (!fs.existsSync(parent) || !fs.lstatSync(parent).isDirectory()) {
    return { ok: false, code: "output-parent-unavailable" };
  }
  if (fs.existsSync(target)) return { ok: false, code: "output-already-exists" };
  return { ok: true, target };
}

export function writeSafeEvidenceJson(outputPath, evidence, options = {}) {
  const resolved = resolveSafeEvidenceOutput(outputPath, options);
  if (!resolved.ok) return resolved;

  try {
    fs.writeFileSync(resolved.target, `${JSON.stringify(evidence, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch {
    return { ok: false, code: "output-write-failed" };
  }
  return { ok: true, code: "evidence-output-written" };
}

export function parseEvidenceCliArguments(argv, positionalCount) {
  const positional = argv.slice(0, positionalCount);
  const flags = argv.slice(positionalCount);
  let json = false;
  let output = null;

  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (flag === "--json" && !json && output === null) {
      json = true;
      continue;
    }
    if (flag === "--output" && !json && output === null && flags[index + 1]) {
      output = flags[index + 1];
      index += 1;
      continue;
    }
    return { ok: false, positional, json: false, output: null };
  }

  return {
    ok: positional.every((value) => typeof value === "string" && value.length > 0),
    positional,
    json,
    output,
  };
}
