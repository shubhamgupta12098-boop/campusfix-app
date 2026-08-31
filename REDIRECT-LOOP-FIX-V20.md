# V20 Redirect Loop Fix

Fixed `ERR_TOO_MANY_REDIRECTS` on `/student/`, `/admin/`, and `/staff/`.

Cause: Express 4 non-strict routing treats `/student` and `/student/` as matching the same route. The previous handler redirected `/student` to `/student/`, so `/student/` could match that same handler and redirect to itself forever.

Fix:
- Removed portal trailing-slash redirect handlers.
- `/student` and `/student/` now directly serve Student `index.html`.
- Same for Admin and Staff.
- Disabled `express.static` directory redirects.
- Kept SPA fallback for nested portal routes.
