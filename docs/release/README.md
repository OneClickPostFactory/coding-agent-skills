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
11. Review changelog, ledger, run evidence, and versioning impact.
12. Commit with approved identity.
13. Push `main` using credential-free remotes.
14. Confirm a clean synchronized worktree.
15. Create and push the annotated version tag.

Release automation, package publication, deployments, migrations, and GitHub Release pages are outside the pilot release.

The [npm package readiness scaffold](npm-package.md) documents the local package shape,
dry-run inspection, and publish safety gates. It is not publication approval.

## Maintainer-Loop Boundary

The maintainer loop may run release preflight when `release-preflight` is explicitly
allowed. The `commit`, `tag`, and `push` permissions represent separate human approval
boundaries; the initial runner records and stops at those gates rather than publishing
silently.
