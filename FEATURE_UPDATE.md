# CampusFix feature update

Added:
- Firebase email verification link after signup
- Login blocked until email is verified
- Resend verification link
- Forgot-password email link
- Confirm-password validation during signup
- Signup roles: Student, Staff, Cleaner / Technician
- Admin and Supervisor cannot be selected during public signup
- My Profile screen for every role
- Editable profile fields and activity totals
- Change-password link from profile
- Admin role selector in User Management
- Safer Firestore rules preventing users from promoting themselves

## Required after deployment
1. Deploy the included `firestore.rules` in Firebase Console or Firebase CLI.
2. Ensure `campusfix-app.onrender.com` is listed under Firebase Authentication > Settings > Authorized domains.
3. Push the source to GitHub; Render will rebuild with `npm install && npm run build`.
