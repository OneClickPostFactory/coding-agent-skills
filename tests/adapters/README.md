# Adapter Tests

Test that adapters can add safe manifests, check aliases, documentation precedence, status-only runtime commands, and evidence requirements.

Reject adapters that widen scope, permit restricted operations, hide dirty state or failures, access secrets, or redefine completion. Shared policy must win deterministically.

Executable fixtures validate the formal adapter schema and cover valid narrowing, documentation precedence, deployment permission, Git push permission, failure suppression, completion override, secret exposure, restriction removal, stale compatibility, evidence removal, scope expansion, and audit-only mode override.

External fixture roots additionally test bounded location discovery, exact manifest naming,
valid and invalid mixed roots, empty and missing roots, malformed JSON, traversal, symlink
escape, adapter and skill versions, unsupported skill IDs, and safe CLI summaries.
