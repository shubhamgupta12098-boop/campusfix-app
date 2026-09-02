import 'dotenv/config';
import mongoose from 'mongoose';
import { connectMongoConnection, disconnectDatabase } from '../backend/db.mjs';

try {
  console.log('[MongoDB Test] Connecting...');
  await connectMongoConnection();

  const result = await mongoose.connection.db.admin().ping();
  console.log('[MongoDB Test] Ping:', result);
  console.log(`[MongoDB Test] Database: ${mongoose.connection.name}`);
  console.log('[MongoDB Test] SUCCESS');
  await disconnectDatabase();
  process.exit(0);
} catch (error) {
  console.error('[MongoDB Test] FAILED:', error?.message || error);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
}
