# API_SECURITY.md

Hardening posture of the Express API.

## Transport & headers

- Helmet defaults (nosniff, X-Frame-Options, default CSP).
- No `x-powered-by`.
- CORS: origin allowlist only; same-origin short-circuit; never `*`.
- Production serves the SPA with immutable asset caching (index.html no-cache).

## Input handling

- Zod schemas on all mutation routes (`middlewares/zod`).
- `sanitizeJson` middleware; JSON body limit 10mb.
- Order extras resolved strictly against product rows; unknown extra => `400`.
- Item qty: 1..99; items count 1..100; extras per item <= 30.
- Uploads: image extensions only + magic-byte signature match after write.

## Rate limiting

- Global `/api`: 300/15m (env: `API_WINDOW_MS`, `API_LIMIT`).
- Auth: default 20/15m (`AUTH_LIMIT`, `AUTH_WINDOW_MS`).
- Newsletter subscribe/unsubscribe and contact: 10 per window.
- Admin users API: `ADMIN_API_LIMIT` per key.
- `DISABLE_RATE_LIMIT=1` is the solo off-switch (local dev).

## Sensitive data

- JWT secrets: 32+ chars, no defaults since the audit; runtime fail-fast.
- Stored tokens (refresh/verify/reset): SHA-256 hashes.
- Audit log body redaction (`password*|token|authorization|cookie|secret`).

## Known limits

- OAuth callback passes the access token in the URL fragment (S10, documented, dev).
- RLS is defense-in-depth only (S12).
- Social sessions: refresh session-revocation applies after first rotation.