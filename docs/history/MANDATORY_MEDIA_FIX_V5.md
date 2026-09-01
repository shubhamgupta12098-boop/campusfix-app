# Mandatory complaint media fix

This build keeps the supplied Admin UI and fixes the complaint media rule end-to-end.

- Student cannot submit until at least one photo is attached.
- The complaint insert adapter rejects media-less complaint records even if UI validation is bypassed.
- Existing legacy complaints with no photo are removed from the shared localhost IndexedDB, together with related complaint notifications/history/work orders, so they no longer appear in Admin.
- Admin UI/layout is otherwise preserved from the supplied Clean Student/Admin build.
