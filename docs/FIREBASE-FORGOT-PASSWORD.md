# Firebase Forgot Password (only)

CCMMS keeps normal signup/login credentials in MongoDB. Firebase Authentication is used only to deliver and verify the Forgot Password recovery flow.

## Firebase Console

1. Open Firebase Console -> your project -> Authentication -> Sign-in method.
2. Enable **Email/Password**.
3. Open Project settings -> General and copy the **Web API Key**.
4. In Render -> Service -> Environment add `FIREBASE_API_KEY=<your Web API Key>`.
5. Redeploy the service.

No SMTP/Gmail variables are required.

## How recovery works

- User taps Forgot password and enters the email registered in CCMMS.
- CCMMS asks Firebase to send the official Firebase password-reset email.
- For an older CCMMS account that does not yet exist in Firebase Auth, CCMMS creates a recovery-only Firebase identity automatically.
- The user changes the password using Firebase's secure reset link.
- On the next CCMMS sign-in with that new password, CCMMS verifies it once with Firebase and synchronizes the new password hash into MongoDB.
- Normal later logins are MongoDB/JWT based again.

## Render check

Open `/api/health`. `forgotPassword` should be `firebase`.
