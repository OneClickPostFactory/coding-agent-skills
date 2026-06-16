# Versioning

Use Semantic Versioning:

- **Patch:** wording, validation, examples, or safety fixes that preserve behavior.
- **Minor:** new approved skills, compatible schema fields, or new adapter capabilities.
- **Major:** incompatible contracts, renamed skills, weakened compatibility, or changed completion semantics.

Skill examples use the repository release version. Evidence packs separately record their contract version.

Tags use `vMAJOR.MINOR.PATCH`. Tags are created only after validation passes, `main` is pushed, the working tree is clean, and local and remote branches are synchronized.

## Project Pins

A project-owned adapter declaration records the expected shared core version and one version
pin. Supported forms are:

- Exact pin: `0.2.1`
- Compatible range: `>=0.2.0 <0.3.0`

Ranges are conjunctions of plain Semantic Versioning comparators. Caret, tilde, wildcard,
prerelease, build metadata, and logical-OR forms are not supported by the dependency-free
pilot parser.

The running core version must equal `expectedVersion` and satisfy `versionPin`. This rejects
unsupported old or future cores, stale declarations, and ranges that do not include the
current release. Adapter schema and adapter manifest versions are validated separately.

See [adapter compatibility](adapter-compatibility.md) for stale-pin, schema-drift, skill
compatibility, policy-preservation, and multi-step chain rules across project revisions.
