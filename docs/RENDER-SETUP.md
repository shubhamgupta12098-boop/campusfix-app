# Render Setup

1. Push this folder to a GitHub repository.
2. Render Dashboard → New → Blueprint → select the repository (recommended), or New Web Service.
3. Add `MONGODB_URI`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optional `FIREBASE_API_KEY`.
4. Deploy.
5. Check `/api/health`.

MongoDB Atlas must permit connections from Render. For initial testing, Atlas Network Access `0.0.0.0/0` is the simplest option; tighten access later.

If using manual Web Service instead of Blueprint:
- Runtime: Node
- Build: `npm install --include=dev --no-audit --no-fund && npm run build`
- Start: `npm start`
- Health: `/api/health`
