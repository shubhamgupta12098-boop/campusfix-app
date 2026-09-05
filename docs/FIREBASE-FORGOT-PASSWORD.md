# Firebase Forgot Password (CCMMS)

CCMMS uses MongoDB/JWT for normal sign-in. Firebase Authentication is used only for password recovery.

## Firebase setup

1. Open Firebase Console for the project that owns the configured Web API key.
2. Go to **Authentication > Sign-in method**.
3. Enable **Email/Password**.
4. The supplied Firebase Web API key is already wired into this project as a fallback and in `render.yaml`.
   You can still override it using the Render environment variable `FIREBASE_API_KEY`.

## Recovery flow

1. User taps **Forgot password?** and enters a CCMMS-registered email.
2. CCMMS creates a recovery-only Firebase Auth identity if needed.
3. Firebase sends its official password-reset email.
4. User sets a new password on Firebase's secure reset page.
5. On the next CCMMS sign-in, the new Firebase password is verified once, copied into MongoDB, and the temporary Firebase recovery identity is deleted.
6. Normal CCMMS login continues to use MongoDB/JWT.

If Render cannot call Firebase because the Web API key is restricted to browser referrers, the login page automatically performs the Firebase reset request from the browser and confirms the recovery state with the server.

## Troubleshooting

- `OPERATION_NOT_ALLOWED`: enable Email/Password in Firebase Authentication.
- `INVALID_API_KEY`: verify the Web API key belongs to the intended Firebase project.
- `TOO_MANY_ATTEMPTS`: wait a few minutes before retrying.
- Check Inbox, Promotions and Spam for Firebase's reset email.
