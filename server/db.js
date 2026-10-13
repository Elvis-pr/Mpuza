/**
 * MPUZA - Database Layer (v2: Skill-to-Opportunity Matching)
 *
 * All data is stored in Supabase (via server/supabase.js)
 * Includes:
 *   - Opportunities with matching support
 *   - Skills taxonomy
 *   - Student profiles
 *   - Applications tracking
 *   - Interviews / interview readiness
 *
 * Setup:
 *   1. Create a Supabase project at https://supabase.com/dashboard
 *   2. Copy SUPABASE_URL and SUPABASE_ANON_KEY into server/.env
 *   3. Run: node server/supabase-seed.js (to populate the DB)
 *   4. Start server: npm start
 */

const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '.env') });

// Re-export the Supabase client and data functions from supabase.js
const {
  supabase,
  listOpportunities,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  listResources,
} = require('./supabase');

// Export all database functions and constants
module.exports = {
  supabase,
  listOpportunities,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  listResources,
};
