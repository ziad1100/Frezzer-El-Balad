# SECURITY_ARCHITECTURE_AUDIT.md

Target architecture for the security-hardening pass described in `docs/SECURITY_AUDIT.md`.
This is the source of truth for **where** the project should be once findings S1-S11
land. Work lands phase-by-phase in commits; each phase is verified independently.

No real secret values are reproduced in this document.

## 1. Environment and secrets (target)

- `server/src/config/env.ts` reads configuration **only** from process env + `.env`.
- No fallback secret values of any kind:
  - `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` have **no** default. If missing, the
    server refuses to start.
  - `DATABASE_URL` has **no** database-less default. If missing, the server refuses to start
    in every environment (local dev provides it via `.env`).
- Production fail-fast: when `NODE_ENV === 'production'`, startup verifies that
  `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `DATABASE_URL` are present, are not the
  known dev placeholders, and are long enough (>= 32 chars for JWT secrets). Startup fails
  with a descriptive error otherwise.
- `.env` is never committed. `server/.env.example` remains the only tracked env file and
  contains placeholders only.
- `.gitignore` gains `*.pem`, `*.key`, `*.p12`, `*.pfx`, `.env.*` catch-alls (see S11).
- Optional operational settings stay optional: `ADMIN_REGISTER_CODE`, `SMTP_*`,
  `DISABLE_RATE_LIMIT` (rate-limit off switch used only in local dev).

## 2. Authentication and RBAC (target)

- `POST /auth/register` always creates `role: 'customer'`. A client-supplied `role` is
  ignored.
- Elevation paths:
  - `ADMIN_REGISTER_CODE` (env): if present and supplied, the created user may be granted
    `manager`/`employee`; if absent, only system/seed can create elevated roles.
  - Seed/admin provisioning remains the intended path for `admin`.
- `requireAuth`: JWT verified -> user loaded from DB per request -> `isActive` checked ->
  permissions resolved from `roles` rows (no cached client claims). Privilege checks are
  always evaluated against current DB rows.
- `requirePermission('posts', 'read')` etc. stays DB-driven. `GET /posts/all/admin` is
  behind auth + permission (closes S7).
- Passwords: bcrypt hashing is unchanged. DTO column lists continue to strip
  `password_hash` and all token columns from API responses.

## 3. Sessions / refresh token lifecycle (target)

- One stored refresh token per user (existing column). All modifications:
  1. Login: issue access + refresh cookies; store refresh hash.
  2. Refresh: verify, rotate, store new hash, detect reuse of an old valid hash ->
     revoke current hash + 401 (existing reuse-detection behavior preserved).
  3. Logout: delete cookies **and** clear the stored refresh token (revocation) — S4.
  4. Password change / password reset / deactivation / admin-disable: revoke the stored
     refresh token, forcing re-login — S4.
- Tokens at rest: `refresh_token`, `email_verify_token`, `reset_token` columns store
  SHA-256 **hashes** only; comparison always runs on the hashed input (S8).
  Test factories (`server/src/test/helpers`) that seed these columns store hashes too.
- Session management UI and MFA are out of scope per the audit pass (roadmap).

## 4. Order / pricing integrity (target)

- `POST /orders`:
  - Items and extras are resolved strictly against product rows.
  - Unknown extra name -> `400 Bad Request`; no `Number(e.price)` fallback remains (S2).
  - `qty` is capped (e.g. <= 99) in the Zod schema (S2).
  - Negative extra prices already rejected by Zod `nonNegative()` (no change needed).
- Subtotal, delivery fee, coupon discount, and total are always computed server-side from
  DB values (already true — locked in as a regression test).
- Cart `unit_price` stays server-derived from the product.

## 5. Uploads (target)

- Upload middleware:
  - Extension allowlist: image extensions only (`jpg/jpeg/png/webp/gif/avif`).
  - Magic-byte / MIME sniff: reject files whose leading bytes disagree with the claimed
    type (polyglot guard). Files that can't be confidently identified are rejected.
  - Stored filename remains a unique server-generated name (UUID-style, no client name).
- Static `/uploads` directory stays public only for validated images (S6 closed by the
  middleware, not by directory hardening).

## 6. Logging / activity audit (S5 target)

- `activityLogger` records: actor (user/ip), method, path, status, and a **sanitized**
  change payload.
- Sanitization: any field matching `password*`, `token`, `refresh_token`,
  `authorization`, `cookie` has its **value** replaced with `[REDACTED]` before the body
  is stored. Null/empty stays as-is.
- Console errors and API logs have the same redaction where request bodies appear.

## 7. Rate limiting and headers (target)

- Auth endpoints (login, register, refresh, forgot/reset, verify-email) rate-limited with
  tighter defaults than before; `DISABLE_RATE_LIMIT=1` allowed only in non-production.
- Contact/newsletter subscription endpoints get their own bounded limits.
- Admin API limited per-key.
- CSP: Helmet default CSP reappraised so the admin dashboard keeps working (react/Vite
  script sources allowed explicitly); HSTS reconsidered; existing X-nosniff/frameguard stay.
- No `Access-Control-Allow-Origin: *` ever; existing origin allowlist stays.

## 8. Public storefront / IDOR invariants (target)

- Only routes deliberately public: `/auth/*` entry points, `GET /products*`,
  `GET /posts` (published only), `GET /sponsors`, static `/uploads`.
- Every `GET /{resource}/:id` owner-checked: orders, cart, wishlist, notifications belong
  to the requesting user -> `404` (no existence leak) / `403`.
- Admin listing routes never materialise outside auth + permission.

## 9. Database posture (target)

- RLS stays enabled; server-side authz is the primary boundary (S12 stays documented).
- No new token/credential columns are added to the DB schema; the existing token columns
  simply store hashes.

## Appendix A — Finding -> phase mapping (see runbook in SECURITY_AUDIT.md)

| Phase | Work | Closes |
|---|---|---|
| P1 | env fail-fast, remove dev fallback secrets, gitignore hardening | S3, S11 |
| P2 | register role lock, token revocation on logout/change/reset/disable, hashing at rest, OTP production gating, social-login cleanup | S1, S4, S8, S9, S10 |
| P3 | strict extra resolution, qty cap, pricing locks + tests | S2 |
| P4 | guard posts/admin, IDOR spot-checks | S7 |
| P5 | upload whitelist + magic bytes | S6 |
| P6 | rate-limit knobs, header/CSP review | (hardening) |
| P7 | activity-log redaction | S5 |

## Appendix B — phase verification (exit criteria)

Per phase, before committing: `tsc --noEmit` passes and the targeted vitest suite passes
(green). P8 adds regression cases for every finding above (tampered role 403, unknown-extra
400, qty>99 422, revoked-token 401, polyglot upload 400, rate-limit 429, redaction check).
The full suite must remain green; no endpoint contract removed; no client-facing flow
removed. The existing 156 tests are the majority baseline to preserve.