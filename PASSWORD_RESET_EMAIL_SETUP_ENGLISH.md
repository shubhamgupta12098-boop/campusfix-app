# Password Reset Email Setup (Render + Gmail)

The project now sends an English password-reset email containing a secure, one-time link that expires after 30 minutes.

## Render backend environment variables

Open the **campusfix API Web Service** in Render, then add:

```env
CLIENT_URL=https://YOUR-FRONTEND.onrender.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail-address@gmail.com
SMTP_PASS=your-16-character-google-app-password
MAIL_FROM=CampusFix CCMMS <your-gmail-address@gmail.com>
APP_NAME=CampusFix CCMMS
```

`CLIENT_URL` must be the frontend/static-site URL, not the backend API URL.

## Create a Gmail App Password

1. Enable 2-Step Verification on the Google account used to send email.
2. Open Google Account > Security > App passwords.
3. Create an app password for CampusFix.
4. Copy the 16-character value into `SMTP_PASS` without spaces.
5. Do not use the normal Gmail password.

After saving the environment variables, manually redeploy the API service.

## Test

1. Open the CampusFix sign-in page.
2. Select **Forgot password?**
3. Enter an email that is registered in the `auth_users` collection.
4. Open the email and select **Reset Password**.
5. Enter a new password and sign in.

Check the Spam or Junk folder if the message does not appear in the inbox.
