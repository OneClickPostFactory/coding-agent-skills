import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkAdapterUpgrade } from "./adapter-upgrade.mjs";
import { PILOT_VERSION, PREVIOUS_PILOT_VERSION } from "./pack-rules.mjs";
import { readProjectAdapterDeclaration } from "./project-adapter-installation.mjs";
import { writeSafeEvidenceJson } from "./safe-evidence-output.mjs";
import { compareSemver, parseSemver } from "./semver.mjs";
import { buildAdapterChainEvidence } from "./upgrade-evidence.mjs";

const DEFAULT_CORE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const REVISION_NAME = /^([0-9]{2})-[a-z0-9]+(?:-[a-z0-9]+)*$/;

function baseFailure(code) {
  return {
    ok: false,
    status: "failed",
    revisionCount: 0,
    transitionCount: 0,
    passedTransitions: 0,
    failedTransitions: 0,
    transitions: [],
    codes: [code],
  };
}

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function discoverRevisions(chainRootInput) {
  const input = String(chainRootInput ?? "");
  if (!input.trim()) return { ok: false, codes: ["missing-chain-root"] };
  if (input.split(/[\\/]+/).includes("..")) {
    return { ok: false, codes: ["root-path-traversal"] };
  }

  const chainRoot = path.resolve(input);
  if (!fs.existsSync(chainRoot)) return { ok: false, codes: ["chain-root-not-found"] };
  const stat = fs.lstatSync(chainRoot);
  if (stat.isSymbolicLink()) return { ok: false, codes: ["symlink-escape"] };
  if (!stat.isDirectory()) return { ok: false, codes: ["chain-root-not-directory"] };

  const realRoot = fs.realpathSync(chainRoot);
  const revisions = [];
  const codes = new Set();

  for (const entry of fs.readdirSync(realRoot, { withFileTypes: true })) {
    if (/^\.env(?:\.|$)/.test(entry.name)) continue;
    const match = REVISION_NAME.exec(entry.name);
    if (!match) {
      codes.add("unexpected-chain-entry");
      continue;
    }
    const candidate = path.join(realRoot, entry.name);
    if (entry.isSymbolicLink()) {
      codes.add("symlink-escape");
      continue;
    }
    if (!entry.isDirectory()) {
      codes.add("revision-not-directory");
      continue;
    }
    const realCandidate = fs.realpathSync(candidate);
    if (!inside(realRoot, realCandidate)) {
      codes.add("symlink-escape");
      continue;
    }
    revisions.push({
      order: Number(match[1]),
      root: realCandidate,
    });
  }

  revisions.sort((left, right) => left.order - right.order);
  if (revisions.length < 2) codes.add("insufficient-chain-revisions");
  revisions.forEach((revision, index) => {
    if (revision.order !== index + 1) codes.add("non-contiguous-chain-order");
  });

  return {
    ok: codes.size === 0,
    chainRoot: realRoot,
    revisions,
    codes: [...codes].sort(),
  };
}

function expectedVersion(projectRoot) {
  const loaded = readProjectAdapterDeclaration(projectRoot);
  const version = loaded.declaration?.core?.expectedVersion;
  return parseSemver(version) ? version : null;
}

function pinKind(pin) {
  return typeof pin === "string" && /^\d+\.\d+\.\d+$/.test(pin)
    ? "stale-exact-pin"
    : "stale-compatible-range";
}

function progressionCodes(beforeRoot, afterRoot) {
  const before = readProjectAdapterDeclaration(beforeRoot);
  const after = readProjectAdapterDeclaration(afterRoot);
  if (!before.ok || !after.ok) return [];

  const beforeVersion = before.declaration.core?.expectedVersion;
  const afterVersion = after.declaration.core?.expectedVersion;
  const comparison = compareSemver(afterVersion, beforeVersion);
  if (comparison === null) return ["incompatible-core-chain"];
  if (comparison === 0) return [pinKind(after.declaration.core?.versionPin)];

  const parsedBefore = parseSemver(beforeVersion);
  const parsedAfter = parseSemver(afterVersion);
  const adjacentPatch =
    parsedBefore &&
    parsedAfter &&
    parsedBefore[0] === parsedAfter[0] &&
    parsedBefore[1] === parsedAfter[1] &&
    parsedAfter[2] === parsedBefore[2] + 1;
  const currentReleaseBoundary =
    beforeVersion === PREVIOUS_PILOT_VERSION && afterVersion === PILOT_VERSION;
  return adjacentPatch || currentReleaseBoundary
    ? []
    : ["incompatible-core-chain"];
}

