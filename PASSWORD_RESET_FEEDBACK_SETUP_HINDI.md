# Password Reset Email + Feedback Setup

## 1. Password reset email

`server/.env` mein SMTP values add karein:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
MAIL_FROM=CampusFix <your-email@gmail.com>
```

Gmail use karte waqt Google Account mein 2-Step Verification enable karke **App Password** banayein. Normal Gmail password use na karein.

Login screen par **Forgot password?** se email enter karne par 30 minute ka one-time link aayega. Link kholkar student/staff/admin naya password set kar sakta hai.

Development mein SMTP set nahi hai to backend terminal mein reset URL print hoga. Production mein SMTP required hai.

## 2. Student feedback aur rating

Student ko resolved/closed complaint par:
- Complaint detail mein **Rate Now** button
- 1–5 star rating
- Written feedback
- Before/after photos dekhkar rating dene ka option

Sidebar mein **Feedback & Ratings** page bhi add hai. Admin isi page par sabhi student ratings, comments aur average rating dekh sakta hai.

## Run

Backend:
```powershell
cd server
npm install
npm run dev
```

Frontend (new terminal):
```powershell
npm install
npm run dev
```
