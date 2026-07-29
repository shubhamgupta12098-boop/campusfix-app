# Complaint save/display fix

- Firestore list queries now use the document-list endpoint and filter/sort in the app.
- This avoids missing composite-index errors that could hide a complaint immediately after it was successfully saved.
- My Complaints now waits for the logged-in profile ID, shows load errors, and includes a retry action.
- Category remains the Android native select list.
- Location remains manually entered by the user.
