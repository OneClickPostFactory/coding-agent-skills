# Fixtures

Current synthetic fixtures include:

- `sample-repo`: a dependency-free Node.js project with source, test, docs, and `.env.example`.
- `triggers/cases.json`: positive, negative, and wrong-skill prompt cases.
- `policy/commands.json`: explicit safe and restricted shell-shape cases.
- `policy/properties.json`: generated composition, argument, wrapper, provider, and script-body cases.
- `mutation/`: denied-category documents and a stable snapshot target.
- `privacy/cases.json`: split synthetic sensitive shapes.
- `adapters/`: valid contract fixtures plus distinct schema and compatibility failures.
- `external-adapters/`: disposable project roots for bounded discovery and rejection tests.
- `project-adapter-installation/`: disposable repositories with declarations and version pins.
- `project-adapter-upgrades/`: paired disposable revisions for safe upgrades and drift rejection.
- `project-adapter-upgrade-chains/`: ordered disposable revisions for chain-level compatibility.
- `evidence-bundles/`: disposable evidence bundles for hash, replay, regression, and path checks.
- `completion/`: single and matrix-style schema-valid false completions.

Future fixtures may cover dirty monorepos, non-Git projects, nested repositories, malformed manifests, bounded large trees, and secret-like filenames.

Fixtures must contain synthetic values only.
