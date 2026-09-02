import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './backend/config.mjs';
import { connectDatabase } from './backend/db.mjs';
import { authRouter } from './backend/auth.mjs';
import { dataRouter } from './backend/data.mjs';
import { mediaRouter } from './backend/media.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (config.corsOrigins.length === 0 || config.corsOrigins.includes(origin) || origin === config.appBaseUrl) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS.'));
  },
  credentials: false,
}));
app.use(express.json({ limit: '45mb' }));
app.use(express.urlencoded({ extended: true, limit: '45mb' }));

app.get('/api', (_req, res) => res.json({ ok: true, service: 'CCMMS API', version: '3.0.0', health: '/api/health', portals: ['/student/', '/admin/', '/staff/'] }));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'CCMMS API', database: 'mongodb', forgotPassword: config.firebaseApiKey ? 'firebase' : 'not-configured', time: new Date().toISOString() }));
app.use('/api/auth', authRouter);
app.use('/api/data', dataRouter);
app.use('/api/media', mediaRouter);

const PORTALS = {
  student: join(ROOT, 'student', 'dist'),
  admin: join(ROOT, 'admin', 'dist'),
  staff: join(ROOT, 'staff', 'dist'),
};

const LOGIN_PAGE = join(ROOT, 'public', 'login.html');
const LOGIN_LOGO = join(ROOT, 'public', 'cmms-logo.png');

const sendLoginPage = (_req, res) => {
  if (!existsSync(LOGIN_PAGE)) return res.status(500).send('Login page is missing.');
  return res.sendFile(LOGIN_PAGE);
};

app.get('/', sendLoginPage);
app.get('/login', sendLoginPage);
app.get('/cmms-logo.png', (_req, res) => {
  if (!existsSync(LOGIN_LOGO)) return res.status(404).end();
  return res.sendFile(LOGIN_LOGO);
});

// Serve Student/Admin/Staff directly without trailing-slash redirects.
// Express treats `/student` and `/student/` as the same route by default,
// so redirecting `/student` -> `/student/` can create an infinite loop.
for (const [name, dir] of Object.entries(PORTALS)) {
  const index = join(dir, 'index.html');

  const sendPortalIndex = (_req, res) => {
    if (!existsSync(index)) {
      return res.status(503).send('Frontend build missing. Run npm install && npm run build.');
    }
    return res.sendFile(index);
  };

  // Both /student and /student/ (same for admin/staff) render directly.
  app.get(new RegExp(`^/${name}/?$`), sendPortalIndex);

  // Static Vite assets. Disable express.static's own directory redirects.
  if (existsSync(dir)) {
    app.use(
      `/${name}`,
      express.static(dir, {
        index: false,
        redirect: false,
        maxAge: config.nodeEnv === 'production' ? '1h' : 0,
      }),
    );
  }

  // SPA fallback for nested portal routes.
  app.get(new RegExp(`^/${name}/.+`), sendPortalIndex);
}

app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  const status = Number(error?.status || (error?.code === 11000 ? 409 : 500));
  const message = error?.code === 11000 ? 'A record with this unique value already exists.' : (error?.message || 'Server error.');
  res.status(status).json({ error: config.nodeEnv === 'production' && status >= 500 ? 'Server error. Please try again.' : message });
});

await connectDatabase();
app.listen(config.port, '0.0.0.0', () => {
  console.log(`CCMMS running on port ${config.port}`);
  console.log(`Health: ${config.appBaseUrl}/api/health`);
});
