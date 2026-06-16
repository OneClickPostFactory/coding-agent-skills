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
[upgrade evidence contract](upgrade-evidence.md) defines sanitized review output.

Discovery validates schema, skill compatibility, command policy, and inherited restrictions
before accepting any extension. It never executes adapter commands.

## What Adapters May Do

- Add bounded relative read paths and ignored paths.
- Declare project-root markers and a bounded detection depth.
- Add documentation precedence and package-manager hints.
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
compatibility form are supported in v0.2.1. Upgrade comparisons also preserve adapter
identity, inherited restrictions, and required evidence across revisions.

The `inheritance` object is mandatory. Shared restrictions always win, and every permission-like safety flag is fixed to `false`.

No real project adapter is implemented in the pilot release. The v0.2.1 harness uses only
disposable synthetic fixture roots.
