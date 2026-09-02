import 'dotenv/config';
import mongoose from 'mongoose';
const uri = String(process.env.MONGODB_URI || '').trim();
if (!uri) throw new Error('MONGODB_URI is missing. Copy .env.example to .env and add your Atlas URI.');
await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || 'ccmms', serverSelectionTimeoutMS: 15000, family: 4 });
await mongoose.connection.db.admin().ping();
console.log(`MongoDB OK: ${mongoose.connection.host}/${mongoose.connection.name}`);
await mongoose.disconnect();
