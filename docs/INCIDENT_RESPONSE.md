# INCIDENT_RESPONSE.md

Runbook for security incidents in the ORABI platform.

## Triage checklist

1. **Contain** — kill long-running admin sessions:
   - Staff account compromise: set `isActive = false` (revokes sessions instantly).
   - Secrets exposed: rotate keys/changes; disable, redeploy.
2. **Identify scope**:
   - Which paths/users/orders are affected? (time window + IPs from `activityLogs`.
   - Check `users` for unexpected rows/roles; `orders` for tampered totals;
     token-column values for changes.
3. **Preserve evidence** — export logs and DB states; do not overwrite.
4. **Notify** — affected customers; repo owner; applies to the reporting policy in
   `docs/SECURITY.md`.

## Playbooks

### Account/privilege take-over suspected
- Deactivate accounts, force password reset (revokes all sessions).
- Review `roles` table and `users.role` diffs.
- Rotate JWT secrets (kills every bearer token) — see SECRET_ROTATION.md.

### Secret leaked (in code/log/report)
- Assume compromised everywhere: rotate all, never reuse old secret.
- Remove from git history; rotate again if published anywhere.
- Continue deployment gate: server must not run with known placeholders (boot fail-fast).

### Brute-force / mass signup
- Raise `AUTH_LIMIT` window or enable more; check signup rates by IP.
- Verify `ADMIN_REGISTER_CODE` is unset or strong; enable deactivation.

## Post-incident
- Update this page; write a 5-why; add regression tests; track in SECURITY_AUDIT.md.