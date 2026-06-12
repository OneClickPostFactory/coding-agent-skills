# Evidence Tests

The release suite validates all five example evidence packs against the shared schema and applies semantic completion rules.

Current checks confirm:

- Required identity and invocation fields exist.
- Command records satisfy the contract.
- Skipped checks include consequences and completion permission.
- Failures and unresolved questions prevent unsupported completion.
- `changedState.changed` remains `false` for every audit-only skill.
- Confidence includes a reason.
- A schema-valid fixture with a completion-blocking skipped check cannot claim `complete`.

Future invocation tests should verify artifact reporting for `build-verify`, handoff wording, and end-to-end output sanitization.
