# Release Process

## Checklist

1. Confirm only approved skills exist.
2. Run `node scripts/validate-pack.mjs .`.
3. Run `node scripts/test-pack.mjs`.
4. Parse every JSON file.
5. Run a secret-pattern scan without printing values.
6. Run `git diff --check`.
7. Review changelog and versioning impact.
8. Commit with approved identity.
9. Push `main` using credential-free remotes.
10. Confirm a clean synchronized worktree.
11. Create and push the annotated version tag.

Release automation, package publication, deployments, migrations, and GitHub Release pages are outside the pilot release.
