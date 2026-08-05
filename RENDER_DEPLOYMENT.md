# CampusFix Render deployment

Deploy the repository using `render.yaml`. The frontend and API run from one Render Web Service, which avoids CORS and incorrect `VITE_API_URL` problems.

Required environment variables:

- `MONGODB_URI`: MongoDB Atlas connection string.
- `CLIENT_URL`: Public Render URL, for example `https://campusfix-api.onrender.com`.
- `SMTP_USER`: Gmail address used to send password reset emails.
- `SMTP_PASS`: A Google App Password, not the normal Gmail password. Remove spaces before saving it.
- `MAIL_FROM`: Optional sender, for example `CampusFix CCMMS <your-address@gmail.com>`.

In Google Account security, enable 2-Step Verification and create an App Password for Mail. After changing environment variables, deploy again and test `/api/health`.

For an Android build, set `VITE_API_URL=https://campusfix-api.onrender.com` before running the Vite build and Capacitor sync.
