# Final CMMS Changes

- Aapka diya hua CMMS logo login, sidebar aur favicon me add kiya gaya hai.
- Visible Resolved step hata kar final Closed status use kiya gaya hai.
- Admin approval ke baad complaint Closed hoti hai.
- Legacy Resolved complaints ke liye Student aur Admin Close Complaint button dekh sakte hain.
- Profile me Dark Mode toggle add hai. Profile image upload option add nahi kiya gaya.
- Gmail SMTP App Password ke spaces automatically remove hote hain aur invalid-login par clear error milta hai.

## Gmail reset email
server/.env me:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=16-character-google-app-password
MAIL_FROM=CMMS <your-email@gmail.com>

Normal Gmail password kaam nahi karega. Google Account > Security > 2-Step Verification > App Passwords se password banayein.
