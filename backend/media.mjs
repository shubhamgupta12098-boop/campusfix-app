import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import { requireAuth } from './auth.mjs';

export const mediaRouter = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});

function bucket() {
  if (!mongoose.connection.db) throw new Error('MongoDB is not connected.');
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
}

function isAllowedMime(type) {
  return String(type || '').startsWith('image/') || String(type || '').startsWith('video/');
}

function absoluteMediaUrl(req, id) {
  const forwarded = String(req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const protocol = forwarded || req.protocol || 'http';
  return `${protocol}://${req.get('host')}/api/media/${id}`;
}

async function saveBuffer(req, buffer, filename, contentType) {
  if (!isAllowedMime(contentType)) throw Object.assign(new Error('Only photo and video uploads are allowed.'), { status: 400 });
  const stream = bucket().openUploadStream(filename || `media-${Date.now()}`, {
    contentType,
    metadata: { uploaded_by: req.auth.profileId, role: req.auth.role, uploaded_at: new Date().toISOString() },
  });
  await new Promise((resolve, reject) => {
    Readable.from([buffer]).pipe(stream).on('error', reject).on('finish', resolve);
  });
  return absoluteMediaUrl(req, stream.id.toString());
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
    const value = String(req.body?.dataUrl || '');
    const match = value.match(/^data:([^;,]+);base64,(.+)$/s);
    if (!match) return res.status(400).json({ error: 'Invalid photo/video data.' });
    const contentType = match[1];
    if (!isAllowedMime(contentType)) return res.status(400).json({ error: 'Only photo and video uploads are allowed.' });
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 25 * 1024 * 1024) return res.status(413).json({ error: 'Media file is too large. Maximum size is 25 MB.' });
    const url = await saveBuffer(req, buffer, req.body?.filename || `media-${Date.now()}`, contentType);
    res.status(201).json({ url });
  } catch (error) { next(error); }
});

mediaRouter.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).end();
    const id = new mongoose.Types.ObjectId(req.params.id);
    const files = await bucket().find({ _id: id }).limit(1).toArray();
    const file = files[0];
    if (!file) return res.status(404).end();
    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    bucket().openDownloadStream(id).on('error', next).pipe(res);
  } catch (error) { next(error); }
});
