# SECRET_MANAGEMENT.md

How secrets are configured, rotated and currently not committed.

## Inventory

| Secret | Env var | Required | Notes |
|---|---|---|---|
| DB connection | `DATABASE_URL` | yes | no default since audit |
| JWT access | `JWT_ACCESS_SECRET` | yes | >= 32 chars |
| JWT refresh | `JWT_REFRESH_SECRET` | yes | >= 32 chars |
| Admin gate | `ADMIN_REGISTER_CODE` | no | absent => admin self-registrations disabled |
| SMTP | `SMTP_HOST/PORT/USER/PASS` | no | dev logs inline payloads |
| Cloudinary | `CLOUDINARY_*` | no | local-disk fallback |
| OAuth | `GOOGLE_*`, `FACEBOOK_*` | no | buttons hidden when empty |

## Rules

1. Only `server/.env.example` is tracked (placeholders, no real values).
2. `.gitignore` covers `.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`.
3. Load at boot only (config/env.ts); never in client bundles; never logged.
4. Startup in production fails fast when required secrets are missing, placeholders or
   too short.

## Rotation

See `docs/SECRET_ROTATION.md`.