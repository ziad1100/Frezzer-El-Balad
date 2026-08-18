# THREAT_MODEL.md

Threat model for ORABI (Express + PostgreSQL storefront with staff roles).

## Assets

- Customer accounts (email/password, tokens, addresses, orders).
- Staff/admin accounts with write access to catalog/orders/users/notifications.
- Payment-method metadata (cash/card flag; no card numbers stored).
- Signing secrets, DB credentials, SMTP/OAuth details.
- Image upload storage and audit log.

## Trust boundaries

1. Internet -> API (rate-limited, Zod-validated).
2. Client claims -> server state (prices, roles, payment status never trusted).
3. API -> DB (hash tokens at rest; server is sole writer).
4. Redis/BullMQ (cache+queues; treated as disposable).
5. Logs/uploaded files (redacted writes; magic-byte sniffed images).

## Key risks addressed by the hardening pass

- **Privilege escalation** (S1): register is role-locked; admin requires a secret code.
- **Price manipulation** (S2): extras resolved against product rows; client prices ignored.
- **Identity/session theft** (S4): refresh hashes stored; revoked everywhere
  (logout/change/reset/deactivate) and reuse-detected on rotate.
- **Token exposure at rest** (S8): SHA-256 only.
- **Payload/proxy abuse** (S5/S6): redaction, upload allowlist + magic bytes.
- **Disclosure** (S7/S9): admin listing behind auth+perms; OTP not echoed in prod.
- **Abuse/DoS** (rate limits): auth, newsletter, contact, admin, per-key limits.
- **Secret leakage** (S3/S11/S10): prod fail-fast on boot, hardened gitignore,
  documented fragment-token dev behavior.

## Residual risk (accepted, roadmap)

- Token-in-fragment OAuth transfer (S10).
- RLS bypass by the API account (S12); MFA; session-management UI.