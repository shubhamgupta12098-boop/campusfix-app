# CCMMS REST API

Base URL: `/api`

All authenticated requests use:

```http
Authorization: Bearer <JWT>
X-Portal-Role: student | admin | staff
```

## Health

`GET /api/health`

## Auth

- `POST /api/auth/login`
- `POST /api/auth/signup`
- `GET /api/auth/me`
- `POST /api/auth/change-password`
- `POST /api/auth/change-email`
- `POST /api/auth/forgot-password` — Firebase email only

Example login:

```json
{
  "email": "student@campusfix.local",
  "password": "Student@123"
}
```

Successful response:

```json
{
  "token": "<jwt>",
  "user": { "uid": "...", "email": "...", "displayName": "..." },
  "profile": { "id": "...", "role": "student" }
}
```

## Data resources

The existing app's Supabase-style query wrapper now maps to these MongoDB REST resources:

- `profiles`
- `technicians`
- `complaints`
- `complaint_categories`
- `buildings`
- `notifications`
- `work_orders`
- `complaint_status_history`

Routes:

- `GET /api/data/:store`
- `GET /api/data/:store/:id`
- `PUT /api/data/:store/:id`
- `POST /api/data/:store/bulk`
- `POST /api/data/:store/delete-many`

The server applies role/ownership scopes. Students do not receive all student complaints, and staff complaint/work-order reads are scoped to their jobs.

## Media

`POST /api/media`

Multipart form-data field: `file`

Supported: image/* and video/*, max 25 MB.

`POST /api/media/data-url`

```json
{
  "dataUrl": "data:image/jpeg;base64,...",
  "filename": "complaint-photo.jpg"
}
```

Media is stored in MongoDB GridFS. Returned URLs look like:

```text
https://your-app.onrender.com/api/media/<gridfs-id>
```

`GET /api/media/:id` streams the file.

## Validation

Complaint save is rejected unless at least one photo URL/image media item exists.

Work order save is rejected when:

- status is `in_progress` and no `before_photo_urls` exists
- status is `awaiting_approval`, `completed`, or `closed` and no `completion_photo_urls` exists
