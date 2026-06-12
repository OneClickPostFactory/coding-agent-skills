# Safety Tests

The release suite currently verifies full restricted-category preservation, adapter non-weakening, audit-only evidence state, safe executable examples, and ignored local environment files.

Future command-parser and execution-harness tests must also verify rejection of:

- Writes and destructive filesystem operations.
- Package installation or upgrades.
- Deployment and migration application.
- Git mutation and publication.
- Unrestricted home-directory traversal.
- Secret-file reads.
- Process and service mutation.
- Privileged or authenticated APIs.
- Allowed commands chained to restricted commands.

When invocation harnesses are added, capture project tree, Git state, process state, and configured mock remote state before and after each audit-only test. They must remain equivalent.
