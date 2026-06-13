# Release Process

## Checklist

1. Confirm only approved skills exist.
2. Run `node scripts/validate-pack.mjs .`.
3. Run `node scripts/test-pack.mjs`.
4. Run `node --test`.
5. Parse every JSON file.
6. Run a secret-pattern scan without printing values.
7. Run `git diff --check`.
8. Review changelog and versioning impact.
9. Commit with approved identity.
10. Push `main` using credential-free remotes.
11. Confirm a clean synchronized worktree.
12. Create and push the annotated version tag.

Release automation, package publication, deployments, migrations, and GitHub Release pages are outside the pilot release.
