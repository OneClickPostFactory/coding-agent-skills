# Examples

## Safe

- "Is the local API actually running and healthy?"
- `ss -lntp`
- `systemctl --user status <service> --no-pager`
- `pm2 list`
- `curl -sS http://127.0.0.1:<port>/health`

Use filters and bounded output whenever possible.

## Unsafe

- "Restart it if unhealthy."
- "Load `.env` and call the admin endpoint."
- "Kill the old process and redeploy."
- "Enable the service at boot."

Report the required action without performing it.
