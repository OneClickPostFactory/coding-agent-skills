# Release Process

## Checklist

1. Confirm only approved skills exist.
2. Run `node scripts/validate-pack.mjs .`.
3. Run `node scripts/test-pack.mjs`.
4. Run `node scripts/validate-maintainer-loop.mjs .`.
5. Run `node --test`.
6. Parse every JSON file.
7. Run a secret-pattern scan without printing values.
8. Run `git diff --check`.
9. Review changelog, ledger, run evidence, and versioning impact.
10. Commit with approved identity.
11. Push `main` using credential-free remotes.
12. Confirm a clean synchronized worktree.
13. Create and push the annotated version tag.

Release automation, package publication, deployments, migrations, and GitHub Release pages are outside the pilot release.

## Maintainer-Loop Boundary

The maintainer loop may run release preflight when `release-preflight` is explicitly
allowed. The `commit`, `tag`, and `push` permissions represent separate human approval
boundaries; the initial runner records and stops at those gates rather than publishing
silently.
