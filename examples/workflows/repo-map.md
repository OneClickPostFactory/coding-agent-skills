# Repo Map Workflow

**Intent:** Understand `/workspace/example-project` before planning a change.

1. Record the declared scope.
2. Confirm the repository root and Git identity.
3. List bounded top-level structure.
4. Read known manifests and governing documentation.
5. Locate entry points, tests, CI, migrations, and generated boundaries.
6. Emit `examples/evidence-packs/repo-map.json`-shaped evidence.

Safe command shapes include:

```bash
pwd
git status --short --branch
rg --files -g '!node_modules'
```

**Unsafe and denied:** unrestricted home traversal, secret-file reads, writes, installs, and Git mutation.
