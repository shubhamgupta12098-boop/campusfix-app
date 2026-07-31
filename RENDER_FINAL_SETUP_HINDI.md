# Render Final Setup

## Backend Web Service
- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `npm start`

Environment:
- `MONGODB_URI` = MongoDB Atlas connection string
- `JWT_SECRET` = long random secret
- `CLIENT_URL` = frontend URL, e.g. `https://campusfix-app.onrender.com`
- SMTP variables as required

MongoDB Atlas > Network Access > IP Access List me `0.0.0.0/0` add karein.

## Frontend Static Site
- Build Command: `npm install --include=dev && npm run build`
- Publish Directory: `dist`
- `VITE_API_URL` = backend base URL, e.g. `https://campusfix-app-x04t.onrender.com`

`/api` manually lagana zaroori nahi hai; code automatically add karta hai.

Backend URL open karne par ab JSON health response dikhega, `Cannot GET /` nahi.
