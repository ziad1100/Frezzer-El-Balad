-- 012_add_admin_account.sql
-- Add the required admin account for the Frezzer El Balad project.
-- Password is bcrypt-hashed (10 rounds). Never store plaintext passwords.

INSERT INTO users ("fullName", email, "passwordHash", role, phone, "isVerified", "isActive", provider)
VALUES (
  'مدير النظام',
  'admin@frezzerelbalad.com',
  '$2a$10$7HUdrnZ9TsRFGYgyjbvu8ugLe0WuKO1pdyGO/5Em/0Yok8JXF7g/e',
  'admin',
  '01000000001',
  true,
  true,
  'local'
)
ON CONFLICT (email) DO UPDATE
  SET "passwordHash" = EXCLUDED."passwordHash",
      role = EXCLUDED.role,
      "isActive" = true,
      "isVerified" = true;
