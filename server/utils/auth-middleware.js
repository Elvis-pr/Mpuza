/**
 * MPUZA - Resolve the caller's profile id from Bearer token or body/query.
 * - Logged-in: token -> user.id (per-user tracking, syncs across devices)
 * - Guest: profileId from client (guest-xxxx, per-browser tracking)
 */
function resolveProfileId(req) {
  try {
    const h = req.headers.authorization || '';
    const m = h.match(/^Bearer\s+(.+)$/i);
    if (m) {
      const store = require('../utils/auth-store');
      const user = store.getUserByToken(m[1].trim());
      if (user?.id) return user.id;
    }
  } catch {}
  return req.query.profileId || req.body?.profileId || 'local-user';
}

module.exports = { resolveProfileId };
