# CampusFix — converted to Firebase

This build (student / staff / admin roles) now runs entirely on Firebase instead of Supabase.

## What changed
- `src/lib/firebase.ts` — talks to Firebase Auth + Firestore via REST APIs (sign up, sign in, email verification, password reset, password change).
- `src/lib/supabase.ts` — kept the same name/shape (`supabase.from('table').select()...`) so every screen works unchanged, but it now translates every call into a Firestore request under the hood.
- `src/lib/auth.ts` — Firebase-backed auth store: sign up, sign in, forgot password, resend verification link, change password.
- `src/screens/ResetPasswordScreen.tsx` (new) — shown the instant a user opens the password-reset or verify-email link from their inbox; lets them set a new password right inside the app.
- `src/App.tsx` — detects `?mode=resetPassword` / `?mode=verifyEmail` in the URL and shows `ResetPasswordScreen` immediately.
- `firestore.rules` — updated for the simplified `student` / `staff` / `admin` roles.
- Removed the unused `@supabase/supabase-js` dependency.

## Behaviour added
- Email verification is required after signup (a verification link is emailed automatically); login is blocked until the email is verified.
- "Resend verification link" added next to "Forgot password?" on the sign-in screen.
- **Admin can no longer be self-selected during public signup** — only Student and Staff are offered. Admin accounts should be created/promoted from User Management by an existing admin, same as before.
- "Change Password" on the Profile screen now asks for the current password (Firebase requires re-confirming it before rotating credentials) plus the new password.

## Required after deployment — see FIREBASE_SETUP.md
1. Deploy the included `firestore.rules`.
2. In Firebase Console → Authentication → Templates, set **Customize action URL** for both the Password reset and Email address verification templates to your deployed app URL. This makes the emailed link open CampusFix's own reset/verify screen instead of Firebase's generic page.
3. Add your deployed domain under Authentication → Settings → Authorized domains.
