# Evidence-Pack Contract

The evidence pack records what a skill intended to do, what it actually inspected or executed, what changed, and why its final status is justified.

Every invocation emits repository and invocation identity, intent and scope, adapter and environment context, sanitized command records, skipped checks, findings, risks, failures, unresolved questions, an explicit changed-state declaration, status and confidence, and a handoff.

Valid statuses are `complete`, `partial`, `failed`, and `blocked`. Claim `complete` only when all required checks passed or were safely deemed not applicable, no unresolved issue invalidates the objective, and the changed-state declaration is accurate.

Use [evidence-pack.schema.json](evidence-pack.schema.json) for machine validation. The JSON and Markdown examples show equivalent representations.

## Minimum Completion Evidence

- Skill, invocation, and repository identity.
- Declared scope and adapter.
- All required command or inspection records.
- Skipped checks with consequences.
- Findings, risks, failures, and unresolved questions.
- Accurate changed-state declaration.
- Status and confidence reason.
- Handoff summary and next action.

Audit-only skills must set `changedState.changed` to `false` unless an unexpected mutation is detected; an unexpected mutation prevents `complete`.
