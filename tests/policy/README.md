# Command Policy Tests

`tests/fixtures/policy/commands.json` validates safe single commands, safe composition, multiline commands, and rejection of:

- Shell chains containing any restricted segment.
- Validation scripts whose definitions contain installs, fixes, deploys, or migrations.
- Git mutation hidden behind aliases or shell wrappers.
- Runtime lifecycle operations.
- Unbounded traversal.
- Secret-file reads and authenticated APIs.

Validate representative skill manifests and policies against the schemas in `schemas/`.

`tests/fixtures/policy/properties.json` generates cross-products of safe prefixes, separators, and restricted suffixes, then checks wrappers, heredocs, arguments, provider-specific `npx`, curl approvals, bounded reads, and package-script bodies.

The analyzer is deliberately bounded. It rejects obvious bypasses and unknown execution rather than claiming full POSIX shell parsing.
