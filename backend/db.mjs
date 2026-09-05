import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dns from 'node:dns';
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

function validateMongoUri(uri) {
  if (!uri) {
    throw new Error(
      'MONGODB_URI is missing. Create a root .env file locally or add MONGODB_URI in Render Environment.',
    );
  }

  if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) {
    throw new Error('MONGODB_URI is not a valid MongoDB connection string.');
  }

  if (
    uri.includes('<db_password>') ||
    uri.includes('YOUR_PASSWORD') ||
    uri.includes('DB_PASSWORD') ||
    uri.includes('YOUR_CLUSTER')
  ) {
    throw new Error(
      'MONGODB_URI still contains placeholder values. Copy the real Drivers connection string from MongoDB Atlas.',
    );
  }
}

function isSrvDnsError(error) {
  const message = String(error?.message || error || '');
  return /querySrv|ENOTFOUND|ECONNREFUSED|ETIMEOUT|EAI_AGAIN/i.test(message);
}

function printMongoHelp(error) {
  const message = String(error?.message || error || '');

  if (isSrvDnsError(error)) {
    console.error(
      '[MongoDB] DNS/SRV lookup failed. The app already retried with Google/Cloudflare DNS. Check VPN/proxy/firewall or use Atlas standard connection string if your network blocks SRV.',
    );
    return;
  }

  if (/bad auth|Authentication failed|auth failed|code 18/i.test(message)) {
    console.error(
      '[MongoDB] Authentication failed. Check MongoDB Atlas > Database Access username/password and URL-encode special password characters.',
    );
    return;
  }

  if (/IP.*access|not authorized|whitelist|network access/i.test(message)) {
    console.error(
      '[MongoDB] Network access rejected. Add your IP in MongoDB Atlas > Network Access. For Render, allow the Render egress range or use 0.0.0.0/0 while testing.',
    );
    return;
  }

  if (/ENETUNREACH|ECONNRESET|ETIMEDOUT|connection/i.test(message)) {
    console.error(
      '[MongoDB] Network connection failed. Check internet access, Atlas cluster status, firewall/VPN and Network Access rules.',
    );
  }
}

/**
 * MongoDB connector based on the working connection pattern from
 * CampusFix-Before-Photo-Fixed:
 * 1) validate Atlas URI
 * 2) prefer IPv4
 * 3) try normal system DNS
 * 4) on SRV/DNS failure retry with Google + Cloudflare DNS
 * 5) ping the selected database before the API starts
 */
export async function connectMongoConnection() {
  validateMongoUri(config.mongoUri);

  mongoose.set('strictQuery', true);
  dns.setDefaultResultOrder('ipv4first');

  const options = {
    autoIndex: true,
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    family: 4,
    dbName: config.mongoDbName,
  };

  try {
    await mongoose.connect(config.mongoUri, options);
  } catch (firstError) {
    const canRetryWithPublicDns =
      config.mongoUri.startsWith('mongodb+srv://') && isSrvDnsError(firstError);

    if (!canRetryWithPublicDns) {
      printMongoHelp(firstError);
      throw firstError;
    }

    console.warn(
      '[MongoDB] SRV DNS lookup failed. Retrying with Google DNS (8.8.8.8) and Cloudflare DNS (1.1.1.1)...',
    );

    try {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
    } catch (dnsError) {
      console.warn('[MongoDB] Could not override DNS servers:', dnsError?.message || dnsError);
    }

    await mongoose.disconnect().catch(() => {});

    try {
      await mongoose.connect(config.mongoUri, options);
    } catch (secondError) {
      printMongoHelp(secondError);
      throw secondError;
    }
  }

  if (!mongoose.connection.db) {
    throw new Error('MongoDB connected without a selected database.');
  }

  await mongoose.connection.db.admin().ping();

  console.log(
    `[MongoDB] Connected successfully: ${mongoose.connection.host}/${mongoose.connection.name}`,
  );

  return mongoose.connection;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export async function connectDatabase() {
  await connectMongoConnection();

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

  await seedDatabase();
  await seedBootstrapAdmin();
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
  ['electrical', 'Electrical'],
  ['plumbing', 'Plumbing'],
  ['furniture', 'Furniture'],
  ['it-network', 'IT / Network'],
  ['cleanliness', 'Cleanliness'],
  ['other', 'Other'],
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

  if (!config.seedDemoUsers) return;

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
        firebase_recovery_enabled: false,
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


export async function seedBootstrapAdmin() {
  if (!config.bootstrapAdminEmail || !config.bootstrapAdminPassword) return;
  if (config.bootstrapAdminPassword.length < 10) {
    throw new Error('ADMIN_PASSWORD must be at least 10 characters.');
  }
  const authCollection = dbCollection('auth_users');
  const profileCollection = dbCollection('profiles');
  const existing = await authCollection.findOne({ email: config.bootstrapAdminEmail });
  if (existing) return;
  const now = new Date().toISOString();
  const id = newId('admin');
  const profile = {
    id,
    email: config.bootstrapAdminEmail,
    full_name: config.bootstrapAdminName || 'CCMMS Admin',
    role: 'admin',
    college_id: 'ADM-001',
    department: 'Campus Maintenance',
    phone: '',
    is_active: true,
    created_at: now,
    updated_at: now,
  };
  await profileCollection.insertOne(profile);
  await authCollection.insertOne({
    id, profile_id: id, email: profile.email,
    password_hash: await bcrypt.hash(config.bootstrapAdminPassword, 12),
    firebase_recovery_enabled: false,
    created_at: now, updated_at: now,
  });
  console.log(`Bootstrap admin created: ${profile.email}`);
}

export function newId(prefix = 'record') {
  return `${prefix}-${randomUUID()}`;
}
