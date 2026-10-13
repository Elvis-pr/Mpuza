/**
 * MPUZA - Auth store: Supabase-first users + sessions, file/memory fallback.
 * - With SUPABASE_URL/SUPABASE_ANON_KEY env + users/sessions tables
 *   (see seed-sql.js), registrations persist on Vercel across cold starts.
 * - Without Supabase: server/data/users.json locally, memory on serverless.
 * Passwords hashed with Node crypto.scrypt — no new dependencies.
 * profile_id = user id, so per-user applications keep working either way.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'data', 'users.json');

function getSupabase() {
  try {
    const { supabase } = require('../supabase');
    return supabase || null;
  } catch { return null; }
}
function useSupabase() { return !!getSupabase(); }

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

function validateRegistration({ name, email, password }) {
  const cleanEmail = normalizeEmail(email);
  const cleanName = String(name || '').trim();
  if (!cleanName) throw Object.assign(new Error('Name is required'), { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw Object.assign(new Error('Enter a valid email address'), { status: 400 });
  }
  if (!password || String(password).length < 6) {
    throw Object.assign(new Error('Password must be at least 6 characters'), { status: 400 });
  }
  return { cleanName, cleanEmail };
}

const ERR_NAME = () => Object.assign(new Error('An account with this email already exists. Try logging in.'), { status: 409 });
const ERR_NO_ACCOUNT = () => Object.assign(new Error('No account found for this email. Try registering.'), { status: 401 });
const ERR_BAD_PASSWORD = () => Object.assign(new Error('Incorrect password. Try again.'), { status: 401 });

function passwordMatches(user, password) {
  const hash = hashPassword(password || '', user.salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(String(user.password_hash || user.passwordHash || ''), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function newUserId() {
  return 'user-' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

async function sbIssueToken(sb, userId) {
  const token = 'mpuza_' + crypto.randomBytes(24).toString('hex');
  const { error } = await sb.from('sessions').insert({ token, user_id: userId, created_at: new Date().toISOString() });
  if (error) throw error;
  return token;
}

async function sbFindByEmail(sb, email) {
  const { data, error } = await sb.from('users').select('*').eq('email', email).maybeSingle();
  if (error) throw error;
  return data;
}

function sbFallback(e, op) {
  if (String(e.message || e).includes('Could not find the table')) {
    console.warn(`users/sessions table missing — ${op} using local fallback. Run seed-sql.js in Supabase.`);
  } else {
    console.warn(`Supabase ${op} failed, fallback:`, e.message);
  }
}

async function createUser({ name, email, password }) {
  const { cleanName, cleanEmail } = validateRegistration({ name, email, password });
  const sb = getSupabase();
  if (sb) {
    try {
      if (await sbFindByEmail(sb, cleanEmail)) throw ERR_NAME();
      const salt = crypto.randomBytes(16).toString('hex');
      const user = {
        id: newUserId(),
        name: cleanName.slice(0, 60),
        email: cleanEmail,
        salt,
        password_hash: hashPassword(password, salt),
        created_at: new Date().toISOString(),
      };
      const { error } = await sb.from('users').insert(user);
      if (error) {
        if (error.code === '23505') throw ERR_NAME(); // unique violation on email
        throw error;
      }
      const token = await sbIssueToken(sb, user.id);
      return { user: publicUser(user), token };
    } catch (e) {
      if (e.status) throw e;
      sbFallback(e, 'createUser');
    }
  }
  const db = loadDb();
  if (db.users.some((u) => u.email === cleanEmail)) throw ERR_NAME();
  const salt = crypto.randomBytes(16).toString('hex');
  const user = {
    id: newUserId(),
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
  const cleanEmail = normalizeEmail(email);
  const sb = getSupabase();
  if (sb) {
    try {
      const user = await sbFindByEmail(sb, cleanEmail);
      if (!user) throw ERR_NO_ACCOUNT();
      if (!passwordMatches(user, password)) throw ERR_BAD_PASSWORD();
      const token = await sbIssueToken(sb, user.id);
      return { user: publicUser(user), token };
    } catch (e) {
      if (e.status) throw e;
      sbFallback(e, 'verifyCredentials');
    }
  }
  const db = loadDb();
  const user = db.users.find((u) => u.email === cleanEmail);
  if (!user) throw ERR_NO_ACCOUNT();
  if (!passwordMatches(user, password)) throw ERR_BAD_PASSWORD();
  const token = issueToken(db, user.id);
  saveDb(db);
  return { user: publicUser(user), token };
}

async function getUserByToken(token) {
  if (!token) return null;
  const sb = getSupabase();
  if (sb) {
    try {
      const { data: session, error } = await sb.from('sessions').select('*').eq('token', String(token)).maybeSingle();
      if (error) throw error;
      if (!session) return null;
      const { data: user, error: uerr } = await sb.from('users').select('*').eq('id', session.user_id).maybeSingle();
      if (uerr) throw uerr;
      return publicUser(user);
    } catch (e) {
      sbFallback(e, 'getUserByToken');
    }
  }
  const db = loadDb();
  const entry = db.tokens[String(token)];
  if (!entry) return null;
  const user = db.users.find((u) => u.id === entry.userId);
  return publicUser(user);
}

async function revokeToken(token) {
  if (!token) return;
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from('sessions').delete().eq('token', String(token));
      if (error) throw error;
      return;
    } catch (e) {
      sbFallback(e, 'revokeToken');
    }
  }
  const db = loadDb();
  delete db.tokens[String(token)];
  saveDb(db);
}

module.exports = { createUser, verifyCredentials, getUserByToken, revokeToken, publicUser, useSupabase };
