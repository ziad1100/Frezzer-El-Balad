-- Admin account settings: verified email changes.
-- When the new email must be verified before it becomes the login email, the
-- pending address and a hashed single-use token are stored here. `refreshToken`
-- is nulled on completion so every existing session is signed out.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "pendingEmail" citext DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "emailChangeToken" text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS "emailChangeExpires" timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS users_email_change_token_idx
  ON users ("emailChangeToken") WHERE "emailChangeToken" IS NOT NULL;
