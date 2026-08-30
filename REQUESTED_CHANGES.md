# Requested student-flow changes

Implemented in the source code:

- Students only see/receive one complaint notification: **Work Completed**, created after admin approval.
- Duplicate completion notifications for the same complaint are prevented.
- Older/intermediate student notifications are filtered from the student notification screen and unread badge.
- A completed complaint shows the rating popup automatically once after the student opens its detail screen.
- If the popup is dismissed, the existing **Rate Now** card remains available; after rating submission it will not appear again.
- Student bottom navigation keeps **Submit** as its own item, with a separate centre **+** shortcut; notifications remain available from the top bell/drawer.
- Complaint submission supports optional **photos and videos** (maximum 3 media files; videos up to 20 MB).
- Uploaded complaint videos can be viewed in complaint detail, assignment, technician, and approval flows.

## Build note

The source files were syntax-checked. The existing `dist/` folder came from the uploaded project and was not rebuilt in this environment because npm registry access was unavailable. After downloading, run:

```bash
npm install
npm run build
```

For Android/Capacitor, then sync the rebuilt web output as you normally do (for example `npx cap sync android`).
