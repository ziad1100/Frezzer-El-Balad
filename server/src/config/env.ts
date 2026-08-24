import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// When bundled (e.g. esbuild → dist/server.js), import.meta.url points to dist/.
// We need to resolve from the project root (two levels up) OR from server/ (one
// level up). Try both so the dev and prod bundles both find server/.env.
const envPath = path.resolve(__dirname, '../../.env');
const envLocalPath = path.resolve(__dirname, '../../.env.local');
const altEnvPath = path.resolve(__dirname, '../.env');
const altEnvLocalPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath });
if (fs.existsSync(altEnvPath)) dotenv.config({ path: altEnvPath });
if (fs.existsSync(altEnvLocalPath)) dotenv.config({ path: altEnvLocalPath });

const MISSING_ENV_HINT =
  'Missing required environment variable "%s". This server requires explicit configuration: ' +
  'see server/.env.example and copy it to server/.env with real values. ' +
  'There is intentionally no insecure default.';

const requireEnv = (name: string, secret = false): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(MISSING_ENV_HINT.replace('%s', name));
  }
  if (secret && value.length < 32) {
    throw new Error(
      `Invalid environment variable "${name}": must be at least 32 characters. ` +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
    );
  }
  const knownPlaceholders = ['dev_access_secret_change_me', 'dev_refresh_secret_change_me'];
  if (secret && knownPlaceholders.includes(value)) {
    throw new Error(
      `Invalid environment variable "${name}": the legacy dev placeholder is not allowed. ` +
        'Generate a real secret with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
    );
  }
  return value;
};

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

const env = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT) || 5000,

  databaseUrl: requireEnv('DATABASE_URL'),
  pgMaxPoolSize: Number(process.env.PG_MAX_POOL_SIZE) || 20,

  redisUrl: process.env.REDIS_URL || '',

  jwtAccessSecret: requireEnv('JWT_ACCESS_SECRET', true),
  jwtRefreshSecret: requireEnv('JWT_REFRESH_SECRET', true),
  accessTokenExpires: process.env.ACCESS_TOKEN_EXPIRES || '15m',
  refreshTokenExpires: process.env.REFRESH_TOKEN_EXPIRES || '7d',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  // 'lax' (same-site) or 'none' (frontend + API on different domains).
  cookieSameSite: (process.env.COOKIE_SAMESITE || 'lax') as 'lax' | 'none',

  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',

  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  mailFrom: process.env.MAIL_FROM || 'Welad Halal <noreply@weladhalal.local>',

  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/v1/auth/google/callback',
  facebookClientId: process.env.FACEBOOK_CLIENT_ID || '',
  facebookClientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
  facebookCallbackUrl: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:5000/api/v1/auth/facebook/callback',
  socialEnabled: Boolean(
    (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) ||
      (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET),
  ),
};

export default env;