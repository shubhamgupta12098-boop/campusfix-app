# Admin Dashboard Added

The app now opens a dedicated admin dashboard when the signed-in profile has:

```text
role: admin
```

## Make a user admin

1. Firebase Console → Authentication → Users → copy the user's UID.
2. Firestore → `profiles` → open the document with the same UID.
3. Set `role` to the string `admin`.
4. Sign out and sign in again.

## Admin dashboard features

- Total, open, unassigned and resolved complaint statistics
- Student and staff counts
- Overdue complaint count
- Low-stock inventory count
- Recent complaints list
- Complaint workflow breakdown
- High/emergency priority queue
- Quick links for assignment, users, work orders, inventory, reports and preventive maintenance
