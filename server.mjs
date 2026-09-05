import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './backend/config.mjs';
import { connectDatabase, disconnectDatabase } from './backend/db.mjs';
import { authRouter } from './backend/auth.mjs';
import { dataRouter } from './backend/data.mjs';
import { mediaRouter } from './backend/media.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = join(ROOT, 'public');
const LOGIN_PAGE = join(PUBLIC_DIR, 'login.html');
const RESET_PAGE = join(PUBLIC_DIR, 'reset-password.html');
const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

const normalizedAllowedOrigins = new Set(
  [config.appBaseUrl, ...config.corsOrigins]
    .filter(Boolean)
    .map((value) => String(value).replace(/\/$/, '')),
);

app.use(cors({
  origin(origin, callback) {
    // Native Android WebView requests and same-origin browser requests may not send Origin.
    if (!origin) return callback(null, true);
    const normalizedOrigin = String(origin).replace(/\/$/, '');
    const allowAllConfigured = config.corsOrigins.length === 0;
    if (allowAllConfigured || normalizedAllowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }
    const error = new Error('Origin not allowed by CORS.');
    error.status = 403;
    return callback(error);
  },
  credentials: true,
}));

app.use(express.json({ limit: '45mb' }));
app.use(express.urlencoded({ extended: true, limit: '45mb' }));

app.get('/api', (_req, res) => {
  res.json({
    ok: true,
    service: 'CCMMS API',
    version: '4.0.0',
    database: 'mongodb',
    portals: ['/student/', '/admin/', '/staff/'],
  });
});

app.get('/api/health', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    ok: true,
    service: 'CCMMS API',
    database: 'mongodb',
    forgotPassword: config.firebaseApiKey && config.smtpUser ? 'firebase+smtp-fallback' : config.firebaseApiKey ? 'firebase' : config.smtpUser ? 'smtp' : 'not-configured',
    uptimeSeconds: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRouter);
app.use('/api/data', dataRouter);
app.use('/api/media', mediaRouter);

app.use('/public', express.static(PUBLIC_DIR, {
  maxAge: config.nodeEnv === 'production' ? '1h' : 0,
  fallthrough: true,
}));

app.get('/cmms-logo.png', (_req, res, next) => {
  const logo = join(PUBLIC_DIR, 'cmms-logo.png');
  if (!existsSync(logo)) return next();
  return res.sendFile(logo);
});

app.get('/manifest.webmanifest', (_req, res, next) => {
  const manifest = join(PUBLIC_DIR, 'manifest.webmanifest');
  if (!existsSync(manifest)) return next();
  return res.sendFile(manifest);
});

const sendLogin = (_req, res) => {
  if (!existsSync(LOGIN_PAGE)) {
    return res.status(503).send('Login page missing. Rebuild or restore public/login.html.');
  }
  res.set('Cache-Control', 'no-store, max-age=0');
  return res.sendFile(LOGIN_PAGE);
};

app.get('/', sendLogin);
app.get('/login', sendLogin);
app.get('/reset-password', (_req, res) => {
  if (!existsSync(RESET_PAGE)) return res.status(503).send('Reset page missing.');
  res.set('Cache-Control', 'no-store, max-age=0');
  return res.sendFile(RESET_PAGE);
});

const portals = {
  student: join(ROOT, 'student', 'dist'),
  admin: join(ROOT, 'admin', 'dist'),
  staff: join(ROOT, 'staff', 'dist'),
};

for (const [name, dir] of Object.entries(portals)) {
  const index = join(dir, 'index.html');

  const sendPortal = (_req, res) => {
    if (!existsSync(index)) {
      return res.status(503).send('Frontend build missing. Run npm install && npm run build.');
    }
    res.set('Cache-Control', 'no-store, max-age=0');
    return res.sendFile(index);
  };

  app.get(new RegExp(`^/${name}/?$`), sendPortal);

  if (existsSync(dir)) {
    app.use(`/${name}`, express.static(dir, {
      index: false,
      redirect: false,
      maxAge: config.nodeEnv === 'production' ? '1h' : 0,
      fallthrough: true,
    }));
  }

  // SPA fallback only for browser navigation, not for missing JS/CSS/image assets.
  app.get(new RegExp(`^/${name}/.+`), (req, res, next) => {
    if (!req.accepts('html')) return next();
    return sendPortal(req, res);
  });
}

app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use((_req, res) => res.status(404).send('Not found.'));

app.use((error, _req, res, _next) => {
  console.error('[CCMMS]', error);
  const status = Number(error?.status || error?.statusCode || (error?.code === 11000 ? 409 : 500));
  const message = error?.code === 11000
    ? 'A record with this unique value already exists.'
    : (error?.message || 'Server error.');

  const safeMessage = config.nodeEnv === 'production' && status >= 500
    ? 'Server error. Please try again.'
    : message;

  res.status(status).json({ error: safeMessage });
});

let httpServer = null;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[CCMMS] ${signal} received. Shutting down...`);

  const forceTimer = setTimeout(() => {
    console.error('[CCMMS] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
  forceTimer.unref();

  try {
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
    await disconnectDatabase();
    clearTimeout(forceTimer);
    process.exit(0);
  } catch (error) {
    console.error('[CCMMS] Shutdown failed:', error);
    process.exit(1);
  }
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

async function start() {
  try {
    await connectDatabase();
    httpServer = app.listen(config.port, '0.0.0.0', () => {
      console.log(`CCMMS ready: ${config.appBaseUrl} (port ${config.port})`);
    });

    httpServer.on('error', (error) => {
      console.error('[CCMMS] HTTP server error:', error);
      process.exitCode = 1;
    });
  } catch (error) {
    console.error('[CCMMS] Startup failed:', error);
    try {
      await disconnectDatabase();
    } catch {
      // Ignore cleanup errors after a failed startup.
    }
    process.exit(1);
  }
}

await start();
