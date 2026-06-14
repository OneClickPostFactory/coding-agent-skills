# Upgrade Evidence Examples

These records are synthetic examples of the
[adapter upgrade evidence contract](../../schemas/adapter-upgrade-evidence.schema.json).

- `valid-upgrade.evidence.json`: accepted adjacent upgrade.
- `stale-pin.evidence.json`: stale exact pin rejected.
- `unsafe-upgrade.evidence.json`: restriction weakening rejected.
- `chain-pass.evidence.json`: three compatible revisions accepted.
- `chain-fail.evidence.json`: a chain containing policy weakening rejected.

The Markdown files demonstrate safe human summaries. JSON is authoritative for schema
validation. Examples contain no filesystem paths, project IDs, credentials, or real
repository details, and every `changedState.changed` value is `false`.
