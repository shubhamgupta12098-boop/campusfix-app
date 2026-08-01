# Android app network fix

Is package mein do fixes kiye gaye hain:

1. Backend CORS ab Capacitor Android origins allow karta hai:
   - `http://localhost`
   - `https://localhost`
   - `capacitor://localhost`
   - `ionic://localhost`
2. Frontend `VITE_API_URL` mein `/api` ho ya na ho, code automatically sahi `/api` base use karega.

## Deploy

```powershell
git add .
git commit -m "Fix Android API connectivity"
git push origin main
```

Render backend ko latest commit deploy hone dein. Phir Android assets update karein:

```powershell
npm install
npm run build
npx cap sync android
npx cap open android
```

Android Studio mein app dobara Run karein.

Backend Render environment mein `CLIENT_URL` ko optionally is value par set kar sakte hain:

```text
https://campusfix-app.onrender.com,http://localhost,https://localhost,capacitor://localhost,ionic://localhost
```