export function checkAdapterUpgradeChain(chainRootInput, options = {}) {
  const discovery = discoverRevisions(chainRootInput);
  if (!discovery.ok) {
    return {
      ...baseFailure(discovery.codes[0]),
      revisionCount: discovery.revisions?.length ?? 0,
      codes: discovery.codes,
    };
  }

  const coreRoot = path.resolve(options.coreRoot ?? DEFAULT_CORE_ROOT);
  const transitions = [];
  const chainCodes = new Set();

  for (let index = 0; index < discovery.revisions.length - 1; index += 1) {
    const beforeRoot = discovery.revisions[index].root;
    const afterRoot = discovery.revisions[index + 1].root;
    const targetCoreVersion = expectedVersion(afterRoot) ?? PILOT_VERSION;
    const result = checkAdapterUpgrade(beforeRoot, afterRoot, {
      coreRoot,
      targetCoreVersion,
    });
    const codes = new Set([
      ...result.codes,
      ...progressionCodes(beforeRoot, afterRoot),
    ]);
    for (const code of codes) chainCodes.add(code);
    transitions.push({
      stepIndex: index + 1,
      ok: codes.size === 0,
      codes: [...codes].sort(),
      result,
    });
  }

  const lastVersion = expectedVersion(discovery.revisions.at(-1).root);
  if (lastVersion !== PILOT_VERSION) chainCodes.add("chain-target-stale");

  const firstContext = transitions[0]?.result.context?.before;
  const lastContext = transitions.at(-1)?.result.context?.after;
  const passedTransitions = transitions.filter((transition) => transition.ok).length;
  const failedTransitions = transitions.length - passedTransitions;
  const ok = chainCodes.size === 0 && failedTransitions === 0;

  return {
    ok,
    status: ok ? "complete" : "failed",
    revisionCount: discovery.revisions.length,
    transitionCount: transitions.length,
    passedTransitions,
    failedTransitions,
    transitions,
    codes: [...chainCodes].sort(),
    targetCoreVersion: PILOT_VERSION,
    context: {
      before: firstContext,
      after: lastContext,
    },
  };
}

export function formatAdapterChainSummary(result) {
  if (result.ok) {
    return [
      `adapter upgrade chain complete: ${result.revisionCount} revisions, ` +
        `${result.transitionCount} transitions accepted`,
    ];
  }
  return [
    `adapter upgrade chain failed: ${result.failedTransitions} of ` +
      `${result.transitionCount} transitions rejected`,
    `rejection codes: ${result.codes.join(",")}`,
  ];
}

export function adapterChainCliResult(chainRoot, options = {}) {
  if (!chainRoot) {
    return {
      exitCode: 2,
      stream: "stderr",
      lines: [
        "usage: node scripts/check-adapter-upgrade-chain.mjs " +
          "<chain-root> [--json | --output <file>]",
      ],
    };
  }

  const result = checkAdapterUpgradeChain(chainRoot, options);
  const evidence = buildAdapterChainEvidence(result, options);
  if (options.output) {
    const written = writeSafeEvidenceJson(options.output, evidence, {
      baseDirectory: options.outputBase,
    });
    if (!written.ok) {
      return {
        exitCode: 2,
        stream: "stderr",
        lines: [`adapter chain evidence output failed: ${written.code}`],
        result,
        evidence,
      };
    }
  }
  if (options.json) {
    return {
      exitCode: result.ok ? 0 : 1,
      stream: "stdout",
      lines: [JSON.stringify(evidence, null, 2)],
      result,
      evidence,
    };
  }
  return {
    exitCode: result.ok ? 0 : 1,
    stream: result.ok ? "stdout" : "stderr",
    lines: [
      ...formatAdapterChainSummary(result),
      ...(options.output ? ["sanitized evidence output written"] : []),
    ],
    result,
    evidence,
  };
}
