# Adapter Tests

Test that adapters can add safe manifests, check aliases, documentation precedence, status-only runtime commands, and evidence requirements.

Reject adapters that widen scope, permit restricted operations, hide dirty state or failures, access secrets, or redefine completion. Shared policy must win deterministically.

Executable fixtures cover valid narrowing, deployment permission, Git push permission, failure suppression, completion override, secret exposure, and audit-only mode override.
