# CampusFix (CCMMS) — Deployment Guide

Stack: React + Vite frontend, Node.js/Express API, MongoDB Atlas, JWT auth,
image uploads stored in MongoDB GridFS, Capacitor Android app.

This app deploys as **two separate Render services**:

| Service | Type | Folder | Purpose |
|---|---|---|---|
| `campusfix-api` | Web Service (Node) | `server/` | Express API + MongoDB |
| `campusfix-web` | Static Site | project root | React frontend |

`render.yaml` at the project root already defines both. In Render, use
**New > Blueprint** and point it at this repo to create both services at once,
or create them manually with the settings below.

---

## 1. MongoDB Atlas

1. Create a free cluster at https://cloud.mongodb.com.
2. **Database Access** → add a database user with a password (avoid `@ : /`
   characters in the password — they break the connection string).
3. **Network Access** → add `0.0.0.0/0` (Render's outbound IPs are not fixed,
   so this is required, not just convenient).
4. **Connect → Drivers → Node.js** → copy the connection string. It looks like:
   ```
   mongodb+srv://USERNAME:PASSWORD@your-cluster.mongodb.net/campusfix?retryWrites=true&w=majority
   ```

## 2. Backend service (`campusfix-api`)

Root directory: `server`. Build command: `npm install`. Start command: `npm start`.

Set these environment variables in the Render dashboard (Environment tab):

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@your-cluster.mongodb.net/campusfix?retryWrites=true&w=majority
JWT_SECRET=<let Render auto-generate this>
CLIENT_URL=https://campusfix-web.onrender.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail-address@gmail.com
SMTP_PASS=your-16-character-gmail-app-password
MAIL_FROM=CampusFix CCMMS <your-gmail-address@gmail.com>
APP_NAME=CampusFix CCMMS
ADMIN_EMAIL=admin@campusfix.local
ADMIN_PASSWORD=<set a real password>
```

Notes:
- `CLIENT_URL` must be your **frontend's** URL (the static site), not the API's own URL.
  If you have more than one frontend URL (custom domain + the onrender.com one),
  separate them with commas.
- `render.yaml` marks `MONGODB_URI`, `CLIENT_URL`, `SMTP_USER`, `SMTP_PASS` and
  `MAIL_FROM` as `sync: false` — Render does **not** fill these in automatically.
  You must type them into the dashboard yourself, or the API will fail to start
  (bad `MONGODB_URI`) or password-reset emails will never send (missing SMTP vars).

### Create a Gmail App Password (for SMTP_PASS)
1. Turn on 2-Step Verification for the Gmail account you're sending from.
2. Google Account → Security → App passwords → create one for "CampusFix".
3. Copy the 16-character code into `SMTP_PASS` with no spaces. Do not use your
   normal Gmail password — Gmail will reject it (that's the `535`/`BadCredentials`
   error you'd see in the server logs).

### Verify the backend is actually running
Open `https://campusfix-api.onrender.com/api/health` in a browser. You should see:
```json
{"ok":true,"database":"connected"}
```
- `database: "disconnected"` → check `MONGODB_URI` and Atlas Network Access.
- Page won't load at all → the service either isn't deployed, crashed on boot
  (check the Render logs — it will print a clear English error now), or is a
  free-tier service that spun down after 15 minutes idle. A sleeping free-tier
  service can take 30–50 seconds to wake up on its first request; that first
  request may show as "could not reach the server" if it times out before
  waking — try again after a few seconds.

## 3. Frontend service (`campusfix-web`)

Root directory: project root. Build command: `npm install && npm run build`.
Publish directory: `dist`.

Set this environment variable:
```env
VITE_API_URL=https://campusfix-api.onrender.com/api
```

**This is a build-time variable (Vite bakes it into the JS bundle).** Changing
it in the dashboard does nothing until you trigger a new deploy — use
**Manual Deploy → Clear build cache & deploy** after setting or changing it.
This is the single most common cause of the
`Could not reach the server at https://.../api` error: the frontend was built
with the wrong (or a since-changed/deleted) backend URL baked in.

## 4. After both are deployed

1. Hard-refresh the frontend (Ctrl+Shift+R) to clear any cached old JS bundle.
2. Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` (created automatically on the
   backend's first successful start).
3. Test password reset: Sign-in screen → "Forgot password?" → enter a
   registered email → check inbox and Spam/Junk.
4. Raise a test complaint with a photo and confirm it displays after a refresh.

### About old broken images
Earlier versions of this backend stored uploaded photos on Render's local
disk, which is wiped every time the service restarts or redeploys. Any
complaint/work-order photo uploaded before this fix has a dead link and
**cannot be recovered** — the file is gone. New uploads go into MongoDB
GridFS (`/api/upload` → `GET /uploads/:filename`), which survives restarts
and redeploys. The UI now shows a neutral "image unavailable" placeholder
instead of a broken-image icon for any old dead links.

## 5. Android app (Capacitor)

```bash
npm install
npx cap sync android
```

Then open `android/` in Android Studio to build/run as usual. `npm install`
now also pulls in `@capacitor/filesystem` and `@capacitor/share`, used to make
the CSV export in Reports work as a native "Save/Share" sheet on Android,
since Android WebViews don't support plain `<a download>` blob links.

## Local development

Terminal 1:
```bash
cd server
cp .env.example .env   # then fill in MONGODB_URI, JWT_SECRET, etc.
npm install
npm run dev
```

Terminal 2 (project root):
```bash
echo "VITE_API_URL=http://localhost:5000/api" > .env
npm install
npm run dev
```
