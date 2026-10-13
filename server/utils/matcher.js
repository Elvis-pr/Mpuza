/**
 * MPUZA - Skill Matching Engine
 *
 * Matches opportunities to student profiles based on:
 *   1. Hard skills (exact match with opportunity requirements)
 *   2. Soft skills (partial match - transferable)
 *   3. Category alignment (skill category matches opportunity category)
 *   4. Bonus factors (location, type, recency)
 *
 * Matching algorithm:
 *   - Each opportunity has requirements (skill names)
 *   - Student profile has skills (names + proficiency levels)
 *   - Score = sum of matched skill weights + category bonus
 *   - Higher score = better match
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

/**
 * Load skills from JSON
 */
function loadSkills() {
  try { return require('../data/skills.json').skills || []; } catch {}
  const filePath = path.join(DATA_DIR, 'skills.json');
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')).skills || [];
  }
  return [];
}

/**
 * Load opportunities from JSON
 */
function loadOpportunities() {
  try { return require('../data/opportunities.json').opportunities || []; } catch {}
  const filePath = path.join(DATA_DIR, 'opportunities.json');
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')).opportunities || [];
  }
  return [];
}

/**
 * Check if a skill exists in the skill taxonomy
 */
function isKnownSkill(skillName) {
  const skills = loadSkills();
  return skills.some(s => s.name.toLowerCase() === skillName.toLowerCase());
}

/**
 * Get skill category from taxonomy
 */
function getSkillCategory(skillName) {
  const skills = loadSkills();
  const skill = skills.find(s => s.name.toLowerCase() === skillName.toLowerCase());
  return skill ? skill.category : null;
}

/**
 * Resolve skill name to canonical form
 * Handles common variations (e.g., 'React.js' -> 'React')
 */
function canonicalizeSkill(skillName) {
  const name = skillName.trim().toLowerCase();
  const mappings = {
    'react.js': 'react',
    'react native': 'react',
    'react native (rn)': 'react',
    'node.js': 'node',
    'node.js (nodejs)': 'node',
    'ui/ux': 'ui-ux',
    'ui/ux design': 'ui-ux',
    'user experience': 'communication',
    'communication skills': 'communication',
    'problem solving': 'problem-solving',
    'problem solving skills': 'problem-solving',
    'data analysis': 'data-analysis',
    'data analysis (da)': 'data-analysis',
    'machine learning': 'ml',
    'machine learning (ml)': 'ml',
    'artificial intelligence': 'ml',
    'ai': 'ml',
    'full stack': 'full-stack',
    'full-stack': 'full-stack',
    'full stack dev': 'full-stack',
  };
  return mappings[name] || name;
}

/**
 * Calculate compatibility score between a student profile and an opportunity
 */
