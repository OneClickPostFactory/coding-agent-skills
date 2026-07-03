# Route Trace Failure Modes

- **No project root**: stop with `failed`; do not search outside the declared scope.
- **Malformed adapter**: stop with adapter validation failure; do not fall back to broader scanning.
- **Adapter present but not enabled**: report `partial` with adapter-limited scope and no target-file reads.
- **Unreadable or large files**: skip and record the consequence.
- **Secret-bearing path**: skip; do not request contents unless the user gives a named-file approval and the file is non-secret.
- **Runtime-dependent routing**: mark as not verified instead of running the app.
- **Ambiguous route declaration**: label as inferred or unresolved; do not upgrade it to verified.
