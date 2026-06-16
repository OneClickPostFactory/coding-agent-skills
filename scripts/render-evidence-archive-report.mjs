#!/usr/bin/env node
import { evidenceArchiveCliResult } from "./lib/evidence-bundle.mjs";

const args = process.argv.slice(2);
const bundleFile = args[0];
const json = args.includes("--json");

try {
  const result = evidenceArchiveCliResult(bundleFile, { json });
  for (const line of result.lines) {
    if (result.stream === "stderr") console.error(line);
    else console.log(line);
  }
  process.exit(result.exitCode);
} catch {
  console.error("evidence archive report rendering failed safely");
  process.exit(2);
}
