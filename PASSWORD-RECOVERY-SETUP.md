# Password Recovery Setup

The login page uses the server endpoint `/api/auth/forgot-password`. The provider name is intentionally not shown anywhere on the login UI.

For password-reset email delivery on Render:

1. In the Firebase project, enable **Authentication -> Sign-in method -> Email/Password**.
2. Copy the project's **Web API Key** from Firebase project settings.
3. In Render -> your `campusfix-app` service -> Environment, set:
   `FIREBASE_API_KEY=<your Web API Key>`
4. Save/redeploy the service.

Existing MongoDB users are supported: on the first reset request, a recovery identity is created automatically if needed. After the user sets a new password from the email link, their next CCMMS login synchronizes the new password back into the MongoDB auth record.
