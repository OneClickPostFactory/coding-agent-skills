# Evidence Tests

Validate every emitted evidence pack against the shared schema.

Test that:

- Required identity and invocation fields exist.
- Commands are sanitized and include results.
- Skipped checks include consequences.
- Failures and unresolved questions prevent unsupported completion.
- `changedState.changed` remains `false` for every audit-only skill.
- `build-verify` records any local artifacts created by approved validation commands.
- Confidence includes a reason.
- The handoff distinguishes verified facts from uncertainty.
- No secret or private fixture value appears in output.
