# Runtime Truth Checklist

- [ ] Record expected service, manager, executable, port, and health endpoint.
- [ ] Inspect manager status without mutation.
- [ ] Inspect matching processes and start times.
- [ ] Inspect expected listeners and owners.
- [ ] Call only unauthenticated safe health endpoints.
- [ ] Correlate configuration, manager, process, listener, and HTTP evidence.
- [ ] Report conflicts and stale processes.
- [ ] Confirm no process, service, secret, or remote state changed.
- [ ] Emit timestamped runtime evidence.
