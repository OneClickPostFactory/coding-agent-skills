# Safety Tests

The release suite verifies full restricted-category preservation, adapter non-weakening, audit-only evidence state, safe executable examples, ignored local environment files, and audit-only Markdown mutation guidance.

The command-policy harness verifies rejection of:

- Writes and destructive filesystem operations.
- Package installation or upgrades.
- Deployment and migration application.
- Git mutation and publication.
- Unrestricted home-directory traversal.
- Secret-file reads.
- Process and service mutation.
- Privileged or authenticated APIs.
- Allowed commands chained to restricted commands.

Current content snapshots hash synthetic fixture state before and after audit-only document checks. A future invocation harness should also compare Git, process, service, and mock remote state.
