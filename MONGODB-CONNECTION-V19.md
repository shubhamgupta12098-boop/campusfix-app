# CCMMS V19 — MongoDB Connection Fixed

This build keeps the V18 Student/Admin/Staff app, but changes the MongoDB connector to the same robust pattern used by `CampusFix-Before-Photo-Fixed`.

## What changed

- Validates `MONGODB_URI` before startup.
- Forces IPv4-first DNS lookup.
- First tries the computer/Render system DNS.
- If an Atlas `mongodb+srv://` SRV lookup fails (`querySrv`, `ECONNREFUSED`, `ENOTFOUND`, `ETIMEOUT`, `EAI_AGAIN`), it automatically retries with:
  - Google DNS: `8.8.8.8`
  - Cloudflare DNS: `1.1.1.1`
- Uses `family: 4`, 15-second server/connect timeouts, and a 45-second socket timeout.
- Selects `MONGODB_DB=ccmms` explicitly, so even a URI ending in `/` still uses the `ccmms` database.
- Pings MongoDB before the API starts.
- Prints useful messages for DNS, authentication and Atlas Network Access errors.
- Adds `npm run mongo:test`.

## Local setup

Create `.env` beside `package.json` and `server.mjs`:

```env
NODE_ENV=development
MONGODB_URI=mongodb+srv://YOUR_DB_USER:YOUR_URL_ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/ccmms?retryWrites=true&w=majority&appName=CCMMS
MONGODB_DB=ccmms
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
APP_BASE_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
```

Use the **Drivers** connection string copied from MongoDB Atlas. If the password has characters such as `@`, `:`, `/`, `#`, `%`, or `?`, URL-encode the password.

Test only MongoDB:

```bash
npm install
npm run mongo:test
```

Expected:

```text
[MongoDB Test] Connecting...
[MongoDB] Connected successfully: ...
[MongoDB Test] Ping: { ok: 1 }
[MongoDB Test] SUCCESS
```

Then start the app:

```bash
npm start
```

## MongoDB Atlas

In Atlas:

1. Database Access → create/use a database user.
2. Network Access → add your current IP for local use.
3. For Render testing, `0.0.0.0/0` works but is broader than ideal; tighten it later if possible.
4. Connect → Drivers → copy the Node.js connection string.

## Render

Use a **Web Service** / Blueprint, not a Static Site.

Required environment variables:

- `MONGODB_URI`
- `MONGODB_DB=ccmms`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `FIREBASE_API_KEY` (only for Forgot Password)

Build:

```text
npm install --include=dev --no-audit --no-fund && npm run build
```

Start:

```text
npm start
```

Health:

```text
/api/health
```

## Security

Never commit `.env`, Atlas credential files, Firebase service credentials, or real passwords to GitHub.
