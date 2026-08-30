# CampusFix – Student/Admin verification flow (v2)

Implemented requested behaviour:

1. Complaint evidence is mandatory.
   - The form displays `Photo / Video Evidence *` with a red required marker.
   - At least one photo OR video must be attached.
   - The submit button stays disabled until evidence is attached.
   - Up to 3 media files are supported; videos remain supported up to 20 MB each.

2. Admin review happens before staff assignment.
   - On submission, only active admins receive the new complaint notification.
   - Staff receive no notification and do not see the job as assigned at this stage.
   - When an admin opens a submitted complaint detail, the app records `admin_viewed_at` immediately.
   - The admin then chooses either:
     - `Yes — Genuine Complaint` → complaint becomes Verified and can be assigned to staff.
     - `No — Reject Complaint` → complaint becomes Rejected and no staff is notified.
   - A verified complaint can be assigned directly from the detail page, or from Assign Complaints.
   - Only after assignment does the selected staff member receive `New Job Assigned`.

3. Student edit lock.
   - A student can edit their own complaint while it is still Submitted and `admin_viewed_at` is empty.
   - Opening the complaint as an admin locks editing for the student.
   - The save action re-checks the complaint before writing, so an admin view that happens while the edit modal is open also prevents the update.
   - The complaint list shows whether a submitted complaint is still editable or locked.

4. Student completion notification and rating behaviour from the previous revision are preserved.
   - Student receives one completion notification only after completed work is approved.
   - Rating prompt is automatically shown once after the student opens the completed complaint detail.

5. UI mode.
   - The app is explicitly forced to light color-scheme and uses the existing white/light CampusFix UI.
   - No image/mockup generation is included; these are code changes only.
