# SECRET_ROTATION.md

Rotation runbook for the ORABI platform.

## When to rotate
- Trigger: any suspicion of leakage, staff turnover of a privileged account, or a
  vendor advisory.
- Schedule: JWT + DATABASE_URL quarterly; SMTP/Cloudinary/OAuth as needed.

## How to rotate

### JWT access/refresh secrets (all sessions reset)
1. Generate 48-byte hex: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
2. Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in the production env.
3. Restart the server (all live tokens die; users re-login).
4. Optionally run a DB cleanup: `UPDATE users SET "refreshToken" = NULL WHERE "refreshToken" IS NOT NULL`

### DATABASE_URL
- Create a new role/password, grant it, then flip the env var.
- Restart; revoke the old credential after a smoke test (consider a read-replica first).

### ADMIN_REGISTER_CODE
- Change; keep strong (>= 16 chars), never in code; disable by leaving it empty.

### SMTP / OAuth / Cloudinary
- Provider-declared revoke or credential change in dashboards; mirror to env;
  restart; verify one send.

## History
- Keep rotation notes along with `SECURITY_AUDIT.md` runbook status.