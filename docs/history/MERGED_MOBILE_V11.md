# CampusFix Mobile — Student + Admin + Staff V11

One localhost project now serves three mobile portals that share the same IndexedDB data.

- Student: `/student/` — V10 UI and mandatory photo complaint validation.
- Admin: `/admin/` — V10 admin UI, Genuine Yes/No and staff assignment.
- Staff: `/staff/` — V9 staff mobile UI with job alerts/notifications.

## Shared workflow
1. Student can submit only when at least one photo is attached.
2. Admin reviews complaint and selects Genuine Yes/No.
3. On Yes, admin can assign a staff member.
4. Staff gets an unread notification and can open the assigned job.
5. All three portals share browser IndexedDB because they are served from the same localhost origin.

## Demo logins
- Student: `student@campusfix.local` / `Student@123`
- Admin: `admin@campusfix.local` / `Admin@123`
- Staff: `staff@campusfix.local` / `Staff@123`
