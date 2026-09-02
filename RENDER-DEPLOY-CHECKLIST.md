# Render deployment checklist

1. Push this project to GitHub.
2. Render → New → Blueprint → select the repository, or create a Node Web Service.
3. Add `MONGODB_URI`, `FIREBASE_API_KEY`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
4. Let Render generate `JWT_SECRET` from `render.yaml`.
5. Deploy.
6. Open `/api/health`; it must return `ok: true`.
7. Open `/admin/` and sign in using `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
8. Add the Render hostname to Firebase Authorized Domains.
9. Confirm Student → Admin → Staff workflow and photo/video uploads.

Do not create a Static Site and do not set a Publish Directory. Express serves all three built portals.
