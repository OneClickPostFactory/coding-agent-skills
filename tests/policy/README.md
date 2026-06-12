# Command Policy Tests

Validate allowed command families with safe arguments and reject:

- Shell chains containing any restricted segment.
- Validation scripts whose definitions contain installs, fixes, deploys, or migrations.
- Git mutation hidden behind aliases or shell wrappers.
- Runtime lifecycle operations.
- Unbounded traversal.
- Secret-file reads and authenticated APIs.

Validate representative skill manifests and policies against the schemas in `schemas/`.
