# CampusFix (CCMMS) — Render Deployment Guide

## Architecture

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Main database and authentication:** MongoDB Atlas + bcrypt + JWT
- **Forgot Password only:** Firebase Authentication email reset flow
- **Image storage:** MongoDB GridFS
- **Android:** Capacitor

Firebase does **not** replace MongoDB login, signup, sessions, profiles, complaints, or other app data. It is used only to issue and verify forgotten-password reset links. After Firebase verifies the one-time reset code, the backend stores the new bcrypt password hash in MongoDB, so normal sign-in continues to use MongoDB.

The repository contains a `render.yaml` Blueprint that creates two Render services:

| Service | Render type | Root | Purpose |
|---|---|---|---|
| `campusfix-api` | Node Web Service | `server/` | Express API + MongoDB |
| `campusfix-web` | Static Site | project root | React frontend |

## 1. MongoDB Atlas

1. Create a MongoDB Atlas cluster.
2. Create a database user under **Database Access**.
3. Under **Network Access**, allow the Render service to connect. For a simple Render setup, `0.0.0.0/0` is commonly used; use tighter network rules if your hosting setup provides fixed outbound addresses.
4. Copy the Node.js connection string, for example:

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@your-cluster.mongodb.net/campusfix?retryWrites=true&w=majority
```

If the database password contains reserved URL characters such as `@`, `:`, `/`, `?`, or `#`, URL-encode it before putting it in the connection string.

## 2. Firebase Authentication for Forgot Password

Create a Firebase project, then configure Authentication:

1. Open **Firebase Console > Authentication > Sign-in method** and enable **Email/Password**.
2. Open **Project settings > General** and copy the project's **Web API Key**. You will add it to the Render backend as `FIREBASE_WEB_API_KEY`.
3. Deploy the frontend once so you know its final Render URL, for example `https://campusfix-web.onrender.com`.
4. In **Firebase Console > Authentication > Settings > Authorized domains**, add the frontend hostname, for example `campusfix-web.onrender.com`.
5. In **Firebase Console > Authentication > Templates > Password reset**, edit the template and choose **Customize action URL**. Set it to your frontend URL, for example:

```text
https://campusfix-web.onrender.com/
```

This step is required. Firebase will append query parameters such as `mode=resetPassword` and `oobCode=...`; the React app reads that code and sends it to the CampusFix backend for verification and MongoDB password update.

Existing MongoDB users do not need to be manually imported into Firebase. On the first forgot-password request for a registered MongoDB email, the backend creates the matching Firebase recovery account automatically and then asks Firebase to send the reset email.

## 3. Render backend: `campusfix-api`

The Blueprint uses:

```text
Root directory: server
Build command: npm ci
Start command: npm start
Health check: /api/health
```

Set these environment variables in Render:

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@your-cluster.mongodb.net/campusfix?retryWrites=true&w=majority
JWT_SECRET=<long random secret; the Blueprint can generate this>
CLIENT_URL=https://YOUR-FRONTEND.onrender.com
FIREBASE_WEB_API_KEY=AIzaSy_your_firebase_web_api_key
ADMIN_EMAIL=admin@campusfix.local
ADMIN_PASSWORD=<strong admin password>
```

`CLIENT_URL` must contain the frontend origin, not the API URL. Multiple allowed frontend origins can be separated by commas.

After deployment, open:

```text
https://YOUR-API.onrender.com/api/health
```

Expected response:

```json
{"ok":true,"database":"connected"}
```

## 4. Render frontend: `campusfix-web`

The Blueprint uses:

```text
Build command: npm ci && npm run build
Publish directory: dist
```

Set:

```env
VITE_API_URL=https://YOUR-API.onrender.com/api
```

`VITE_API_URL` is a Vite build-time variable. After changing it, redeploy the static site so the new value is included in the generated JavaScript bundle.

The Blueprint includes an SPA rewrite from `/*` to `/index.html`, which is required so Firebase's password-reset action URL can open the React app with query parameters.

## 5. Test the password reset flow

1. Register/sign in with a normal CampusFix account. The account remains MongoDB-backed.
2. Sign out and click **Forgot password?**.
3. Enter the registered email address.
4. Firebase sends the password reset email.
5. Open the email link. It should open your Render frontend and show the CampusFix **Set new password** screen.
6. Enter a new password. The backend verifies the Firebase `oobCode`, confirms it with Firebase, and saves the new bcrypt password hash in MongoDB.
7. Return to sign-in and sign in normally. This login is checked against MongoDB, not Firebase.

If the email opens Firebase's default reset page instead of the CampusFix page, the Firebase **Customize action URL** setting is missing or points to the wrong frontend URL.

## 6. Dark-mode logo

The project now contains:

- `public/cmms-logo.jpeg` — light-mode logo
- `public/cmms-logo-dark.png` — dark-background logo

The shared `BrandLogo` component automatically switches assets when `html.dark` is enabled, so the logo no longer keeps a white square background in dark mode.

## 7. Local development

Backend:

```bash
cd server
cp .env.example .env
# Fill MONGODB_URI, JWT_SECRET and FIREBASE_WEB_API_KEY
npm ci
npm run dev
```

Frontend, in another terminal:

```bash
cp .env.example .env
npm ci
npm run dev
```

For local Firebase reset-link testing, add `localhost` to Firebase Authorized domains and temporarily set the Password reset **Customize action URL** to your local frontend URL such as `http://localhost:5173/`. Change it back to the Render URL before production testing.

## 8. Android / Capacitor

```bash
npm ci
npx cap sync android
```

Then open `android/` in Android Studio. The browser-based Firebase password-reset link still needs a web action-handler URL; for production mobile deep-link handling you can add a dedicated Android App Link later without changing the MongoDB authentication architecture.
