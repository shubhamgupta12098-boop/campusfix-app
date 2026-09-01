import 'dotenv/config';

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  mongoUri: String(process.env.MONGODB_URI || '').trim(),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-this-jwt-secret-before-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  firebaseApiKey: String(process.env.FIREBASE_API_KEY || '').trim(),
  appBaseUrl: String(process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/$/, ''),
  corsOrigins: String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  seedDemoUsers: bool(process.env.SEED_DEMO_USERS, false),
  allowAdminSignup: bool(process.env.ALLOW_ADMIN_SIGNUP, false),
  bootstrapAdminEmail: String(process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  bootstrapAdminPassword: String(process.env.ADMIN_PASSWORD || ''),
  bootstrapAdminName: String(process.env.ADMIN_NAME || 'CCMMS Admin').trim(),
};

if (config.nodeEnv === 'production' && config.jwtSecret.startsWith('dev-only-')) {
  throw new Error('JWT_SECRET must be configured in production.');
}

if (!config.mongoUri) {
  throw new Error('MONGODB_URI is required. Configure it in Render Environment.');
}
