# V16 Admin Complaint Detail Evidence Fix

- Admin Complaint Details now shows Work Evidence with BEFORE and AFTER photos, matching the Staff detail flow.
- AFTER photos are read from `work_orders.completion_photo_urls`.
- When multiple work orders exist, Admin prefers the record that actually contains completion photos.
- Admin detail listens for shared-data updates and also refreshes evidence every 2.5 seconds while open, so Staff uploads appear without requiring a manual page reload.
- Timeline now includes status remarks/completion notes where available.
- Student Work Rating remains visible on Admin detail.
- Complaint video remains optional; Photo remains mandatory for raising a complaint.
