# CampusFix MongoDB Setup

Firebase has been removed. The project now uses:

- React + Vite frontend
- Node.js + Express API
- MongoDB / MongoDB Atlas
- JWT authentication
- Local `server/uploads` image storage

## 1. MongoDB Atlas

Create a free Atlas cluster, create a database user, allow your current IP, and copy the Node.js connection string.

## 2. Backend environment

```powershell
cd server
copy .env.example .env
```

Edit `server/.env`:

```env
PORT=5000
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@YOUR-CLUSTER.mongodb.net/campusfix?retryWrites=true&w=majority
JWT_SECRET=put-a-long-random-secret-here
CLIENT_URL=http://localhost:5173
ADMIN_EMAIL=admin@campusfix.local
ADMIN_PASSWORD=Admin@123
```

## 3. Frontend environment

Project-root `.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

## 4. Install and run

Terminal 1:

```powershell
cd server
npm install
npm run dev
```

Terminal 2 (project root):

```powershell
npm install
npm run dev
```

Default admin is created automatically from `ADMIN_EMAIL` and `ADMIN_PASSWORD` on first backend start.

## Production note

Local upload files are suitable for local development. For Render/Railway production, attach persistent disk storage or replace the upload endpoint with Cloudinary/S3.
