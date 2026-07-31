# CampusFix MongoDB — Start Here

## 1. Atlas se exact URI copy karein
MongoDB Atlas me **Connect → Drivers → Node.js** kholkar connection string copy karein.

## 2. Automatic setup
Project root terminal me:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-mongodb.ps1
```

Script poori Atlas URI maangegi. URI me `<db_password>` ho to password securely poocha jayega.

## 3. Install aur run

```powershell
npm run install:all
npm run server
```

Naye terminal me:

```powershell
npm run dev
```

Backend success output:

```text
MongoDB connected
CampusFix API running on http://localhost:5000
```

## DNS error ka automatic fix
Server ab pehle IPv4 use karta hai aur `querySrv ECONNREFUSED` aane par Google/Cloudflare DNS se automatically retry karta hai.

Password screenshot/chat me share na karein. Purana exposed password Atlas me reset karein.
