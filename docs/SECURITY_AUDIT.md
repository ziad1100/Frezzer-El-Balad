# SECURITY_AUDIT.md

Security audit of the ORABI restaurant e-commerce application.
Audited: 2026-08-09.

Scope: server API (Express + PostgreSQL), auth/RBAC, sessions, uploads, order/pricing
business logic, secrets, environment, Git hygiene, client.

Method: source review + targeted probing. No real secret values are reproduced anywhere
in this report — any discovered secret would be reported as `[REDACTED SECRET]`.

## Runbook status

Findings below are the audit baseline. Each has a `Status`; fixes land phase-by-phase
(`docs/SECURITY_ARCHITECTURE_AUDIT.md` describes the target architecture).

## Findings

| # | Severity | Finding | Location | Risk | Recommended Fix | Status |
|---|---|---|---|---|---|---|
| S1 | Critical | `POST /auth/register` accepts an arbitrary `role`; only `admin` requires a code — anyone can self-register as `manager` or `employee` | `server/src/controllers/auth.controller.ts:34-42` | Privilege escalation (register with elevated role) | Ignore client `role` unless a valid `ADMIN_REGISTER_CODE` is supplied; customers always get `customer` | fixed (P2) |
| S2 | Critical | Order pricing trusts client `extras` prices when the name is not found on the product (`Number(e.price) || 0`); `qty` is unbounded | `server/src/controllers/order.controller.ts:48-54` | Price manipulation (craft cheap extra lines, undersize an order) | Resolve extras strictly against product rows; reject unknown extras; cap `qty` (e.g. 99) | fixed (P3) |
| S3 | High | Hard-coded fallback JWT secrets (`dev_access_secret_change_me` / `dev_refresh_secret_change_me`) and a default `DATABASE_URL` containing credentials; no production fail-fast | `server/src/config/env.ts:16,24-27` | Predictable signing secrets / DB creds if env missing in prod | Remove dev secret fallbacks; throw on missing `JWT_*`/`DATABASE_URL` when `NODE_ENV=production` | fixed (P1) |
| S4 | High | Logout only clears cookies; the stored refresh token stays valid. Password change / password reset / account deactivation do not invalidate sessions | `server/src/controllers/auth.controller.ts:99,154-175` | Stolen refresh token stays usable post-logout; sessions survive password change | Revoke stored refresh token on logout/change/reset/disable | fixed (P2) |
| S5 | High | Audit logger stores the full request body (`changes`) which may embed passwords/tokens | `server/src/middlewares/activityLogger.ts:19` | Secrets persisted in a log table | Redact sensitive keys (`password*`, `token`, `refreshToken`, `authorization`) before storing | fixed (P7) |
| S6 | High | Upload filter trusts client MIME + keeps the client-supplied extension; no magic-byte check | `server/src/middlewares/upload.ts:16,22-28` | Stored-XSS via polyglot files served from `/uploads` | Extension whitelist (image ext. only) + magic-byte sniff; reject reliably-malformed files | fixed (P5) |
| S7 | Medium | `GET /api/v1/posts/all/admin` (draft/pending listing) is public — sits before any auth boundary | `server/src/routes/post.routes.ts:16` | Unpublished content leaks | Move behind `requireAuth` + `requirePermission('posts','read')` | verified 401/403 (P4) |
| S8 | Medium | Email-verification and password-reset tokens are stored in plaintext in `users` | `server/src/db/users.ts:49-57` | DB leak = usable reset/verify tokens | Store SHA-256 hashes; compare hashed inputs (dev helpers update accordingly) | fixed (P2) |
| S9 | Medium | `forgot-password` returns the OTP/link in the response whenever SMTP is not configured, including in production | `server/src/controllers/auth.controller.ts:141-143` | OTP disclosure on misconfigured production | Only return dev payload when `NODE_ENV !== 'production'` | fixed (P2) |
| S10 | Low | Social login redirects with the access token in the URL fragment | `server/src/controllers/auth.controller.ts:209` | Token in browser history/3rd-party analytics | Keep for dev (client contract) — documented; revisit with OAuth code flow | documented |
| S11 | Low | `.gitignore` lacks `*.pem`/`*.key`/`.env.*` catch-alls; tracked files otherwise clean (no secrets found) | `.gitignore` | Accidental future leakage of key material | Harden ignore patterns; keep `server/.env.example` as the only tracked env file | fixed (P1) |
| S12 | Info | Row Level Security enabled with public-facing policies, but the API connects as superuser/owner which bypasses RLS at the table level | `server/src/database/migrations/001_init.sql`, `server/src/db/index.ts` | RLS provides no protection for the server-account | Keep as documented defense-in-depth for any future direct-db access; server-side authz remains the primary boundary | documented |

## Reviewed-and-clean (no finding)

- `requireAuth` verifies JWT, loads the user from DB each request, checks `isActive`, resolves permissions from the `roles` table (no cached client claims).
- `requirePermission` is DB/permission-driven; all admin routers are gated.
- Order totals, subtotals, delivery fees, coupon discounts are computed server-side from DB values; cart `unitPrice` is server-derived from the product.
- No password/`passwordHash` is ever returned in API responses (DTO column lists).
- `apiErrorFromPg` maps DB errors to clean messages; production error handler omits stack traces.
- Auth cookies are `HttpOnly` + `SameSite=Lax`; refresh rotation detects reuse.
- Helmet is enabled (nosniff, frame protection, default CSP), CORS is origin-limitlist (no `*`), auth endpoints are rate-limited.
- No tracked `.env`/`.pem`/`.key` files; only placeholder `server/.env.example` exists in Git.

## Remaining after this pass (explicitly out of scope)

- MFA (TOTP) — deferred to a roadmap item (`docs/SECURITY.md`).
- Full session-management UI (view/devices/revoke) — refresh-token revocation only in this pass.
- RLS — no policy changes (see S12).
