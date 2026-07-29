# CampusFix Firebase + Render Setup

## Firebase
1. Firebase Authentication > Sign-in method > enable **Email/Password**.
2. Firestore Database > create database.
3. Firestore > Rules: paste the contents of `firestore.rules` and publish.
4. Authentication > Settings > Authorized domains: add your Render domain, for example `campusfix.onrender.com`.

The project already contains the Firebase web configuration in `.env`.

## First-use data
After signing up, create these Firestore collections/documents from the Firebase console so complaint forms have options:

### `complaint_categories`
Create documents with auto IDs and fields:
- Electrical: `name` Electrical, `icon` zap, `color` #f59e0b, `sla_hours` 24
- Plumbing: `name` Plumbing, `icon` wrench, `color` #3b82f6, `sla_hours` 24
- Wi-Fi: `name` Wi-Fi, `icon` wifi, `color` #8b5cf6, `sla_hours` 12
- Cleaning: `name` Cleaning, `icon` sparkles, `color` #10b981, `sla_hours` 24
- Furniture: `name` Furniture, `icon` armchair, `color` #f97316, `sla_hours` 48
- Security: `name` Security, `icon` shield, `color` #ef4444, `sla_hours` 2

### `buildings`
Create at least one document with fields such as:
- `name`: Main Academic Block
- `code`: ACADEMIC
- `type`: academic
- `floors`: 4

## Run locally
```bash
npm install
npm run dev
```

## Deploy to Render
1. Upload the project to GitHub.
2. Render > New > Blueprint and select the repository. Render reads `render.yaml` automatically.
3. Or create a Static Site manually:
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
4. Add all six `VITE_FIREBASE_*` variables in Render Environment if `.env` is not committed.
5. Add the Render hostname to Firebase Authentication authorized domains.

## Android app
This is a responsive web application/PWA. After Render deployment it opens on Android and can be installed from Chrome using **Add to Home screen**. A Play Store APK/AAB requires wrapping the deployed web app with Capacitor or rebuilding it in React Native/Flutter.
