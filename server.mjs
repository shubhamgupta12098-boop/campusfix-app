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

let databaseReady = false;
let databaseError = null;

app.set('trust proxy', 1);

// ---------------------------------------------
// Security
// ---------------------------------------------

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  }),
);

// ---------------------------------------------
// Logging
// ---------------------------------------------

app.use(
  morgan(
    config.nodeEnv === 'production'
      ? 'combined'
      : 'dev',
  ),
);

// ---------------------------------------------
// CORS
// ---------------------------------------------

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (
        config.corsOrigins.length === 0 ||
        config.corsOrigins.includes(origin) ||
        origin === config.appBaseUrl
      ) {
        return callback(null, true);
      }

      return callback(
        new Error(
          'Origin not allowed by CORS.',
        ),
      );
    },

    credentials: false,
  }),
);

// ---------------------------------------------
// Body parsing
// ---------------------------------------------

app.use(
  express.json({
    limit: '45mb',
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '45mb',
  }),
);

// ---------------------------------------------
// API HOME
// ---------------------------------------------

app.get('/api', (_req, res) => {
  return res.json({
    ok: true,
    service: 'CCMMS API',
    version: '3.1.0',
    databaseReady,
    health: '/api/health',
    portals: [
      '/student/',
      '/admin/',
      '/staff/',
    ],
  });
});

// ---------------------------------------------
// HEALTH CHECK
// ---------------------------------------------

app.get('/api/health', (_req, res) => {
  const ready = databaseReady;

  return res
    .status(ready ? 200 : 503)
    .json({
      ok: ready,

      service: 'CCMMS API',

      database: ready
        ? 'mongodb-connected'
        : 'mongodb-connecting',

      forgotPassword:
        config.firebaseApiKey
          ? 'firebase'
          : 'not-configured',

      environment:
        config.nodeEnv,

      error:
        !ready && databaseError
          ? config.nodeEnv === 'production'
            ? 'Database initialization failed. Check Render logs.'
            : databaseError
          : null,

      time:
        new Date().toISOString(),
    });
});

// ---------------------------------------------
// DATABASE READY CHECK
// ---------------------------------------------

app.use(
  '/api/auth',
  (_req, res, next) => {
    if (databaseReady) {
      return next();
    }

    return res
      .status(503)
      .json({
        error:
          'Database is starting. Please try again shortly.',
      });
  },
);

app.use(
  '/api/data',
  (_req, res, next) => {
    if (databaseReady) {
      return next();
    }

    return res
      .status(503)
      .json({
        error:
          'Database is starting. Please try again shortly.',
      });
  },
);

app.use(
  '/api/media',
  (_req, res, next) => {
    if (databaseReady) {
      return next();
    }

    return res
      .status(503)
      .json({
        error:
          'Database is starting. Please try again shortly.',
      });
  },
);

// ---------------------------------------------
// API ROUTES
// ---------------------------------------------

app.use(
  '/api/auth',
  authRouter,
);

app.use(
  '/api/data',
  dataRouter,
);

app.use(
  '/api/media',
  mediaRouter,
);

// ---------------------------------------------
// FRONTEND FOLDERS
// ---------------------------------------------

const PORTALS = {
  student: join(
    ROOT,
    'student',
    'dist',
  ),

  admin: join(
    ROOT,
    'admin',
    'dist',
  ),

  staff: join(
    ROOT,
    'staff',
    'dist',
  ),
};

// ---------------------------------------------
// UNIFIED LOGIN PAGE
// ---------------------------------------------

const LOGIN_PAGE = join(
  ROOT,
  'public',
  'login.html',
);

const LOGIN_LOGO = join(
  ROOT,
  'public',
  'cmms-logo.png',
);

const sendLoginPage = (_req, res) => {
  if (!existsSync(LOGIN_PAGE)) {
    return res
      .status(500)
      .send(
        'Login page is missing.',
      );
  }

  return res.sendFile(
    LOGIN_PAGE,
  );
};

// Main URL -> Login page

app.get(
  '/',
  sendLoginPage,
);

app.get(
  '/login',
  sendLoginPage,
);

// Logo

app.get(
  '/cmms-logo.png',
  (_req, res) => {
    if (!existsSync(LOGIN_LOGO)) {
      return res
        .status(404)
        .end();
    }

    return res.sendFile(
      LOGIN_LOGO,
    );
  },
);

