import 'dotenv/config';

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const nodeEnv = process.env.NODE_ENV || 'development';
const port = Number(process.env.PORT || 3000);
const renderUrl = String(process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/$/, '');
const configuredBaseUrl = String(process.env.APP_BASE_URL || '').trim().replace(/\/$/, '');

export const config = {
  nodeEnv,
  port,
  mongoUri: String(process.env.MONGODB_URI || '').trim(),
  mongoDbName: String(process.env.MONGODB_DB || 'ccmms').trim() || 'ccmms',
  jwtSecret: String(process.env.JWT_SECRET || 'dev-only-change-this-jwt-secret-before-production'),
  // 'never' keeps the device signed in until the user explicitly logs out.
  jwtExpiresIn: String(process.env.JWT_EXPIRES_IN || 'never').trim().toLowerCase(),
  firebaseApiKey: String(process.env.FIREBASE_API_KEY || '').trim(),
  appBaseUrl: configuredBaseUrl || renderUrl || `http://localhost:${port}`,
  corsOrigins: String(process.env.CORS_ORIGINS || '')
    .split(',').map((value) => value.trim()).filter(Boolean),
  seedDemoUsers: bool(process.env.SEED_DEMO_USERS, false),
  allowAdminSignup: bool(process.env.ALLOW_ADMIN_SIGNUP, false),
  bootstrapAdminEmail: String(process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  bootstrapAdminPassword: String(process.env.ADMIN_PASSWORD || ''),
  bootstrapAdminName: String(process.env.ADMIN_NAME || 'CCMMS Admin').trim(),
};

if (!config.mongoUri) throw new Error('MONGODB_URI is required. Add it to .env locally or Render Environment.');
if (config.nodeEnv === 'production' && config.jwtSecret.startsWith('dev-only-')) {
  throw new Error('JWT_SECRET must be configured in production.');
}
