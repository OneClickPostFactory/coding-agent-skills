# Completion Tests

Verify that no skill reports `complete` when:

- A required check failed.
- A required check was skipped and `completionPermitted` is false.
- Repository or runtime identity remains ambiguous.
- A material claim is unclassified.
- An audit-only skill changed state.
- A validation command produced an unreviewed mutation.
- Required evidence fields are missing.

Passing a subset of checks must not imply overall success.
