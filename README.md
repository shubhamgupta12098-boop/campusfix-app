# CampusFix Full-Stack

This package keeps the existing CampusFix light UI and connects it to an Express API, MongoDB Atlas and Firebase password-reset email.

## Included

- React + Vite frontend with the existing design
- Student and staff signup; admin accounts are created from server configuration
- MongoDB-backed profiles, complaints, work orders, notifications and reports
- JWT login sessions
- Firebase password-reset email flow
- Photo and video evidence stored in MongoDB GridFS
- Admin verification before staff assignment

The login page no longer displays the local Student, Staff or Admin quick-account buttons. Public signup follows the original second-project flow and offers Student and Staff roles; Admin is never offered on public signup.

## Run locally

Requirements: Node.js 18 or newer and a MongoDB database.

1. Copy `.env.example` to `.env`.
2. Copy `server/.env.example` to `server/.env` and fill in the values.
3. Install both frontend and backend dependencies:

   ```bash
   npm run install:all
   ```

4. Start the API in one terminal:

   ```bash
   npm run server
   ```

5. Start the frontend in another terminal:

   ```bash
   npm run dev
   ```

The frontend opens at `http://localhost:5173` and uses `http://localhost:5000/api` by default.

## Required backend settings

Set these in `server/.env`:

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/campusfix?retryWrites=true&w=majority
CLIENT_URL=http://localhost:5173
JWT_SECRET=replace_with_a_long_random_secret
FIREBASE_WEB_API_KEY=your_firebase_web_api_key
RESET_PASSWORD_URL=http://localhost:5173
ADMIN_EMAIL=admin@your-campus.edu
ADMIN_PASSWORD=use_a_strong_password
```

`ADMIN_EMAIL` and `ADMIN_PASSWORD` seed the first admin account only when it does not already exist. Students and staff can create accounts from the signup form.

## Firebase setup

1. Create or open a Firebase project.
2. In Authentication, enable Email/Password.
3. Copy the Web API key into `FIREBASE_WEB_API_KEY` on the backend.
4. Add the frontend hostname under Authentication authorized domains.
5. Configure the password-reset template/action URL to point to the frontend URL in `RESET_PASSWORD_URL`.

Firebase is used only to deliver and verify password-reset links. MongoDB remains the source of truth for accounts and application data.

## Render deployment

`render.yaml` defines both services:

- `campusfix-api`: Node/Express service from `server/`
- `campusfix-web`: Vite static frontend from the project root

Set `MONGODB_URI`, `CLIENT_URL`, `FIREBASE_WEB_API_KEY`, `RESET_PASSWORD_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and frontend `VITE_API_URL` in Render. Use the API service URL for `VITE_API_URL`, for example `https://your-api.onrender.com/api`.

After deployment, check `https://your-api.onrender.com/api/health`. It should return a connected database status.

## Android

The source is updated, but Capacitor's bundled web assets must be regenerated:

```bash
npm run build
npx cap sync android
```

Then open `android/` in Android Studio and build the APK or App Bundle.
