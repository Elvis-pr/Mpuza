/**
 * MPUZA - Skills API Routes
 *
 * Endpoints:
 *   GET  /api/skills              - list all skills
 *   GET  /api/skills/:category    - skills by category
 *   POST /api/skills              - add a skill to user profile
 *   PUT  /api/skills/:id          - update skill proficiency
 *   GET  /api/profile/skills      - get user's saved skills
 *
 * All routes use Supabase (via server/supabase.js)
 */

const express = require('express');
const router = express.Router();
const {
  listOpportunities,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
} = require('../db');
const { loadSkills, getSkillCategory, canonicalizeSkill } = require('../utils/matcher');

// GET /api/skills
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    const skills = loadSkills();
    let filtered = skills;
    if (category) {
      filtered = skills.filter(s => s.category === category);
    }
    res.json({ success: true, skills: filtered });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/skills/:category
router.get('/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const skills = loadSkills();
    const filtered = skills.filter(s => s.category === category);
    res.json({ success: true, skills: filtered, category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/skills (add skill to user profile)
router.post('/', async (req, res) => {
  try {
    const { skillName, proficiency } = req.body;
    if (!skillName || !proficiency) {
      return res.status(400).json({ success: false, message: 'skillName and proficiency are required' });
    }

    const canonical = canonicalizeSkill(skillName);
    const skillExists = loadSkills().some(s => canonicalizeSkill(s.name) === canonical);
    if (!skillExists) {
      return res.status(404).json({ success: false, message: 'Skill not found in taxonomy' });
    }

    // Find existing profile or create new
    // In production, this would use authenticated user ID
    const profileId = req.body.profileId || 'temp-' + Date.now();

    let profile = req.body.existingProfile;
    if (!profile) {
      profile = {
        id: profileId,
        skills: [],
        year: req.body.year || 'first-year',
        location: req.body.location || '',
        goals: req.body.goals || '',
      };
    }

    // Check if skill already exists
    const existingIndex = profile.skills?.findIndex(s => {
      const sCanonical = canonicalizeSkill(s.name);
      return sCanonical === canonical;
    });

    if (existingIndex !== -1) {
      // Update proficiency
      profile.skills[existingIndex].proficiency = proficiency;
      profile.skills[existingIndex].updatedAt = new Date().toISOString();
    } else {
      // Add new skill
      profile.skills.push({
        name: skillName,
        proficiency,
        category: getSkillCategory(skillName),
        createdAt: new Date().toISOString(),
      });
    }

    // Save to Supabase (in production, use authenticated user ID)
    const result = await createOpportunity({ profile });
    res.status(201).json({ success: true, profile });
  } catch (err) {
    console.error('❌ Skill add error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/skills/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { proficiency, name } = req.body;

    // Find profile
    let profile = req.body.existingProfile;
    if (!profile) {
      profile = req.body;
    }

    if (!profile) {
      return res.status(400).json({ success: false, message: 'Profile required' });
    }

    // Update skill
    const skillIndex = profile.skills?.findIndex(s => s.id === id);
    if (skillIndex === -1) {
      return res.status(404).json({ success: false, message: 'Skill not found' });
    }

    if (proficiency) {
      profile.skills[skillIndex].proficiency = proficiency;
    }
    if (name) {
      profile.skills[skillIndex].name = name;
    }
    profile.skills[skillIndex].updatedAt = new Date().toISOString();

    // Save
    const result = await updateOpportunity(id, { profile });
    res.json({ success: true, profile });
  } catch (err) {
    console.error('❌ Skill update error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/profile/skills
router.get('/profile', async (req, res) => {
  try {
    // In production, this would use authenticated user ID
    const profileId = req.query.profileId || req.body.profileId;
    let profile = req.body.existingProfile;
    if (!profile) {
      profile = req.query.profile;
    }

    if (!profile) {
      return res.json({ success: true, skills: [], profile: null });
    }

    res.json({ success: true, skills: profile.skills || [], profile: { id: profile.id, year: profile.year, location: profile.location, goals: profile.goals } });
  } catch (err) {
    console.error('❌ Profile skills error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
