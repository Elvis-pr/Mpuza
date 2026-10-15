/**
 * MPUZA - Supabase Data Layer
 *
 * All data is stored in Supabase (via @supabase/supabase-js)
 *
 * Setup:
 *   1. Create a project at https://supabase.com/dashboard
 *   2. Copy SUPABASE_URL and SUPABASE_ANON_KEY into server/.env
 *   3. Run: node server/supabase-seed.js to populate the DB
 *
 * If Supabase is not configured, the app falls back to
 * local JSON files (server/data/) for development.
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
// Support both key names: legacy SUPABASE_ANON_KEY and the newer
// SUPABASE_PUBLISHABLE_KEY label used by Supabase's dashboard.
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

// Check if Supabase is configured
const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && supabaseUrl !== 'your-project-id.supabase.co' && supabaseAnonKey !== 'your-anon-key-here';

if (isSupabaseConfigured) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  module.exports.supabase = supabase;
} else {
  console.warn('⚠️  Supabase credentials not found. Using local JSON data source.');
}

// Load local data
const fs = require('fs');
const DATA_DIR = path.join(__dirname, 'data');

function loadData() {
  // require() first: statically traceable so Vercel bundles the JSON.
  try {
    const opportunities = require('./data/opportunities.json').opportunities || [];
    let skills = [];
    try { skills = require('./data/skills.json').skills || []; } catch {}
    return { opportunities, skills };
  } catch {}
  if (fs.existsSync(DATA_DIR)) {
    const opportunitiesFile = path.join(DATA_DIR, 'opportunities.json');
    const skillsFile = path.join(DATA_DIR, 'skills.json');
    if (fs.existsSync(opportunitiesFile)) {
      const opportunities = JSON.parse(fs.readFileSync(opportunitiesFile, 'utf8')).opportunities || [];
      const skills = fs.existsSync(skillsFile) ? JSON.parse(fs.readFileSync(skillsFile, 'utf8')).skills || [] : [];
      return { opportunities, skills };
    }
  }
  return { opportunities: [], skills: [] };
}

/**
 * True when an opportunity is based in Rwanda (Kigali + districts).
 * Checks location text and rwanda-region tags.
 */
function isRwandaOpportunity(opp = {}) {
  const loc = String(opp.location || '').toLowerCase();
  if (/rwanda|kigali|muhanga|musanze|rubavu|huye|rusizi|nyagatare|karongi|gasabo|kicukiro|nyarugenge/.test(loc)) return true;
  const tags = (opp.tags || []).map((t) => String(t).toLowerCase());
  return tags.includes('rwanda');
}

/**
 * List opportunities with optional filtering
 * Returns grouped results (internship / fulltime)
 */
