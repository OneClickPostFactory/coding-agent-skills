#!/usr/bin/env node
import {
  deploymentPreflightCliResult,
} from "./lib/deployment-preflight.mjs";

const result = deploymentPreflightCliResult(process.argv[2]);
const stream = result.stream === "stderr" ? process.stderr : process.stdout;
stream.write(`${result.lines.join("\n")}\n`);
process.exitCode = result.exitCode;
