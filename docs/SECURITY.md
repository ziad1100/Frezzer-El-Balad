# SECURITY.md

Security overview, policy and roadmap for the ORABI restaurant e-commerce platform.

Status: hardening pass in progress (see `docs/SECURITY_AUDIT.md` for finding statuses).

## Responsibilities

| Contact | Topic |
|---|---|
| Repository owner (Ziad) | All security matters |
| `ziad1100` | GitHub issues, responsible disclosure |

## Reporting a vulnerability

1. Do **not** open a public issue for security bugs.
2. Message the owner privately or open a draft advisory with reproduction steps.
3. Do not include live credentials in reports.

## Security contracts (brief)

- Server-side authorization is the only trusted boundary; the DB (RLS) is defense-in-depth only.
- Client-supplied prices, roles and payment status are never trusted.
- Secrets live only in environment variables; `server/.env.example` holds placeholders.
- Sessions are revocable; stored tokens are hashed (SHA-256) at rest.
- Uploads are validated by extension allowlist + magic bytes.
- Audit logs are redacted before persistence.

## Roadmap (explicitly deferred)

- MFA (TOTP) for all staff roles.
- Session-management UI (view/revoke sessions/devices).
- RLS policy hardening for direct-DB access.
- OAuth code flow for social login (replaces token fragment transfer).

See `docs/THREAT_MODEL.md`, `docs/INCIDENT_RESPONSE.md`, `docs/SECRET_MANAGEMENT.md`.