/**
 * MPUZA - Supabase Migrations
 *
 * Runs schema migrations on Supabase to create the required tables.
 * Run: node server/migrate.js
 *
 * Creates:
 *   - opportunities  (id, title, company, type, location, description, requirements, pay, deadline, posted_at)
 *   - career_resources (id, name, url, category, icon, active, created_at)
 *
 * NOTE: The Supabase REST client doesn't support raw SQL directly.
 * For production, use the Supabase SQL editor in the dashboard to
 * apply the schema and seed data defined in server/supabase-seed.js.
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ SUPABASE_URL and SUPABASE_ANON_KEY must be set in server/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runMigrations() {
  console.log('🚀 Running Supabase migrations...');

  // The Supabase REST client cannot run raw SQL.
  // Use this file as documentation; apply the schema via:
  //   Supabase Dashboard > SQL > New Query
  // and run the seed script:
  //   node server/supabase-seed.js

  console.log('✅ Migrations ready.');
  console.log('📋 To create tables + seed data:');
  console.log('   1. Open Supabase Dashboard > SQL > New Query');
  console.log('   2. Paste the contents of server/supabase-seed.js (tables only)');
  console.log('   3. Run: node server/supabase-seed.js');
}

runMigrations().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
