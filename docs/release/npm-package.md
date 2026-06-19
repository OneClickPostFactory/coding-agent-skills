# Npm Package Readiness

This package scaffold exists to prove package shape before any npm publication is
approved. It does not publish the package, install dependencies, add a global install
flow, or change the shared skill safety model.

## Current Package Shape

- Package name: `coding-agent-skills`.
- Package version: `0.2.7`.
- CLI bin: `coding-agent-skills` mapped to `./bin/coding-agent-skills`.
- Module type: `module`.
- Dependencies: none.
- Publication guard: `private: true`.
- License metadata: `UNLICENSED` until a license is explicitly approved.

The package version follows the npm-readiness scaffold. Adapter compatibility remains
controlled by the existing shared core and project-adapter validators.

`coding-agent-skills validate-pack` is package-aware. In a source checkout, it keeps
source-only checks such as `.gitignore` validation. In an installed package tree, where
`.gitignore` is not packaged, it validates the package metadata, strict `files`
allowlist, dependency-free shape, bin mapping, required packaged files, and absence of
environment files instead of silently skipping safety checks.

## Included Files

The package uses a strict `files` allowlist. It includes the local command wrapper,
scripts, skills, schemas, contracts, docs, examples, tests, release workflow metadata,
and governance files needed for `coding-agent-skills validate-pack` to work after
packaging.

The allowlist intentionally excludes local environment files, Git internals, generated
validation output, dependency folders, and project-specific adapters.

## Dry-Run Check

Before any publication approval, run the dry-run package inspection:

```bash
npm pack --dry-run
```

The dry-run output must be reviewed for accidental secrets, local-only files, environment
files, dependency folders, build artifacts, generated validation output, or unrelated
project files. It must also confirm that the bin wrapper and validation inputs are
included.

## Publish Safety Gates

Publication remains blocked until a separate approval explicitly resolves:

- Package scope or final package name.
- License choice and whether to add a license file.
- Removing or changing the `private` publication guard.
- Registry access, npm identity, and two-factor/authentication expectations.
- Tarball contents from a clean dry run.
- Post-install smoke expectations in a disposable environment.
- Whether a Git tag should be created for the npm-ready scaffold or only for actual
  publication.

Publication must not proceed from this scaffold milestone.
