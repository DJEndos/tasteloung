// check.js — Run this if ANYTHING isn't working: node check.js
// It checks every requirement and tells you exactly what to fix.
'use strict';

const fs   = require('fs');
const path = require('path');

console.log('\n🍽️  Taste Lounge — Startup Diagnostics');
console.log('═══════════════════════════════════════\n');

let allGood = true;

function pass(msg) { console.log('  ✅  ' + msg); }
function fail(msg, fix) {
  console.log('  ❌  ' + msg);
  console.log('      FIX: ' + fix);
  console.log('');
  allGood = false;
}
function warn(msg, fix) {
  console.log('  ⚠️   ' + msg);
  console.log('      ACTION: ' + fix);
  console.log('');
}

// ── 1. Node version ──────────────────────────────────────
const nodeVer = parseInt(process.versions.node.split('.')[0]);
if (nodeVer >= 18) {
  pass('Node.js version: v' + process.versions.node);
} else {
  fail(
    'Node.js version too old: v' + process.versions.node,
    'Download Node.js 18 or newer from https://nodejs.org'
  );
}

// ── 2. In the right folder ───────────────────────────────
const cwd = process.cwd();
const hasServer = fs.existsSync(path.join(cwd, 'server.js'));
const hasPkg    = fs.existsSync(path.join(cwd, 'package.json'));
if (hasServer && hasPkg) {
  pass('Running from correct folder: ' + path.basename(cwd));
} else {
  fail(
    'Not in the taste-lounge-backend folder (server.js not found here)',
    'Run:  cd taste-lounge-backend  then try again'
  );
}

// ── 3. node_modules installed ────────────────────────────
const hasModules = fs.existsSync(path.join(cwd, 'node_modules'));
const hasExpress = fs.existsSync(path.join(cwd, 'node_modules', 'express'));
if (hasModules && hasExpress) {
  pass('node_modules installed (express found)');
} else {
  fail(
    'node_modules NOT found — npm install has not been run',
    'Run:  npm install    (wait for it to finish, then try npm run dev)'
  );
}

// ── 4. .env file exists ──────────────────────────────────
const envPath = path.join(cwd, '.env');
if (fs.existsSync(envPath)) {
  pass('.env file exists');
} else {
  fail(
    '.env file is MISSING',
    'Create a file named .env in this folder (copy from .env.example and fill in values)'
  );
}

// ── 5. .env values filled in ────────────────────────────
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8');

  // Parse key=value lines
  const vals = {};
  env.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) return;
    const [key, ...rest] = trimmed.split('=');
    vals[key.trim()] = rest.join('=').trim();
  });

  const uri = vals['MONGODB_URI'] || '';
  if (!uri || uri.includes('YOUR_USERNAME') || uri.includes('YOUR_PASSWORD') || uri.includes('XXXXX')) {
    fail(
      'MONGODB_URI still has placeholder text',
      'Open .env → replace MONGODB_URI with your real Atlas connection string\n' +
      '      Get it from: cloud.mongodb.com → your Cluster → Connect → Drivers'
    );
  } else if (!uri.startsWith('mongodb')) {
    fail('MONGODB_URI does not look like a valid MongoDB connection string',
      'It should start with:  mongodb+srv://...');
  } else {
    pass('MONGODB_URI is filled in');
  }

  const jwt = vals['JWT_SECRET'] || '';
  if (!jwt || jwt.includes('REPLACE') || jwt.includes('LONG_RANDOM') || jwt.length < 20) {
    warn(
      'JWT_SECRET looks like it has not been changed',
      'Open .env → set JWT_SECRET to any long random string, e.g.\n' +
      '        JWT_SECRET=tastelounge_blessing_kalu_2025_xmq9fzp3abc'
    );
  } else {
    pass('JWT_SECRET is set');
  }
}

// ── 6. nodemon available ─────────────────────────────────
const hasNodemon = fs.existsSync(path.join(cwd, 'node_modules', '.bin', 'nodemon')) ||
                   fs.existsSync(path.join(cwd, 'node_modules', '.bin', 'nodemon.cmd'));
if (hasNodemon) {
  pass('nodemon is installed (npm run dev will work)');
} else {
  warn(
    'nodemon not found — npm run dev might fail',
    'Run:  npm install    OR use  npm run dev:node  instead (uses plain node)'
  );
}

// ── 7. All required files present ───────────────────────
const required = [
  'server.js', 'config/db.js', 'config/seed.js',
  'models/User.js', 'models/Order.js',
  'routes/auth.js', 'routes/orders.js', 'routes/users.js',
  'middleware/auth.js', 'middleware/errorHandler.js',
];
const missing = required.filter(f => !fs.existsSync(path.join(cwd, f)));
if (missing.length === 0) {
  pass('All required source files present');
} else {
  fail(
    'Missing files: ' + missing.join(', '),
    'Re-download the taste-lounge-backend folder from the project files'
  );
}

// ── Summary ──────────────────────────────────────────────
console.log('═══════════════════════════════════════');
if (allGood) {
  console.log('\n  🎉  Everything looks good!');
  console.log('\n  Run this to start the server:');
  console.log('  ──────────────────────────────');
  console.log('  npm run dev\n');
  console.log('  Then open in browser:');
  console.log('  http://localhost:5000/api/health\n');
} else {
  console.log('\n  ⚠️  Fix the issues above, then run:  node check.js  again');
  console.log('  Once all checks pass, run:          npm run dev\n');
}
