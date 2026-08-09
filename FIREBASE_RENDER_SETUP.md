# Firebase Auth + MongoDB + Render setup

CampusFix now uses Firebase Authentication only for email/password sign-in, sign-up, password reset, email change and password change. Profiles, complaints, uploads and all other application data remain in MongoDB.

## 1. Firebase Console

1. Create/open a Firebase project.
2. Go to **Authentication > Sign-in method** and enable **Email/Password**.
3. Go to **Project settings > General > Your apps**, add a Web app, and copy the web configuration.
4. Under **Authentication > Settings > Authorized domains**, add your Render frontend hostname, for example `campusfix-app.onrender.com`.

## 2. Render frontend environment variables

Set these on the frontend/static-site service, then redeploy:

- `VITE_API_URL=https://YOUR-BACKEND.onrender.com`
- `VITE_FIREBASE_API_KEY=...`
- `VITE_FIREBASE_AUTH_DOMAIN=YOUR-PROJECT.firebaseapp.com`
- `VITE_FIREBASE_PROJECT_ID=...`
- `VITE_FIREBASE_STORAGE_BUCKET=...`
- `VITE_FIREBASE_MESSAGING_SENDER_ID=...`
- `VITE_FIREBASE_APP_ID=...`

## 3. Render backend environment variables

Set these on the web service, then redeploy:

- `MONGODB_URI=...`
- `CLIENT_URL=https://YOUR-FRONTEND.onrender.com`
- `FIREBASE_WEB_API_KEY=` the same Firebase Web API key used by the frontend
- `ADMIN_EMAIL=` optional admin email
- `ADMIN_PASSWORD=` optional initial admin password

SMTP, Resend, `JWT_SECRET`, `SMTP_*`, `RESEND_*` and `MAIL_FROM` are no longer needed for authentication emails.

## 4. Existing MongoDB users

Existing MongoDB profiles can be linked automatically by email. Create the same email in Firebase Authentication (or let the user sign up with that email when appropriate), then sign in. New accounts are created in Firebase first and their profile is stored in MongoDB.

## 5. Build and deploy

```bash
npm install
npm run build
npm --prefix server install
npm run typecheck

git add .
git commit -m "Use Firebase Auth with MongoDB data"
git push origin main
```
