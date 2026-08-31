import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { config } from './config.mjs';

const ALLOWED_COLLECTIONS = [
  'auth_users',
  'profiles',
  'technicians',
  'complaints',
  'complaint_categories',
  'buildings',
  'notifications',
  'work_orders',
  'complaint_status_history',
];

export async function connectDatabase() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 15000,
  });

  for (const name of ALLOWED_COLLECTIONS) {
    const collection = dbCollection(name);
    await collection.createIndex({ id: 1 }, { unique: true, sparse: true });
  }
  await dbCollection('auth_users').createIndex({ email: 1 }, { unique: true });
  await dbCollection('profiles').createIndex({ email: 1 }, { unique: true });
  await dbCollection('complaints').createIndex({ user_id: 1, created_at: -1 });
  await dbCollection('complaints').createIndex({ assigned_to: 1, status: 1 });
  await dbCollection('notifications').createIndex({ user_id: 1, is_read: 1, created_at: -1 });
  await dbCollection('work_orders').createIndex({ complaint_id: 1, created_at: -1 });

  if (config.seedDemoUsers) await seedDatabase();
}

export function dbCollection(name) {
  if (!ALLOWED_COLLECTIONS.includes(name)) throw new Error(`Unsupported collection: ${name}`);
  if (!mongoose.connection.db) throw new Error('MongoDB is not connected.');
  return mongoose.connection.db.collection(name);
}

export function cleanDoc(doc) {
  if (!doc) return null;
  const value = { ...doc };
  delete value._id;
  delete value.password_hash;
  return value;
}

const CATEGORIES = [
  ['electrical', 'Electrical'], ['plumbing', 'Plumbing'], ['carpentry', 'Carpentry'], ['civil', 'Civil'],
  ['cleaning', 'Cleaning'], ['internet', 'Internet / Wi-Fi'], ['ac', 'AC / HVAC'], ['other', 'Other'],
].map(([id, name]) => ({ id, name }));

const BUILDINGS = [
  ['main-block', 'Main Block'], ['library', 'Library'], ['boys-hostel', 'Boys Hostel'], ['girls-hostel', 'Girls Hostel'],
  ['cafeteria', 'Cafeteria'], ['admin-block', 'Admin Block'], ['sports-complex', 'Sports Complex'], ['other-building', 'Other'],
].map(([id, name]) => ({ id, name }));

const DEMO_USERS = [
  {
    id: 'local-student', email: 'student@campusfix.local', password: 'Student@123', role: 'student',
    full_name: 'Alex Student', college_id: 'STU-001', department: 'Computer Science', hostel: 'Hostel A', block: 'B', room: '203', phone: '',
  },
  {
    id: 'local-admin', email: 'admin@campusfix.local', password: 'Admin@123', role: 'admin',
    full_name: 'CCMMS Admin', college_id: 'ADM-001', department: 'Campus Maintenance', phone: '+91 90000 00000',
  },
  {
    id: 'local-staff', email: 'staff@campusfix.local', password: 'Staff@123', role: 'staff',
    full_name: 'Sam Technician', college_id: 'STF-001', department: 'Campus Maintenance', phone: '',
  },
];

export async function seedDatabase() {
  const now = new Date().toISOString();
  const categoryCollection = dbCollection('complaint_categories');
  const buildingCollection = dbCollection('buildings');
  const profileCollection = dbCollection('profiles');
  const authCollection = dbCollection('auth_users');
  const techCollection = dbCollection('technicians');

  for (const row of CATEGORIES) {
    await categoryCollection.updateOne({ id: row.id }, { $setOnInsert: { ...row, created_at: now, updated_at: now } }, { upsert: true });
  }
  for (const row of BUILDINGS) {
    await buildingCollection.updateOne({ id: row.id }, { $setOnInsert: { ...row, created_at: now, updated_at: now } }, { upsert: true });
  }

  for (const user of DEMO_USERS) {
    const existing = await authCollection.findOne({ email: user.email });
    if (!existing) {
      const profile = {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        college_id: user.college_id,
        department: user.department,
        hostel: user.hostel || '',
        block: user.block || '',
        room: user.room || '',
        phone: user.phone || '',
        is_active: true,
        created_at: now,
        updated_at: now,
      };
      await profileCollection.updateOne({ id: user.id }, { $setOnInsert: profile }, { upsert: true });
      await authCollection.insertOne({
        id: user.id,
        profile_id: user.id,
        email: user.email,
        password_hash: await bcrypt.hash(user.password, 12),
        created_at: now,
        updated_at: now,
      });
    }
    if (user.role === 'staff') {
      await techCollection.updateOne({ id: user.id }, {
        $setOnInsert: {
          id: user.id,
          employee_code: user.college_id,
          skills: ['Electrical', 'Plumbing', 'General Maintenance'],
          current_workload: 0,
          availability_status: 'available',
          area_coverage: ['Main Block', 'Hostels'],
          created_at: now,
          updated_at: now,
        },
      }, { upsert: true });
    }
  }
}

export function newId(prefix = 'record') {
  return `${prefix}-${randomUUID()}`;
}
