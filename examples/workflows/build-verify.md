# Build Verify Workflow

**Intent:** Validate an existing project change using scripts already defined by the project.

1. Inspect manifests and CI.
2. Reject unknown, fixing, installing, deployment, migration, and watch scripts.
3. Run the narrowest relevant check.
4. Run required broad checks.
5. Compare tracked and untracked state before and after validation.
6. Emit `examples/evidence-packs/build-verify.json`-shaped evidence.

After manifest discovery confirms the scripts:

```bash
npm run typecheck
npm run test
npm run build
```

**Unsafe and denied:** dependency installation, automatic fixes, snapshot updates, deployment, and migration.
