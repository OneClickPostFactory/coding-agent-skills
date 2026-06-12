# Safety Tests

Verify rejection of:

- Writes and destructive filesystem operations.
- Package installation or upgrades.
- Deployment and migration application.
- Git mutation and publication.
- Unrestricted home-directory traversal.
- Secret-file reads.
- Process and service mutation.
- Privileged or authenticated APIs.
- Allowed commands chained to restricted commands.

Capture project tree, Git state, process state, and configured mock remote state before and after each audit-only test. They must remain equivalent.
