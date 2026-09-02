# CCMMS Full Stack — Render Ready

Student, Admin and Staff mobile portals run from one Node/Express service. All three portals use the same-origin `/api`, so there is no hardcoded development host in the frontend.

## Architecture

- React + Vite: Student, Admin, Staff
- Node.js + Express REST API
- MongoDB Atlas for application data
- MongoDB GridFS for complaint photos/videos and before/after evidence
- JWT + bcrypt for normal authentication
- Firebase Authentication REST API only for Forgot Password emails
- Render Web Service for frontend + backend together

## Required Render environment variables

Set these in Render → Service → Environment:

```env
MONGODB_URI=mongodb+srv://DB_USER:DB_PASSWORD@YOUR_CLUSTER.mongodb.net/ccmms?retryWrites=true&w=majority
JWT_SECRET=use-a-long-random-secret
FIREBASE_API_KEY=your-firebase-web-api-key
ADMIN_EMAIL=your-admin-email
ADMIN_PASSWORD=your-strong-admin-password
ADMIN_NAME=CCMMS Admin
```

`RENDER_EXTERNAL_URL` is supplied automatically by Render. You do not need to hardcode the public URL in source code. For the normal single-service deployment, `CORS_ORIGINS` can stay blank.

## Render settings

Use **Web Service**, not Static Site. If you use the included `render.yaml`, choose Render → New → Blueprint.

- Build command: `npm install --include=dev --no-audit --no-fund && npm run build`
- Start command: `npm start`
- Health check: `/api/health`

The `--include=dev` flag is important because Vite is a build dependency and must be installed even though the runtime environment is production.

## Public routes after deployment

- `/` portal chooser
- `/student/` student portal
- `/admin/` admin portal
- `/staff/` staff portal
- `/api` API information
- `/api/health` health check

## MongoDB Atlas

Create a database user, allow network access for your Render deployment, and store the Atlas URI only in Render Environment. Never commit it to GitHub.

## Firebase Forgot Password only

Enable Firebase Authentication → Email/Password, copy the Web API Key into `FIREBASE_API_KEY`, and add your Render hostname under Firebase Authorized Domains. Normal sign-in remains MongoDB + JWT.

## GitHub push

```bash
git add .
git commit -m "Make CCMMS Render production ready"
git push origin main
```

Render Auto-Deploy will rebuild the service after the push.

## Security

`.env` and credential files are ignored. Rotate any database password that has previously been posted publicly or committed to a repository.
