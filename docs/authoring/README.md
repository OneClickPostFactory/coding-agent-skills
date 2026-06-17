# Authoring

New skills must:

1. Define precise trigger conditions in YAML frontmatter.
2. State whether they are audit-only or action-capable.
3. Define command families, argument policy, parser invariants, and restricted categories.
4. Use the shared evidence-pack contract.
5. Prevent `complete` when required evidence failed or was skipped without an acceptable consequence.
6. Keep provider and project behavior in explicit adapters.
7. Include tests for trigger behavior, command policy, mutation prevention, privacy, adapters, and false completion.
8. Keep `SKILL.md` concise and link directly to detailed companion references.
9. Use imperative procedures and explicit status transitions.
10. Validate `agents/openai.yaml` whenever trigger wording changes.
11. Declare `adapterSchema` and `adapterCompatibility` in the skill manifest.
12. Add exact and generated property-style command-policy cases.

Do not copy commands from restricted evidence into procedures. Use placeholders instead of private paths, domains, identifiers, or credentials.

Project adapters must validate against `schemas/project-adapter.schema.json`. They may add known paths, script aliases, source precedence, status-only commands, and evidence requirements. They may not weaken restrictions, hide failures, change skill mode, or redefine completion.

Future skills must declare the adapter contract version and compatible adapter versions in their manifest. Adapter compatibility is bidirectional: the manifest must accept the adapter version, and the adapter must accept the skill ID, version, and original mode.

External adapters must use one documented discovery location and an immediate child
directory containing `adapter.json`. Keep manifests synthetic during shared-core testing.
Run `node scripts/validate-adapters.mjs <adapter-root>` before proposing a real project
adapter. Passing schema validation alone is insufficient; compatibility, path safety,
command aliases, evidence additions, and inherited restrictions must also pass.

A future project adoption must also add exactly one supported skills declaration, pin the
released shared core, list every adapter ID/version/skill set, retain `noSecrets: true`, and
pass `node scripts/validate-project-adapters.mjs <project-root>`. A project declaration may
narrow compatibility but cannot replace the shared schema, policy, mode, or completion rules.

Before proposing an adapter upgrade, retain separate before and after project revisions and
run `node scripts/check-adapter-upgrade.mjs <before-project-root> <after-project-root>`.
Update the expected core, pin, and skill compatibility together. Preserve adapter identity,
all denied categories, and every existing evidence requirement. A passing advisory check
does not approve modification of a real project.

For multiple revisions, use contiguous ordinal directories and run
`node scripts/check-adapter-upgrade-chain.mjs <chain-root>`. Produce sanitized evidence with
`--json` or an explicitly requested relative `--output` file. Validate evidence against
`schemas/adapter-upgrade-evidence.schema.json`, keep `changedState.changed` false, and never
store raw project paths, project IDs, `.env` values, credentials, or applied changes.

Evidence bundles must declare retention, expiry-advisory, provenance, archive-index, and
archive policy metadata. Use `node scripts/verify-evidence-bundle.mjs <bundle-file>` before
claiming replay or regression success, and use
`node scripts/render-evidence-archive-report.mjs <bundle-file>` when a sanitized archive
summary is needed. Do not inline signatures, raw evidence bodies, command output, local
paths, or secret-like values into archive indexes or reports. Detached-signature
verification planning is metadata only until a future milestone explicitly approves real
verification infrastructure.
