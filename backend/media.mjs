import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import { requireAuth } from './auth.mjs';

export const mediaRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } });

function bucket() {
  if (!mongoose.connection.db) throw new Error('MongoDB is not connected.');
  return new GridFSBucket(mongoose.connection.db, { bucketName: 'ccmms_media' });
}
function isAllowedMime(type) { return String(type || '').startsWith('image/') || String(type || '').startsWith('video/'); }
function absoluteMediaUrl(req, id) { return `${req.protocol}://${req.get('host')}/api/media/${id}`; }
function saveBuffer(req, buffer, filename, contentType) {
  if (!isAllowedMime(contentType)) throw Object.assign(new Error('Only photo and video uploads are allowed.'), { status: 400 });
  return new Promise((resolve, reject) => {
    const stream = bucket().openUploadStream(String(filename || `media-${Date.now()}`), { metadata: { contentType, uploadedAt: new Date().toISOString() } });
    stream.on('error', reject);
    stream.on('finish', () => resolve(absoluteMediaUrl(req, stream.id.toString())));
    stream.end(buffer);
  });
}

mediaRouter.post('/', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required.' });
    const url = await saveBuffer(req, req.file.buffer, req.file.originalname, req.file.mimetype);
    res.status(201).json({ url });
  } catch (error) { next(error); }
});
mediaRouter.post('/data-url', requireAuth, async (req, res, next) => {
  try {
    const value = String(req.body?.dataUrl || ''); const match = value.match(/^data:([^;,]+);base64,(.+)$/s);
    if (!match || !isAllowedMime(match[1])) return res.status(400).json({ error: 'Invalid photo/video data.' });
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 25 * 1024 * 1024) return res.status(413).json({ error: 'Media file is too large. Maximum size is 25 MB.' });
    const url = await saveBuffer(req, buffer, req.body?.filename || `media-${Date.now()}`, match[1]);
    res.status(201).json({ url });
  } catch (error) { next(error); }
});
mediaRouter.get('/:id', async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(404).end();
    const id = new ObjectId(req.params.id);
    const files = await mongoose.connection.db.collection('ccmms_media.files').find({ _id: id }).limit(1).toArray();
    const file = files[0]; if (!file) return res.status(404).end();
    res.setHeader('Content-Type', file.metadata?.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    bucket().openDownloadStream(id).on('error', next).pipe(res);
  } catch (error) { next(error); }
});
