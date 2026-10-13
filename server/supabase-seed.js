/**
 * MPUZA - Supabase Seed Runner
 *
 * Runs the seed data against Supabase.
 * Run: node server/supabase-seed.js
 *
 * NOTE: The Supabase REST client cannot execute raw SQL.
 * This script prints the SQL to the console so you can paste it
 * into the Supabase Dashboard > SQL > New Query > Run.
 *
 * In production, use this SQL with a migration tool like
 * `supabase-migration`, `drizzle-orm`, or `pg-migrate`.
 */

const SEED_SQL = require('./seed-sql');

async function seedDatabase() {
  console.log('🚀 Seeding Supabase database...');
  console.log('   The Supabase REST client cannot execute raw SQL.');
  console.log('   This script prints the SQL for you to paste into the dashboard.');
  console.log('');
  console.log('📋 COPY THE SQL BELOW INTO SUPABASE DASHBOARD:');
  console.log('   Supabase Dashboard > SQL > New Query > Run');
  console.log('============================================================');
  console.log(SEED_SQL);
  console.log('============================================================');
  console.log('');
  console.log('✅ Done. You can now start the server.');
}

seedDatabase().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
