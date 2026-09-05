# Render Setup

1. Push this folder to a GitHub repository.
2. Render Dashboard → New → Blueprint → select the repository (recommended), or New Web Service.
3. Add `MONGODB_URI`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. The supplied Firebase Web API key is already wired for Forgot Password; `FIREBASE_API_KEY` can still override it.
4. Deploy.
5. Check `/api/health`.

MongoDB Atlas must permit connections from Render. For initial testing, Atlas Network Access `0.0.0.0/0` is the simplest option; tighten access later.

If using manual Web Service instead of Blueprint:
- Runtime: Node
- Build: `npm install --include=dev --no-audit --no-fund && npm run build`
- Start: `npm start`
- Health: `/api/health`

## Password reset email troubleshooting

CCMMS now tries Firebase first and can fall back to SMTP.

### Firebase
1. Firebase Console -> Authentication -> Sign-in method -> enable **Email/Password**.
2. Firebase Project settings -> General -> confirm the **Web API Key** matches this project. CCMMS already includes the supplied key in `render.yaml`; override `FIREBASE_API_KEY` only when changing Firebase projects.
4. In Authentication -> Templates -> Password reset, set the sender name to **CCMMS** and customize the subject/body. Firebase/recipient providers control spam placement, so code cannot guarantee Inbox delivery.

Use this only with a dedicated sender account. Turn on 2-Step Verification and create a Google **App Password**. Add these Render variables:


Do not use your normal Gmail password. After changing environment variables, redeploy the service.
