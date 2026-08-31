# Render + MongoDB Atlas + Firebase setup

## MongoDB Atlas

Create a cluster and copy its URI to Render as `MONGODB_URI`. Use database name `ccmms` in the URI.

## Firebase

Only Authentication password-reset email is used.

- Enable Email/Password provider.
- Copy Web API Key to `FIREBASE_API_KEY`.
- Add localhost and your Render hostname under Authorized domains.

## Render

Deploy as a Blueprint with the included `render.yaml`.

Required values:

- MONGODB_URI
- FIREBASE_API_KEY
- APP_BASE_URL

Optional:

- CORS_ORIGINS (blank is fine for same-origin production)
- SEED_DEMO_USERS=true
- ALLOW_ADMIN_SIGNUP=false

After deployment, verify:

1. `/api/health` returns `ok: true`.
2. Student/Admin/Staff login works.
3. Register a test user with a real email.
4. Forgot Password sends a Firebase email.
5. Reset password and sign in with the new password.
6. Raise a complaint with Photo *; backend should reject a complaint with no photo.
7. Staff uploads Before and After photos; Admin Complaint Details should show both.
