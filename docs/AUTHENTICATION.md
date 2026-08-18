# AUTHENTICATION.md

Local + social authentication flows. Source: `server/src/controllers/auth.controller.ts`,
`server/src/middlewares/auth.ts`, `server/src/utils/token.ts`.

## Flows

- **Register**: Zod-validated; role is always `customer` unless `ADMIN_REGISTER_CODE`
  matches. Verification email enqueued; token stored as SHA-256.
- **Login**: bcrypt compare -> `isActive` check -> cookies set (HttpOnly, SameSite=Lax);
  refresh token hash stored.
- **Refresh**: JWT must verify AND its hash must equal the stored hash; rotated on every
  use; reuse or revocation => `401`.
- **Verify email**: token lookup is on the stored hash only.
- **Forgot/reset password**: 6-digit OTP; dev-only inline return (never in production);
  reset revokes all sessions.
- **Change password**: requires current password; revokes refresh token.
- **Social login**: Google/Facebook via Passport; deactivated accounts redirected away.

## Sessions

- Access token `15m` (default), refresh token `7d` (default), rotating.
- Revocation points: logout, password change, password reset, admin deactivation.
- No MFA/session list yet (roadmap).

## Key security rules

- Tokens never stored in plaintext; hashes compared.
- Rate-limited (auth endpoints).
- `/me` returns no secrets; DTO columning strips any token/password fields.