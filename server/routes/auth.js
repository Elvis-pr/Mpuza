/**
 * MPUZA - Auth API Routes (works today, no Supabase Auth setup needed)
 *
 * Endpoints:
 *   POST /api/auth/register  { name, email, password } -> { user, token }
 *   POST /api/auth/login     { email, password }        -> { user, token }
 *   GET  /api/auth/me        (Authorization: Bearer <token>) -> { user }
 *   POST /api/auth/logout    (Authorization: Bearer <token>) -> { success }
 *
 * Tokens are opaque (mpuza_...) issued by server/utils/auth-store.js.
 * When you later enable Supabase Auth, keep sending profileId = user.id
 * to /api/applications so per-user tracking carries over unchanged.
 */

const express = require('express');
const router = express.Router();
const store = require('../utils/auth-store');

function bearer(req) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const result = await store.createUser({ name, email, password });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    const result = await store.verifyCredentials({ email, password });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const user = store.getUserByToken(bearer(req));
    if (!user) return res.status(401).json({ success: false, message: 'Not logged in' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    store.revokeToken(bearer(req));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
