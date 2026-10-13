/**
 * MPUZA - Auth store: file-backed users + opaque tokens.
 * Works on Vercel (memory) and locally (server/data/users.json).
 * Passwords hashed with Node crypto.scrypt — no new dependencies.
 * When real Supabase Auth is configured later, profile_id = user id
 * carries over, so per-user applications keep working.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'data', 'users.json');

function blankDb() {
  return globalThis.__mpuzaUsers || (globalThis.__mpuzaUsers = { users: [], tokens: {} });
}

function loadDb() {
  try {
    if (fs.existsSync(FILE)) {
      const j = JSON.parse(fs.readFileSync(FILE, 'utf8'));
      const db = { users: j.users || [], tokens: j.tokens || {} };
      globalThis.__mpuzaUsers = db;
      return db;
    }
  } catch {}
  return blankDb();
}

function saveDb(db) {
  globalThis.__mpuzaUsers = db;
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
  } catch {}
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function publicUser(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, created_at: u.created_at };
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

async function createUser({ name, email, password }) {
  const db = loadDb();
  const cleanEmail = normalizeEmail(email);
  const cleanName = String(name || '').trim();
  if (!cleanName) throw Object.assign(new Error('Name is required'), { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw Object.assign(new Error('Enter a valid email address'), { status: 400 });
  }
  if (!password || String(password).length < 6) {
    throw Object.assign(new Error('Password must be at least 6 characters'), { status: 400 });
  }
  if (db.users.some((u) => u.email === cleanEmail)) {
    throw Object.assign(new Error('An account with this email already exists. Try logging in.'), { status: 409 });
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const user = {
    id: 'user-' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex'),
    name: cleanName.slice(0, 60),
    email: cleanEmail,
    salt,
    passwordHash: hashPassword(password, salt),
    created_at: new Date().toISOString(),
  };
  db.users.push(user);
  const token = issueToken(db, user.id);
  saveDb(db);
  return { user: publicUser(user), token };
}

function issueToken(db, userId) {
  const token = 'mpuza_' + crypto.randomBytes(24).toString('hex');
  db.tokens[token] = { userId, created_at: new Date().toISOString() };
  return token;
}

async function verifyCredentials({ email, password }) {
  const db = loadDb();
  const cleanEmail = normalizeEmail(email);
  const user = db.users.find((u) => u.email === cleanEmail);
  if (!user) throw Object.assign(new Error('No account found for this email. Try registering.'), { status: 401 });
  const hash = hashPassword(password || '', user.salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(user.passwordHash, 'hex');
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) throw Object.assign(new Error('Incorrect password. Try again.'), { status: 401 });
  const token = issueToken(db, user.id);
  saveDb(db);
  return { user: publicUser(user), token };
}

function getUserByToken(token) {
  if (!token) return null;
  const db = loadDb();
  const entry = db.tokens[String(token)];
  if (!entry) return null;
  const user = db.users.find((u) => u.id === entry.userId);
  return publicUser(user);
}

function revokeToken(token) {
  if (!token) return;
  const db = loadDb();
  delete db.tokens[String(token)];
  saveDb(db);
}

module.exports = { createUser, verifyCredentials, getUserByToken, revokeToken, publicUser };
