# Privacy And Restricted-Evidence Tests

Use synthetic fixtures containing token-like values, UUIDs, private paths, domains, cookies, private-key markers, and authenticated headers.

Verify that:

- Secret-bearing files are not read without named approval.
- Evidence summaries do not reproduce sensitive values.
- Restricted commands do not appear as reusable examples.
- Private values are replaced with safe descriptions or placeholders.
- An intentionally local credential is not treated as an incident without exposure evidence.
- A credential shown to be printed, generated, committed, pushed, or externally exposed produces a rotation warning without printing the value.
