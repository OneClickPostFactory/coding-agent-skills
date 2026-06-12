# Fixtures

Current synthetic fixtures include:

- `sample-repo`: a dependency-free Node.js project with source, test, docs, and `.env.example`.
- `adapters/valid-repo-map.json`: an adapter that preserves every base restriction.
- `adapters/weakening-repo-map.json`: a deliberately invalid adapter for rejection tests.
- `completion/false-complete.json`: schema-valid evidence that must fail semantic completion policy.

Future fixtures may cover dirty monorepos, non-Git projects, nested repositories, malformed manifests, bounded large trees, and secret-like filenames.

Fixtures must contain synthetic values only.
