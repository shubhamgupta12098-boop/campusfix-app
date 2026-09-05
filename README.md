# CCMMS — Render + MongoDB Mobile Build

This package is the `CCMMS-icon-fixes` project converted to a production full-stack build.

## Included

- Mobile-first Student, Staff and Admin portals (max-width phone UI on desktop, responsive on real phones)
- Unified mobile login at `/`
- Login using Email / College ID / Employee ID
- Student/Staff Create Account
- Role-based redirect to `/student/`, `/staff/`, or `/admin/`
- Node.js + Express REST API
- MongoDB Atlas for accounts, complaints, work orders, notifications, reports data
- MongoDB GridFS for uploaded complaint/work photos and videos (persistent on Render)
- JWT authentication + secure same-origin session cookie
- bcrypt password hashing
- Optional Firebase Authentication password-reset email flow
- Render Blueprint (`render.yaml`) with auto deploy on GitHub commit
- `/api/health` health check

## Local test (uses MongoDB Atlas)

1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Put your real `MONGODB_URI` in `.env`.
4. Optional: add `FIREBASE_API_KEY` for Forgot Password.
5. Run:

```bash
npm install
npm run build
npm start
```

Open `http://localhost:3000`.

## MongoDB Atlas

Create a database user and get the **Drivers** connection string. Set:

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/ccmms?retryWrites=true&w=majority&appName=CCMMS
MONGODB_DB=ccmms
```

If the password contains `@`, `#`, `/`, `:` or other reserved URL characters, URL-encode it.

For first testing, Atlas Network Access can temporarily allow `0.0.0.0/0`; restrict it later where possible.

## Admin account

Set these environment variables before first start:

```env
ADMIN_EMAIL=your-admin@example.com
ADMIN_PASSWORD=YourStrongPassword123!
ADMIN_NAME=CCMMS Admin
```

The backend creates the first Admin in MongoDB if it does not already exist. Admin self-signup is disabled by default.

## Firebase Forgot Password (optional)

1. Firebase Console → Authentication → Sign-in method → enable **Email/Password**.
2. Project Settings → Web API Key.
3. Set `FIREBASE_API_KEY` in `.env` / Render.

When a user clicks Forgot Password, Firebase sends a reset email. After the user chooses a new Firebase password, the next successful login syncs that password back into the MongoDB bcrypt credential.

## Render deployment

Push the project root to GitHub. In Render either create a Blueprint from `render.yaml`, or create a Node Web Service manually.

Required Render environment values:

- `MONGODB_URI`
- `MONGODB_DB=ccmms`
- `JWT_SECRET` (Render Blueprint generates this automatically)
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_NAME`
- `FIREBASE_API_KEY` (only if Forgot Password email is required)

Build command:

```text
npm install --include=dev --no-audit --no-fund && npm run build
```

Start command:

```text
npm start
```

Health check:

```text
/api/health
```

`render.yaml` uses `autoDeployTrigger: commit`, so after the service is linked to the GitHub branch, new commits can trigger deployment automatically.

## API overview

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/signup`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/change-password`
- `POST /api/auth/change-email`
- `POST /api/auth/forgot-password`
- `GET /api/data/:store`
- `GET /api/data/:store/:id`
- `PUT /api/data/:store/:id`
- `POST /api/data/:store/bulk`
- `POST /api/data/:store/delete-many`
- `POST /api/media`
- `POST /api/media/data-url`
- `GET /api/media/:id`

The frontend now uses these APIs. Browser IndexedDB/local JSON is no longer the production data source.

## Android APK

A native Android wrapper is included in `android/`. Open that folder in Android Studio to build an APK. The supplied CCMMS logo is used for the launcher icon and web app branding. See `android/README-APK.md`.
