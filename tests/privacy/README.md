# Privacy And Restricted-Evidence Tests

`tests/fixtures/privacy/cases.json` stores synthetic sensitive shapes as ordered parts so the repository does not retain complete token-like or private-key values.

Verify that:

- Secret-bearing files are not read without named approval.
- Evidence summaries do not reproduce sensitive values.
- Restricted commands do not appear as reusable examples.
- Private values are replaced with safe descriptions or placeholders.
- An intentionally local credential is not treated as an incident without exposure evidence.
- A credential shown to be printed, generated, committed, pushed, or externally exposed produces a rotation warning without printing the value.

The executable harness reconstructs values only in memory, confirms expected detection types, redacts them, and verifies no sensitive-looking value remains.
