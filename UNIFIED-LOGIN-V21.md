# V21 — One Login for Student, Admin and Staff

- Root `/` is now the only login/signup page.
- Login accepts Email, College ID or Employee ID + password.
- MongoDB profile role decides which dashboard opens automatically:
  - student -> `/student/`
  - admin -> `/admin/`
  - staff -> `/staff/`
- Student and Staff can self-register from the same page.
- Admin self-signup remains disabled by default for security. Create the bootstrap Admin with `ADMIN_EMAIL` + `ADMIN_PASSWORD` in Render Environment, or from Admin User Management.
- Directly opening `/student/`, `/admin/` or `/staff/` without a valid session sends the user back to `/`.
- Forgot Password remains Firebase-only when `FIREBASE_API_KEY` is configured.
