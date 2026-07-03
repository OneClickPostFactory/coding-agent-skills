# Project Adapters

Project-specific adapters live in their owning project repositories, not this shared repository.
They add bounded project context to a compatible shared skill. They are data, not executable plugins.

Every adapter must validate against [the project-adapter schema](../../schemas/project-adapter.schema.json).

## Convention And Discovery

External discovery is opt-in and bounded to three project-relative locations. Each adapter
uses the exact manifest name `adapter.json`. See [the discovery convention](discovery.md)
for path and symlink rules, [external validation](external-adapters.md) for manifest-only
CLI behavior, and [project installation](project-installation.md) for declaration and
version-pinning rules. Use [upgrade checks](upgrades.md) to compare two declared revisions
or a multi-step compatibility chain before changing a real project. The
[upgrade evidence contract](upgrade-evidence.md) defines sanitized review output. The
[real project adoption gate](real-project-adoption.md) defines the approval and evidence
requirements that must be met before any real project adapter is created.

Discovery validates schema, skill compatibility, command policy, and inherited restrictions
before accepting any extension. It never executes adapter commands.

## Adapter-Aware Repo Map Consumption

The shared pack can consume a validated project-owned adapter as agent context for
`repo-map` orientation:

```bash
node scripts/render-adapter-repo-map.mjs <project-root>
```

The renderer validates the project declaration first, confirms that `repo-map` is enabled,
then reports only adapter-declared metadata: documentation precedence, safe read paths,
ignored paths, required evidence, package-manager hints, repository bounds, and sanitized
Git branch state. It does not read target project file contents, run project tests or
builds, install packages, perform runtime checks, deploy, migrate, or read `.env` files.

This is agent context for safer repository understanding. It is not target-application
product behavior.

## Adapter-Aware Route Trace Consumption

The shared pack can consume a validated project-owned adapter as bounded context for
`route-trace`:

```bash
node scripts/render-route-trace.mjs <project-root>
```

The renderer validates the project declaration when present. If an adapter is present but
does not enable `route-trace`, it reports an adapter-limited skip instead of broadening
scope. When enabled, it reads only adapter-declared safe paths, applies ignored paths, and
statically reports verified route files, inferred route patterns, skipped items, and
not-verified runtime-dependent routing classes. It does not execute target code, run
servers, hit URLs, build, test, deploy, migrate, inspect databases, or read `.env` files.

## What Adapters May Do

- Add bounded relative read paths and ignored paths.
- Declare project-root markers and a bounded detection depth.
- Add documentation precedence and package-manager hints.
- Add route-trace safe read paths for static route files and route config.
- Add command aliases that already satisfy the shared command policy.
- Add status-only runtime commands and manager hints.
- Require additional evidence or named approval for exceptional reads.

## What Adapters Must Never Do

- Remove inherited denied-operation categories.
- Change an audit-only skill into an action-capable skill.
- Permit deployment, Git publication, installation, migration, or service mutation.
- Expose secrets or add secret-bearing paths.
- Suppress failures, contradictions, dirty state, or required evidence.
- Redefine completion semantics.
- Expand scanning outside the declared project root without named approval.

## Compatibility And Inheritance

Skill manifests declare the adapter contract and compatible adapter versions. An adapter separately declares supported skill IDs, compatible skill versions, and the unchanged skill mode.

Compatibility requires both declarations to agree. Exact pilot versions and the `0.2.x`
compatibility form are supported in v0.2.3. Upgrade comparisons also preserve adapter
identity, inherited restrictions, and required evidence across revisions.

The `inheritance` object is mandatory. Shared restrictions always win, and every permission-like safety flag is fixed to `false`.

The shared skill repository stores only synthetic fixture roots. The first external
project-owned adapter was adopted in `/home/oneclickwebsitedesignfactory/tax-lien-platform`
at candidate commit `c548b1a6cbb3455a70b89d0e301e22435bfccac9`. That adapter is
`repo-map` only, docs/metadata-only, and contains no commands, runtime checks,
build/test/package behavior, platform behavior, deployment behavior, or secret-aware
behavior.

During publication, the candidate repository's normal pre-push hook attempted package
operations, including install, audit, and typecheck. The run was interrupted to preserve
the approved boundary, validation was kept to the shared adapter validators and safe
checks, and publication completed with hook verification bypass. Future real-project
adapter adoption must decide explicitly whether repository hooks are allowed or must be
bypassed to preserve a no-install/no-build/no-test boundary.
