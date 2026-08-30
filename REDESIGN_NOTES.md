# CampusFix design notes

The existing light CampusFix design has been preserved. Backend integration changes are limited to authentication, API data access, persistent media storage, password reset and deployment configuration.

## Authentication screen

- The local demo-account panel and its Student, Staff and Admin shortcut buttons were removed.
- The original signup flow remains available for Student and Staff accounts.
- Admin is never offered as a public signup role; the initial admin is seeded from `server/.env`.
- Forgot password now sends a Firebase reset link instead of changing a browser-local password.

## Data and media

- Accounts and application data are stored in MongoDB.
- Complaint photos and videos are stored in MongoDB GridFS.
- The existing admin verification, assignment, approval, completion, notification and rating screens keep their current design and behavior.

See `README.md` for installation, environment variables and deployment steps.
