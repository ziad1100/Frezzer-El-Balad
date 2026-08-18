# Google Login & Email OTP Setup Guide

This guide enables two features in the ORABI app:

1. **Login with Google** (users and admins) — OAuth 2.0 via Google Cloud Console.
2. **Email OTP codes** — password-reset 6-digit codes delivered to the user's inbox via Gmail SMTP.

Both are **off by default**. The app still works without them (Google button is hidden, and the 6-digit code is shown on screen in "development mode" instead of being emailed).

---

## 1. Create the Google OAuth app

1. Go to <https://console.cloud.google.com> and open (or create) a project.
2. Menu → **APIs & Services → OAuth consent screen**.
   - User type: **External** (internal only works with Google Workspace accounts).
   - Fill in the app name (e.g. `ORABI Restaurant`) and support email.
   - Scopes: the default **email, profile, openid** scopes are enough.
   - Add your own Google account under **Test users** (while the app is in "Testing" status, only test users can sign in).
   - Optional: click **Publish app** once you're ready for everyone to sign in.
3. Menu → **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Name it e.g. `orabi-web`.
   - **Authorized JavaScript origins** (leave empty for local dev).
   - **Authorized redirect URIs** — add exactly:
     - `http://localhost:5000/api/v1/auth/google/callback`
     - If you deploy to a domain with HTTPS, also add `https://your-domain.com/api/v1/auth/google/callback`
4. Copy the **Client ID** and **Client secret** (and the exact redirect URI) into `.env` (see below).

## 2. Configure Google login in `.env`

Edit the root `.env` (it is gitignored — never commit it):

```env
GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxx
GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback
CLIENT_URL=http://localhost:5173
```

- The `GOOGLE_CALLBACK_URL` must exactly match an authorized redirect URI from step 3.
- `docker compose up -d --build` automatically passes these variables from `.env` into the app container.
- After restarting, the **"Continue with Google"** button appears on the login page, and `/api/v1/auth/providers` returns `{ "google": true }`.

### How admins sign in with Google

- New Google sign-ins are always created as **customers**.
- If the Google email matches an existing account (e.g. an admin who registered with the admin code), the user signs in as **that account**, keeping its role (admin/manager go straight to the dashboard).
- Deactivated accounts are blocked and redirected to `/login?error=deactivated`.

## 3. Set up Gmail SMTP for OTP emails

1. Go to <https://myaccount.google.com/security> and enable **2-Step Verification** (required for app passwords).
2. **Search → App passwords** (or Security → 2-Step Verification → App passwords).
3. Create a new app password (e.g. app `Mail`, device `ORABI server`) — Google shows a 16-character password.
4. Add to `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=youraddress@gmail.com
SMTP_PASS=the-16-char-app-password
MAIL_FROM=ORABI Restaurant <youraddress@gmail.com>
```

Notes:

- Use the **app password** in `SMTP_PASS`, not your normal Gmail password.
- `SMTP_PORT=465` uses SSL (recommended for Gmail). `587` (STARTTLS) also works.
- With SMTP configured, the forgot-password flow emails a 6-digit code and the API response stays `null` (prevents account enumeration). Without SMTP, the code is shown in the "Development mode" panel instead.

## 4. Restart the app

```bash
docker compose up -d --build
```

Then verify:

- `GET http://localhost:5000/api/v1/auth/providers` → `{ "google": true }`
- Login page shows the Google button.
- Forgot-password emails arrive with the 6-digit code, and `/reset-password` accepts it.

## Production notes

- The production callback URL must be HTTPS and added to the OAuth app's authorized redirect URIs.
- If the app container is behind a reverse proxy (nginx/traefik), keep the public callback URL in `GOOGLE_CALLBACK_URL` and the domain in `CLIENT_URL`.
