#!/usr/bin/env node
import { evidenceBundleCliResult } from "./lib/evidence-bundle.mjs";

const args = process.argv.slice(2);
const bundleFile = args[0];
const json = args.includes("--json");

try {
  const result = evidenceBundleCliResult(bundleFile, { json });
  for (const line of result.lines) {
    if (result.stream === "stderr") console.error(line);
    else console.log(line);
  }
  process.exit(result.exitCode);
} catch {
  console.error("evidence bundle verification failed safely");
  process.exit(2);
}
