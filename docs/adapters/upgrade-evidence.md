# Adapter Upgrade Evidence

The machine-readable contract is
[`adapter-upgrade-evidence.schema.json`](../../schemas/adapter-upgrade-evidence.schema.json).
It records a pair or chain review without storing raw project paths, project identifiers,
environment values, credentials, or upgrade mutations.

## Contract Contents

Every record includes:

- Contract, validator, invocation, and timestamp identity.
- Sanitized before and after project summaries.
- Core, adapter, schema, skill, compatibility, and pin information.
- Restriction inheritance and approval requirements.
- Risks, failures, warnings, confidence, and recommended action.
- Final `pass`, `warn`, `fail`, or `blocked` status.
- An explicit `changedState.changed: false` declaration.

Chain records additionally include a synthetic chain ID and ordinal transition summaries.
Revision labels such as `revision-1` are evidence-safe placeholders, not directory names.

## Pair Output

Print sanitized JSON:

```bash
node scripts/check-adapter-upgrade.mjs <before> <after> --json
```

Write one new JSON evidence file:

```bash
node scripts/check-adapter-upgrade.mjs <before> <after> --output validation-output/upgrade.json
```

## Chain Output

Print sanitized JSON:

```bash
node scripts/check-adapter-upgrade-chain.mjs <chain-root> --json
```

Write one new JSON evidence file:

```bash
node scripts/check-adapter-upgrade-chain.mjs <chain-root> --output validation-output/chain.json
```

Output paths must be relative, end in `.json`, remain beneath the current working directory,
have an existing non-symlink parent, avoid `.env` components, and identify a file that does
not already exist. Evidence output never overwrites a file.

The optional report write does not apply an adapter upgrade. The changed-state declaration
refers to project, adapter, Git, runtime, service, database, and remote state, all of which
remain unchanged.

## Status Policy

A stale exact pin or stale compatible range is blocking and produces `fail`. So do
unsupported cores, schema or skill drift, restriction weakening, evidence removal, failure
suppression, completion override, mode escalation, secret exposure, scope expansion, and
unsafe paths.

`warn` is reserved for compatible reviews carrying non-blocking approval requirements.
Passing evidence remains advisory and requires human approval before real-project adoption.