function calculateMatchScore(studentProfile, opportunity) {
  if (!studentProfile || !opportunity) return null;

  const matchedSkills = [];
  const unmatchedRequirements = [];
  let score = 0;

  const requirements = opportunity.requirements || [];
  const studentSkills = studentProfile.skills || [];

  for (const req of requirements) {
    const canonical = canonicalizeSkill(req);
    const matchingSkill = studentSkills.find(s => {
      const studentCanonical = canonicalizeSkill(s.name);
      return studentCanonical === canonical;
    });

    if (matchingSkill) {
      const proficiency = matchingSkill.proficiency || 'Intermediate';
      let proficiencyBonus = 0;
      if (proficiency === 'Expert') proficiencyBonus = 30;
      else if (proficiency === 'Advanced') proficiencyBonus = 20;
      else if (proficiency === 'Intermediate') proficiencyBonus = 10;
      else if (proficiency === 'Beginner') proficiencyBonus = 2;

      matchedSkills.push({
        name: req,
        proficiency: proficiency,
        bonus: proficiencyBonus,
      });
      score += proficiencyBonus;
    } else {
      unmatchedRequirements.push(req);
    }
  }

  const studentCategories = new Set(studentSkills.map(s => canonicalizeSkill(s.name)));
  const oppCategory = opportunity.category || 'other';
  const oppCategories = {
    'Engineering': ['programming', 'backend', 'frontend', 'full-stack', 'mobile', 'development'],
    'Data': ['data', 'programming', 'backend', 'frontend'],
    'Design': ['design', 'frontend', 'ui-ux'],
    'Marketing': ['soft-skills', 'digital'],
    'Finance': ['business', 'data'],
    'Product': ['methodology', 'soft-skills', 'data'],
    'Business': ['business', 'management'],
    'Mobile': ['mobile', 'programming', 'frontend'],
    'Other': [],
  };

  const relevantStudentCategories = oppCategories[oppCategory] || [];
  const hasCategoryMatch = relevantStudentCategories.some(cat => studentCategories.has(cat));
  if (hasCategoryMatch) {
    score += 10;
  }

  const softSkillNameMap = {
    'communication': 'communication',
    'communication skills': 'communication',
    'problem solving': 'problem-solving',
    'problem solving skills': 'problem-solving',
    'team leadership': 'team-leadership',
    'team leadership skills': 'team-leadership',
    'project management': 'project-management',
    'project management skills': 'project-management',
    'attention to detail': 'attention-to-detail',
    'collaboration': 'communication',
  };

  for (const req of requirements) {
    const canonical = canonicalizeSkill(req);
    const mapKey = softSkillNameMap[canonical] || softSkillNameMap[canonical + 's'] || softSkillNameMap[canonical + ' skills'];
    if (mapKey) {
      const matchingSoft = studentSkills.find(s => {
        const studentCanonical = canonicalizeSkill(s.name);
        return studentCanonical === mapKey;
      });
      if (matchingSoft) {
        score += 8;
      }
    }
  }

  const studentYear = studentProfile.year || 'first-year';
  const oppType = opportunity.type || 'internship';
  let typeBonus = 0;
  if (oppType === 'internship') {
    typeBonus = studentYear === 'first-year' || studentYear === 'second-year' ? 5 : 0;
  } else if (oppType === 'fulltime') {
    typeBonus = studentYear === 'third-year' || studentYear === 'fourth-year' || studentYear === 'graduate' ? 5 : 0;
  }
  score += typeBonus;

  const now = new Date();
  const postedAt = new Date(opportunity.posted_at || opportunity.postedAt || '');
  const daysSincePosted = (now - postedAt) / (1000 * 60 * 60 * 24);
  if (daysSincePosted <= 30) {
    score += 5;
  } else if (daysSincePosted <= 60) {
    score += 3;
  }

  const location = opportunity.location || '';
  const studentLocation = studentProfile.location || '';
  if (location && studentLocation && location.toLowerCase().includes(studentLocation.toLowerCase())) {
    score += 5;
  }

  score = Math.min(100, score);

  return {
    score,
    matchedSkills,
    unmatchedRequirements,
    categoryBonus: hasCategoryMatch ? 10 : 0,
    typeBonus,
    locationBonus: location && studentLocation ? 5 : 0,
    recencyBonus: daysSincePosted <= 60 ? (daysSincePosted <= 30 ? 5 : 3) : 0,
  };
}

/**
 * Match opportunities against a student profile
 */
function matchOpportunities(studentProfile, opportunities, options = {}) {
  const list = Array.isArray(opportunities) ? opportunities : (options.opportunities || loadOpportunities());
  if (!studentProfile) {
    return list.map(opp => ({
      opportunity: opp,
      match: {
        score: 0,
        matchedSkills: [],
        unmatchedRequirements: opp.requirements || [],
        categoryBonus: 0,
        typeBonus: 0,
        locationBonus: 0,
        recencyBonus: 0,
      },
    }));
  }

  const scored = list.map(opp => ({
    opportunity: opp,
    match: calculateMatchScore(studentProfile, opp),
  }));

  scored.sort((a, b) => (b.match.score || 0) - (a.match.score || 0));

  return scored.map(({ opportunity, match }) => ({
    opportunity,
    match,
  }));
}

/**
 * Get matching statistics for a profile
 */
function getMatchStats(studentProfile, opportunities) {
  const matched = matchOpportunities(studentProfile, opportunities, { opportunities });
  const total = matched.length;
  const top3 = matched.slice(0, 3);
  const top1 = matched[0] || {};
  const avgScore = matched.reduce((sum, m) => sum + (m.match.score || 0), 0) / Math.max(total, 1);

  return {
    totalOpportunities: total,
    top3,
    top1,
    avgScore: Math.round(avgScore * 10) / 10,
    matchesAbove50: matched.filter(m => (m.match.score || 0) >= 50).length,
    neverMatched: matched.filter(m => (m.match.score || 0) === 0).length,
  };
}

module.exports = {
  loadSkills,
  loadOpportunities,
  isKnownSkill,
  getSkillCategory,
  canonicalizeSkill,
  calculateMatchScore,
  matchOpportunities,
  getMatchStats,
};
