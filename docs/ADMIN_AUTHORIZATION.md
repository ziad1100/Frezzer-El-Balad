# ADMIN_AUTHORIZATION.md

How elevation to admin/manager works and how admin routes are protected.

## Role model

Roles come from the `roles` table; each role carries a `permissions` JSONB map
(`resource -> actions[]`). Auth never trusts a client-supplied role.

## Becoming admin/staff

1. Seed (`npm run seed`) creates roles and the initial admin.
2. Self-registration as `admin` requires `ADMIN_REGISTER_CODE` env var; absent =>
   registration route replies `403 Admin registration is disabled`.
3. A user's role can be changed only via `admin/users` endpoints (permission-gated).

`manager` / `employee` roles are never assignable from the register endpoint (they are
rejected by the Zod register schema and never assumed from the request body).

## Enforcement

- `requireAuth` -> DB permissions per request (no cached JWT claims).
- `requirePermission(resource, action)` -> 403 without the permission.
- Admin router groups (e.g. `posts/all/admin`) sit behind both.

## Data model sanity checks

- `GET /posts/all/admin` returns drafts only for staff (verified 401/403 for everyone
  else).
- `requireAuth` fresh `isActive` check disconnects deactivated accounts immediately.