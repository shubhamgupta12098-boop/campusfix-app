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
const app = express(); app.set('trust proxy', 1); app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = config.corsOrigins.length === 0 || config.corsOrigins.includes(origin) || origin === config.appBaseUrl;
    return allowed ? callback(null, true) : callback(new Error('Origin not allowed by CORS.'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '45mb' }));
app.use(express.urlencoded({ extended: true, limit: '45mb' }));

app.get('/api', (_req, res) => res.json({ ok: true, service: 'CCMMS API', version: '4.0.0', database: 'mongodb', portals: ['/student/', '/admin/', '/staff/'] }));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'CCMMS API', database: 'mongodb', forgotPassword: config.firebaseApiKey ? 'firebase' : 'not-configured', time: new Date().toISOString() }));
app.use('/api/auth', authRouter); app.use('/api/data', dataRouter); app.use('/api/media', mediaRouter);

const PUBLIC_DIR = join(ROOT, 'public');
const LOGIN_PAGE = join(PUBLIC_DIR, 'login.html');
app.use('/public', express.static(PUBLIC_DIR, { maxAge: config.nodeEnv === 'production' ? '1h' : 0 }));
app.get('/cmms-logo.png', (_req, res) => res.sendFile(join(PUBLIC_DIR, 'cmms-logo.png')));
app.get('/manifest.webmanifest', (_req, res) => res.sendFile(join(PUBLIC_DIR, 'manifest.webmanifest')));
const sendLogin = (_req, res) => { res.set('Cache-Control', 'no-store, max-age=0'); res.sendFile(LOGIN_PAGE); };
app.get('/', sendLogin); app.get('/login', sendLogin);

const portals = { student: join(ROOT, 'student', 'dist'), admin: join(ROOT, 'admin', 'dist'), staff: join(ROOT, 'staff', 'dist') };
for (const [name, dir] of Object.entries(portals)) {
  const index = join(dir, 'index.html');
  const sendPortal = (_req, res) => {
    if (!existsSync(index)) return res.status(503).send('Frontend build missing. Run npm install && npm run build.');
    res.set('Cache-Control', 'no-store, max-age=0'); res.sendFile(index);
  };
  app.get(new RegExp(`^/${name}/?$`), sendPortal);
  if (existsSync(dir)) app.use(`/${name}`, express.static(dir, { index: false, redirect: false, maxAge: config.nodeEnv === 'production' ? '1h' : 0 }));
  app.get(new RegExp(`^/${name}/.+`), sendPortal);
}
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  const status = Number(error?.status || (error?.code === 11000 ? 409 : 500));
  const message = error?.code === 11000 ? 'A record with this unique value already exists.' : (error?.message || 'Server error.');
  res.status(status).json({ error: config.nodeEnv === 'production' && status >= 500 ? 'Server error. Please try again.' : message });
});

await connectDatabase();
app.listen(config.port, '0.0.0.0', () => console.log(`CCMMS ready: ${config.appBaseUrl} (port ${config.port})`));
