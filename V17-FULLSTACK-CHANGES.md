# V17 Full Stack Changes

This version converts the previous browser-local prototype into a deployable full-stack CCMMS app.

## Backend

- Express API served from the same Node service as Student/Admin/Staff.
- MongoDB database for accounts, profiles, complaints, notifications, work orders and status history.
- MongoDB GridFS for complaint photos/videos and before/after work evidence.
- bcrypt password hashing.
- JWT sessions with role information.
- Role/ownership data scopes.
- MongoDB indexes and demo seed data.
- Health endpoint: `/api/health`.

## Firebase

Firebase is used only for Forgot Password:

1. MongoDB confirms the account exists.
2. Firebase REST creates a reset-only identity if needed.
3. Firebase sends its secure password reset email.
4. After the user sets a new password, the first CCMMS login verifies that new password through Firebase and re-hashes it into MongoDB.
5. Later normal logins are MongoDB/bcrypt/JWT again.

No Firebase Firestore, Storage, Realtime Database, or normal app login is used.

## Frontend

- Existing Student/Admin/Staff mobile UI preserved.
- Existing Supabase-style screen calls are transparently backed by REST/MongoDB through the `localDb.js` adapter, so screens did not need a destructive rewrite.
- Photo * remains mandatory for a complaint.
- Video remains optional.
- Staff Before and After work photos remain mandatory at their workflow points.
- Shared complaint details read evidence from MongoDB, so Admin/Student/Staff see the same persisted records.

## Deployment

- `render.yaml`
- `.env.example`
- API documentation
- MongoDB/Firebase/Render setup guide
- Postman collection
- Windows run scripts