// ---------------------------------------------
// STUDENT / ADMIN / STAFF
// ---------------------------------------------

for (
  const [name, dir]
  of Object.entries(PORTALS)
) {

  const index =
    join(
      dir,
      'index.html',
    );

  const sendPortalIndex =
    (_req, res) => {

      if (
        !existsSync(index)
      ) {
        return res
          .status(503)
          .send(
            `Frontend build missing for ${name}. Run npm run build.`,
          );
      }

      return res.sendFile(
        index,
      );
    };

  /*
   * IMPORTANT:
   *
   * /student
   * /student/
   *
   * dono direct app open karenge.
   * Redirect nahi hoga.
   *
   * Isse ERR_TOO_MANY_REDIRECTS
   * fix hota hai.
   */

  app.get(
    new RegExp(
      `^/${name}/?$`,
    ),
    sendPortalIndex,
  );

  // -------------------------------------------
  // Static Vite files
  // -------------------------------------------

  if (
    existsSync(dir)
  ) {
    app.use(
      `/${name}`,
      express.static(
        dir,
        {
          index: false,

          redirect: false,

          maxAge:
            config.nodeEnv ===
              'production'
              ? '1h'
              : 0,
        },
      ),
    );
  }

  // -------------------------------------------
  // SPA fallback
  // -------------------------------------------

  app.get(
    new RegExp(
      `^/${name}/.+`,
    ),
    sendPortalIndex,
  );
}

// ---------------------------------------------
// UNKNOWN API ROUTES
// ---------------------------------------------

app.use(
  '/api',
  (_req, res) => {
    return res
      .status(404)
      .json({
        error:
          'API route not found.',
      });
  },
);

// ---------------------------------------------
// ERROR HANDLER
// ---------------------------------------------

app.use(
  (
    error,
    _req,
    res,
    _next,
  ) => {

    console.error(
      '[Server]',
      error,
    );

    const status =
      Number(
        error?.status ||
        (
          error?.code === 11000
            ? 409
            : 500
        ),
      );

    const message =
      error?.code === 11000

        ? 'A record with this unique value already exists.'

        : (
          error?.message ||
          'Server error.'
        );

    return res
      .status(status)
      .json({
        error:
          config.nodeEnv ===
            'production' &&
          status >= 500

            ? 'Server error. Please try again.'

            : message,
      });
  },
);

// =================================================
// IMPORTANT FOR RENDER
// OPEN PORT FIRST
// =================================================

const server =
  app.listen(
    config.port,
    '0.0.0.0',
    () => {

      console.log(
        '=================================',
      );

      console.log(
        'CCMMS HTTP SERVER STARTED',
      );

      console.log(
        `Port: ${config.port}`,
      );

      console.log(
        `Environment: ${config.nodeEnv}`,
      );

      console.log(
        `Health: ${
          config.appBaseUrl ||
          `http://localhost:${config.port}`
        }/api/health`,
      );

      console.log(
        '=================================',
      );
    },
  );

// =================================================
// CONNECT MONGODB AFTER PORT IS OPEN
// =================================================

(async () => {

  try {

    console.log(
      '[MongoDB] Initializing database...',
    );

    await connectDatabase();

    databaseReady = true;

    databaseError = null;

    console.log(
      '[MongoDB] Database initialization complete.',
    );

    console.log(
      'CCMMS is ready to accept API requests.',
    );

  } catch (error) {

    databaseReady = false;

    databaseError =
      error?.message ||
      String(error);

    console.error(
      '[MongoDB] Database initialization failed:',
    );

    console.error(
      error,
    );

    /*
     * IMPORTANT:
     *
     * Server ko process.exit(1)
     * nahi kar rahe.
     *
     * Isse Render port detect
     * kar sakega aur logs available
     * rahenge.
     */
  }

})();

// ---------------------------------------------
// GRACEFUL SHUTDOWN
// ---------------------------------------------

function shutdown(signal) {

  console.log(
    `${signal} received. Shutting down CCMMS...`,
  );

  server.close(
    () => {
      process.exit(0);
    },
  );

  setTimeout(
    () => {
      process.exit(1);
    },
    10000,
  ).unref();
}

process.on(
  'SIGTERM',
  () => shutdown('SIGTERM'),
);

process.on(
  'SIGINT',
  () => shutdown('SIGINT'),
);