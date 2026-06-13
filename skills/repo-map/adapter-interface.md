# Project Adapter Interface

Validate adapters against `../../schemas/project-adapter.schema.json` and confirm manifest compatibility before applying them.

An adapter may provide:

- Adapter identifier and version.
- Repository-root markers.
- Additional safe manifest filenames.
- Bounded ignored-path patterns.
- Documentation precedence.
- Known application, package, test, CI, migration, and generated-code locations.
- Safe structured-parser choices.
- Extra required evidence fields.

An adapter must not add mutation commands, remove restricted categories, permit secret reads, expand traversal beyond scope, suppress failures or dirty-state evidence, or redefine `complete`.

Shared policy always wins. Reject an adapter whose rule cannot be reconciled safely.
