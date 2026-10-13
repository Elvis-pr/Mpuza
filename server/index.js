/**
 * MPUZA - Backend Server (v2: Skill-to-Opportunity Matching)
 *
 * Starts the Express server with:
 *   - REST API under /api
 *   - Matching engine for skill-to-opportunity matching
 *   - Serving static frontend from client/dist (Vite build), falling back
 *     to ./public (legacy vanilla app) when the build does not exist
 *   - JSON request parsing
 *   - CORS enabled
 *   - Graceful error handling
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const opportunitiesRouter = require('./routes/opportunities');
const skillsRouter = require('./routes/skills');
const applicationsRouter = require('./routes/applications');
const interviewsRouter = require('./routes/interviews');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'mpuza-api', version: '2.0' });
});

// ===== OPPORTUNITIES (with matching) =====
app.use('/api/opportunities', opportunitiesRouter);

// ===== AUTH (login / register, works without Supabase Auth) =====
app.use('/api/auth', authRouter);

// ===== SKILLS =====
app.use('/api/skills', skillsRouter);

// ===== APPLICATIONS =====
app.use('/api/applications', applicationsRouter);

// ===== INTERVIEWS =====
app.use('/api/interviews', interviewsRouter);

// Serve static frontend in production (local node server only).
// On Vercel the frontend is served as static output (client/dist) and
// /api is a serverless function — so skip file serving there.
const fs = require('fs');
const IS_VERCEL = process.env.VERCEL === '1';
const clientDist = path.join(__dirname, '..', 'client', 'dist');
const legacyPublic = path.join(__dirname, '..', 'public');

if (!IS_VERCEL && fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist));
  // SPA fallback: non-API GET requests serve the React index.html
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDist, 'index.html'));
    } else {
      next();
    }
  });
} else if (!IS_VERCEL) {
  app.use(express.static(legacyPublic));
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Something went wrong!', error: err.message });
});

// Only listen when run directly (node server/index.js).
// On Vercel the app is imported by /api/index.js — no listener needed.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 MPUZA backend running at http://localhost:${PORT}`);
    console.log(`📊 API endpoints:`);
    console.log(`   /api/opportunities         - list opportunities (with /match)`);
    console.log(`   /api/skills                - skill taxonomy + profile skills`);
    console.log(`   /api/applications          - track applications`);
    console.log(`   /api/interviews            - interview readiness`);
  });
}

module.exports = app;
