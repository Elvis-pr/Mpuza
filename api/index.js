/**
 * MPUZA - Vercel Serverless Entry
 * Re-exports the Express app as a Vercel Node function handler.
 * Vercel routes /api/(.*) -> /api/index.js (see vercel.json).
 */
const app = require('../server/index');

module.exports = (req, res) => app(req, res);
