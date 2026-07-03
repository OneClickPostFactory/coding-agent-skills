# Release Process

## Checklist

1. Confirm only approved skills exist.
2. Run `node scripts/validate-pack.mjs .`.
3. Run `node scripts/test-pack.mjs`.
4. Run `node scripts/validate-maintainer-loop.mjs .`.
5. Run `node scripts/verify-evidence-bundle.mjs tests/fixtures/evidence-bundles/valid-bundle/evidence-bundle.json`.
6. Run `node scripts/render-evidence-archive-report.mjs tests/fixtures/evidence-bundles/valid-bundle/evidence-bundle.json`.
   Confirm the sanitized report includes archive-index status, retention-expiry advisory
   status, and detached-signature verification planning metadata without raw evidence.
7. Run `node --test`.
8. Parse every JSON file.
9. Run a secret-pattern scan without printing values.
10. Run `git diff --check`.
11. Run `npm publish --dry-run --access public --registry=https://registry.npmjs.org/`.
12. Create a tarball with `npm pack` into a temporary directory.
13. Inspect tarball contents for local-only files, credentials, `.env` files, dependency
    folders, generated output, and unrelated repositories.
14. Install the tarball into a temporary npm prefix and smoke-test the installed CLI.
15. Smoke-test any new CLI command such as `coding-agent-skills route-trace` or
    `coding-agent-skills env-audit` against synthetic fixtures only unless a real project
    read-only smoke is explicitly approved.
16. Review changelog, ledger, run evidence, and versioning impact.
17. Commit with approved identity.
18. Push `main` using credential-free remotes.
19. Confirm a clean synchronized worktree.
20. Create and push the annotated version tag.
21. Publish with `npm publish --access public --registry=https://registry.npmjs.org/`.
22. Install the published package into a temporary prefix and smoke-test the installed CLI.
23. Create the GitHub Release for the pushed tag.

Deployments, migrations, runtime mutation, platform actions, and target-project builds or
tests remain outside this release process unless separately approved.

The [npm package release guide](npm-package.md) documents the public package shape,
dry-run inspection, publication checks, and safety boundaries.

## Maintainer-Loop Boundary

The maintainer loop may run release preflight when `release-preflight` is explicitly
allowed. The `commit`, `tag`, and `push` permissions represent separate human approval
boundaries; the initial runner records and stops at those gates rather than publishing
silently.
