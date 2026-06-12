# Versioning

Use Semantic Versioning:

- **Patch:** wording, validation, examples, or safety fixes that preserve behavior.
- **Minor:** new approved skills, compatible schema fields, or new adapter capabilities.
- **Major:** incompatible contracts, renamed skills, weakened compatibility, or changed completion semantics.

Skill examples use the repository release version. Evidence packs separately record their contract version.

Tags use `vMAJOR.MINOR.PATCH`. Tags are created only after validation passes, `main` is pushed, the working tree is clean, and local and remote branches are synchronized.
