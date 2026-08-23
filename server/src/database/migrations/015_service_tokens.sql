-- Service tokens: long-lived API tokens for local services (e.g. print service)
-- Tokens are stored hashed — the raw token is shown once at creation time.
CREATE TABLE IF NOT EXISTS service_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  "tokenHash" text NOT NULL UNIQUE,
  scope       text[] DEFAULT ARRAY['print'],
  "isActive"  boolean DEFAULT true,
  "lastUsedAt" timestamptz DEFAULT NULL,
  "createdAt" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_tokens_user_idx ON service_tokens ("userId");
CREATE INDEX IF NOT EXISTS service_tokens_hash_idx ON service_tokens ("tokenHash");
