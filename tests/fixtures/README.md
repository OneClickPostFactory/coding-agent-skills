# Fixtures

Current synthetic fixtures include:

- `sample-repo`: a dependency-free Node.js project with source, test, docs, and `.env.example`.
- `triggers/cases.json`: positive, negative, and wrong-skill prompt cases.
- `policy/commands.json`: safe and restricted shell-shape cases.
- `mutation/`: denied-category documents and a stable snapshot target.
- `privacy/cases.json`: split synthetic sensitive shapes.
- `adapters/`: valid narrowing plus distinct weakening attempts.
- `completion/`: single and matrix-style schema-valid false completions.

Future fixtures may cover dirty monorepos, non-Git projects, nested repositories, malformed manifests, bounded large trees, and secret-like filenames.

Fixtures must contain synthetic values only.