async function listOpportunities({ type, q, category, region } = {}) {
  if (isSupabaseConfigured) {
    try {
      let { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .order('posted_at', { ascending: false });

      if (error) {
        console.error('❌ Supabase listOpportunities error:', error.message);
        return { success: false, message: error.message, grouped: { internship: [], fulltime: [] }, resources: [] };
      }

      let items = data || [];
      if (type && type !== 'all') {
        items = items.filter(opp => opp.type === type);
      }
      if (q && q.trim()) {
        const term = q.trim().toLowerCase();
        items = items.filter(opp =>
          opp.title?.toLowerCase().includes(term) ||
          opp.company?.toLowerCase().includes(term) ||
          opp.location?.toLowerCase().includes(term)
        );
      }
      if (category) {
        items = items.filter(opp => opp.category === category);
      }
      if (region === 'rwanda') {
        items = items.filter(isRwandaOpportunity);
      }

      const grouped = {
        internship: items.filter(opp => opp.type === 'internship'),
        fulltime: items.filter(opp => opp.type === 'fulltime'),
      };

      return { success: true, total: items.length, grouped, resources: [] };
    } catch (err) {
      console.error('❌ Supabase listOpportunities error:', err.message);
      return { success: false, message: err.message, grouped: { internship: [], fulltime: [] }, resources: [] };
    }
  } else {
    // Fallback to local JSON
    const data = loadData();
    let items = data.opportunities || [];

    if (type && type !== 'all') {
      items = items.filter(opp => opp.type === type);
    }
    if (q && q.trim()) {
      const term = q.trim().toLowerCase();
      items = items.filter(opp =>
        opp.title?.toLowerCase().includes(term) ||
        opp.company?.toLowerCase().includes(term) ||
        opp.location?.toLowerCase().includes(term)
      );
    }
    if (category) {
      items = items.filter(opp => opp.category === category);
    }
    if (region === 'rwanda') {
      items = items.filter(isRwandaOpportunity);
    }

    const grouped = {
      internship: items.filter(opp => opp.type === 'internship'),
      fulltime: items.filter(opp => opp.type === 'fulltime'),
    };

    return { success: true, total: items.length, grouped, resources: [] };
  }
}

/**
 * Get a single opportunity by ID
 */
async function getOpportunityById(id) {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, message: 'Opportunity not found' };
        }
        return { success: false, message: error.message };
      }
      return { success: true, opportunity: data };
    } catch (err) {
      return { success: false, message: err.message };
    }
  } else {
    const data = loadData();
    const opp = data.opportunities?.find(o => o.id === id);
    if (!opp) {
      return { success: false, message: 'Opportunity not found' };
    }
    return { success: true, opportunity: opp };
  }
}

/**
 * Create a new opportunity
 */
async function createOpportunity(opp) {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('opportunities')
        .insert([{ ...opp }])
        .select()
        .single();
      if (error) {
        console.error('❌ Supabase createOpportunity error:', error.message);
        return { success: false, message: error.message };
      }
      return { success: true, opportunity: data };
    } catch (err) {
      return { success: false, message: err.message };
    }
  } else {
    const data = loadData();
    const newOpp = { id: 'opp-' + Date.now(), ...opp, posted_at: new Date().toISOString() };
    data.opportunities.push(newOpp);
    return { success: true, opportunity: newOpp };
  }
}

/**
 * Update an existing opportunity
 */
async function updateOpportunity(id, updates) {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('opportunities')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, message: 'Opportunity not found' };
        }
        return { success: false, message: error.message };
      }
      return { success: true, opportunity: data };
    } catch (err) {
      return { success: false, message: err.message };
    }
  } else {
    const data = loadData();
    const idx = data.opportunities.findIndex(o => o.id === id);
    if (idx === -1) {
      return { success: false, message: 'Opportunity not found' };
    }
    data.opportunities[idx] = { ...data.opportunities[idx], ...updates };
    return { success: true, opportunity: data.opportunities[idx] };
  }
}

/**
 * Delete an opportunity
 */
async function deleteOpportunity(id) {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('opportunities').delete().eq('id', id);
      if (error) {
        console.error('❌ Supabase deleteOpportunity error:', error.message);
        return { success: false, message: error.message };
      }
      return { success: true, message: 'Opportunity deleted' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  } else {
    const data = loadData();
    const idx = data.opportunities.findIndex(o => o.id === id);
    if (idx === -1) {
      return { success: false, message: 'Opportunity not found' };
    }
    data.opportunities.splice(idx, 1);
    return { success: true, message: 'Opportunity deleted' };
  }
}

/**
 * List career resources
 */
async function listResources() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('career_resources').select('*');
      if (error) {
        console.error('❌ Supabase listResources error:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      return [];
    }
  } else {
    // Fallback to local data (require-first so Vercel bundles it)
    try { return require('./data/resources.json').resources || []; } catch {}
    const resourcesFile = path.join(DATA_DIR, 'resources.json');
    if (fs.existsSync(resourcesFile)) {
      return JSON.parse(fs.readFileSync(resourcesFile, 'utf8')).resources || [];
    }
    return [];
  }
}

module.exports = {
  supabase: isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null,
  listOpportunities,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  listResources,
};
