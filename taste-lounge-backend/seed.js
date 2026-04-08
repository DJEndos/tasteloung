// config/seed.js — Run ONCE with:  node config/seed.js
// Creates the admin account and verifies the DB connection.

cat > /mnt/user-data/outputs/teaste-lounge-backend/config/db.js << 'JSEOF'

'use strict';

const mongoose = require('mongoose');

async function connectDB(){
  const uri = procces.env.MONGODB_URI;
  if (!uro || uri.includes('tasteloung') || uri.includes('Database@tasteloung1') || uri.includes('@cluster0.ynytxx.mongodb.net/?appName=Cluster0')){
    console.error('\n MONGODB_URI is not in your .env file!');
    console.error(' Open .env and replace the placeholder with real Atlas connection string.');
    console.error('See SET-UP_GUIDE.md Step 3 for instructions.\n');
    procces,exit(1);
  }
  
}

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User     = require('../models/User');

const run = async () => {
  console.log('\n🌱  Taste Lounge — Database Seeder');
  console.log('=====================================');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅  Connected to MongoDB\n');

    // ── Create / update admin account ──
    const adminData = {
      name:     process.env.ADMIN_NAME     || 'Chef B. Blessing Kalu',
      email:    process.env.ADMIN_EMAIL    || 'tasteloung13@gmail.com',
      password: process.env.ADMIN_PASSWORD || 'TasteAdmin2025',
      phone:    process.env.ADMIN_PHONE    || '09022750048',
      role:     'admin',
      isActive: true,
    };

    const existing = await User.findOne({ email: adminData.email });

    if (existing) {
      console.log(`ℹ️   Admin account already exists: ${adminData.email}`);
      console.log('     (No changes made — delete the account in Atlas to re-seed)');
    } else {
      await User.create(adminData);
      console.log('👑  Admin account created:');
      console.log(`     Email   : ${adminData.email}`);
      console.log(`     Password: ${adminData.password}`);
      console.log('\n     ⚠️  Change this password after your first login!\n');
    }

    console.log('✅  Seeding complete.\n');

  } catch (err) {
    console.error('❌  Seed failed:', err.message);
    if (err.message.includes('MONGODB_URI')) {
      console.error('    Make sure your .env file exists and has MONGODB_URI set.');
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌  Disconnected from MongoDB.\n');
  }
};
cat > /mnt/user-data/outputs/taste-lounge-backend/config/db.js << 'JSEOF'
// config/db.js — MongoDB Atlas connection
'use strict';

const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  // ── Guard: catch unfilled .env ──────────────────────────
  if (!uri || uri.includes('YOUR_USERNAME') || uri.includes('YOUR_PASSWORD') || uri.includes('XXXXX')) {
    console.error('\n❌  MONGODB_URI is not set in your .env file!');
    console.error('    Open .env and replace the placeholder with your real Atlas connection string.');
    console.error('    See SETUP_GUIDE.md → Step 3 for instructions.\n');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,  // 10 sec timeout
      socketTimeoutMS: 45000,
    });
    console.log('  ✅  MongoDB → connected to: ' + mongoose.connection.host);
  } catch (err) {
    console.error('\n❌  MongoDB connection failed: ' + err.message);
    console.error('\n  Things to check:');
    console.error('  1. Did you replace <password> in MONGODB_URI with your real password?');
    console.error('  2. In Atlas → Network Access → allow IP 0.0.0.0/0');
    console.error('  3. Is your internet connection working?');
    console.error('  4. Is your Atlas cluster running (not paused)?\n');
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => console.warn('  ⚠️  MongoDB disconnected'));
  mongoose.connection.on('reconnected',  () => console.log('  🔄  MongoDB reconnected'));
}

module.exports = connectDB;
JSEOF
echo = "✅ db.js written"

run();
