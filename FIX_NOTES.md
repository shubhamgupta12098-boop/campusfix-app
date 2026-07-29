# CampusFix fixes in this build

- Fixed Firestore insert chaining so `insert(...).select(...).single()` actually creates the complaint.
- Added complaint number, submitted status, escalation level, timestamps and required defaults.
- Category is now a fixed Android-native select list: Electrical, Plumbing, Furniture, IT / Network, Cleanliness and Other.
- Location is fully manual: building, floor, room/area and optional landmark.
- Image attachments are compressed before saving and limited to three images.
- Notification errors no longer prevent a complaint from being filed.
- Added a submission notification for the student and new-complaint notifications for staff/admins.
- Added unread notification badges in the sidebar and mobile header.
- Fixed the mobile profile cover/avatar overlap and button layout.

## Run

```powershell
npm install
npm run build
npx cap sync android
npx cap open android
```
