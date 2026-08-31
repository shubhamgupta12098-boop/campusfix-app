# Render + MongoDB Atlas + Firebase

## Render
Create a **Web Service** or use the root `render.yaml`.

Build:
`npm install --include=dev --no-audit --no-fund && npm run build`

Start:
`npm start`

Required secrets:
- `MONGODB_URI`
- `JWT_SECRET`
- `FIREBASE_API_KEY` for Forgot Password
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the first production admin

The frontend calls relative `/api` routes, so no frontend API hostname needs to be hardcoded. Render provides `RENDER_EXTERNAL_URL` to the server.

## MongoDB Atlas
Use database name `ccmms` in the URI. Store the URI in Render Environment only.

## Firebase
Enable Email/Password authentication and add the Render service hostname to Authorized Domains. Firebase is only the password-reset bridge; CCMMS normal authentication is MongoDB + JWT.
