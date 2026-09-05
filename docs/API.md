# CCMMS API

All protected routes accept `Authorization: Bearer <JWT>` and the portals also send `X-Portal-Role` (`student`, `staff`, or `admin`). A same-origin HttpOnly session cookie is issued as a fallback.

## Authentication

### POST `/api/auth/login`
```json
{ "identifier": "STU-001 or user@example.com", "password": "..." }
```

### POST `/api/auth/signup`
Student/Staff self-signup. Send `X-Portal-Role: student` or `staff`.

### GET `/api/auth/me`
Returns current user/profile.

### POST `/api/auth/forgot-password`
```json
{ "email": "user@example.com" }
```
Requires `FIREBASE_API_KEY`. Firebase Authentication is used only for the Forgot Password recovery email.

## Data resources

Supported stores: `profiles`, `technicians`, `complaints`, `complaint_categories`, `buildings`, `notifications`, `work_orders`, `complaint_status_history`.

Role visibility and write rules are enforced on the backend.

## Media

Uploads are stored in MongoDB GridFS so they survive Render instance restarts.
