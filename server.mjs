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

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'CCMMS API', database: 'mongodb', forgotPassword: config.firebaseApiKey ? 'firebase' : 'not-configured', time: new Date().toISOString() }));
app.use('/api/auth', authRouter);
app.use('/api/data', dataRouter);
app.use('/api/media', mediaRouter);

const PORTALS = {
  student: join(ROOT, 'student', 'dist'),
  admin: join(ROOT, 'admin', 'dist'),
  staff: join(ROOT, 'staff', 'dist'),
};

const landing = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>CCMMS</title><style>
*{box-sizing:border-box}html{background:#03110e}body{margin:0;min-height:100vh;font-family:Inter,system-ui,-apple-system,Segoe UI,Arial;background:radial-gradient(circle at 50% -10%,#124839 0,#08251e 38%,#03110e 78%);color:#f4fff9;padding:18px}.phone{width:min(430px,100%);margin:0 auto;min-height:calc(100vh - 36px);display:flex;flex-direction:column}.brand{padding:24px 8px 18px}.eyebrow{font-size:11px;letter-spacing:1.7px;text-transform:uppercase;color:#42d99a;font-weight:800}.brand h1{font-size:34px;line-height:1.05;margin:8px 0}.brand p{margin:0;color:#9ab9aa;font-size:13px;line-height:1.55}.grid{display:grid;gap:13px}.card{display:block;text-decoration:none;color:inherit;border:1px solid #1e5140;border-radius:20px;background:linear-gradient(145deg,#0d2b22,#071b16);padding:18px;box-shadow:0 16px 36px #0005}.top{display:flex;align-items:center;justify-content:space-between}.icon{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:#0c4232;color:#53e4aa;font-size:21px}.go{font-size:21px;color:#56e5ad}.card h2{margin:14px 0 5px;font-size:20px}.card p{margin:0;color:#94b5a6;font-size:12px;line-height:1.55}.cred{margin-top:12px;padding-top:12px;border-top:1px solid #1b4638;color:#cae4d8;font-size:11px;line-height:1.65}.footer{margin-top:auto;padding:20px 8px 8px;color:#709685;font-size:11px;text-align:center}</style></head><body><main class="phone"><section class="brand"><div class="eyebrow">MongoDB API + Firebase reset</div><h1>CCMMS</h1><p>Student, Admin aur Staff — one production-ready full-stack service.</p></section><section class="grid">
<a class="card" href="/student/"><div class="top"><span class="icon">🎓</span><span class="go">›</span></div><h2>Student</h2><p>Raise and track complaints, evidence and ratings.</p><div class="cred">student@campusfix.local · Student@123</div></a>
<a class="card" href="/admin/"><div class="top"><span class="icon">🛡️</span><span class="go">›</span></div><h2>Admin</h2><p>Verify, assign staff, approvals, reports and users.</p><div class="cred">admin@campusfix.local · Admin@123</div></a>
<a class="card" href="/staff/"><div class="top"><span class="icon">🔧</span><span class="go">›</span></div><h2>Staff</h2><p>Assigned jobs, alerts, before/after work evidence.</p><div class="cred">staff@campusfix.local · Staff@123</div></a>
</section><div class="footer">API: /api · Health: /api/health</div></main></body></html>`;

app.get('/', (_req, res) => res.type('html').send(landing));
for (const [name, dir] of Object.entries(PORTALS)) {
  app.get(`/${name}`, (_req, res) => res.redirect(`/${name}/`));
  if (existsSync(dir)) app.use(`/${name}`, express.static(dir, { maxAge: config.nodeEnv === 'production' ? '1h' : 0 }));
  app.get(`/${name}/*`, (_req, res) => {
    const index = join(dir, 'index.html');
    if (!existsSync(index)) return res.status(503).send('Frontend build missing. Run npm install && npm run build.');
    res.sendFile(index);
  });
}

app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  const status = Number(error?.status || (error?.code === 11000 ? 409 : 500));
  const message = error?.code === 11000 ? 'A record with this unique value already exists.' : (error?.message || 'Server error.');
  res.status(status).json({ error: config.nodeEnv === 'production' && status >= 500 ? 'Server error. Please try again.' : message });
});

try {
  await connectDatabase();
} catch (error) {
  console.error('\n❌ Could not connect to MongoDB.');
  console.error('   1) Check that the MONGODB_URI environment variable is set and correct.');
  console.error('   2) In MongoDB Atlas, go to Network Access and allow access from anywhere (0.0.0.0/0), or add Render\'s IPs.');
  console.error('   3) Confirm the database user\'s username/password in the connection string are correct and URL-encoded.');
  console.error(`   Underlying error: ${error?.message || error}\n`);
  process.exit(1);
}
app.listen(config.port, '0.0.0.0', () => {
  console.log(`CCMMS running on port ${config.port}`);
  console.log(`Health: ${config.appBaseUrl}/api/health`);
});
