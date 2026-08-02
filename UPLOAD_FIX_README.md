# Render upload bug fix

Uploaded images are now stored in MongoDB GridFS instead of Render's temporary local filesystem.

## What changed
- `POST /api/upload` stores image bytes in MongoDB (`uploads.files` / `uploads.chunks`).
- `GET /uploads/:filename` streams the image from MongoDB.
- Local disk remains as a fallback for development/older files that still exist.

## Deploy
```bash
git add .
git commit -m "Fix persistent image uploads on Render"
git push origin main
```

After Render finishes deploying, upload a new image and test it. Images whose files were already deleted by an earlier Render restart cannot be recovered automatically and must be uploaded again.
