/**
 * MPUZA - Student Profile Template
 *
 * Demonstrates the data structure for a student profile.
 * This is the canonical schema that all profile-related API calls use.
 *
 * Example usage:
 *   const profile = {
 *     id: 'student-123',
 *     skills: [
 *       { name: 'JavaScript', proficiency: 'Advanced', category: 'programming' },
 *       { name: 'React', proficiency: 'Intermediate', category: 'frontend' },
 *       { name: 'Node.js', proficiency: 'Intermediate', category: 'backend' },
 *     ],
 *     year: 'second-year',
 *     location: 'Sydney',
 *     goals: 'Seeking internship opportunities in web development',
 *     linkedin_url: 'https://linkedin.com/in/student123',
 *     applications: [
 *       {
 *         id: 'app-1',
 *         opportunity_id: 'opp-1',
 *         status: 'applied',
 *         applied_at: '2026-02-01T10:00:00.000Z',
 *         notes: 'Submitted through portal'
 *       }
 *     ],
 *     interviews: [
 *       {
 *         id: 'int-1',
 *         opportunity_id: 'opp-1',
 *         interview_date: '2026-02-15T14:00:00.000Z',
 *         status: 'completed',
 *         score: 75,
 *         feedback: 'Strong on technical skills, need to improve system design'
 *       }
 *     ]
 *   };
 */

const EXAMPLE_PROFILE = {
  id: 'student-1',
  skills: [
    { name: 'JavaScript', proficiency: 'Advanced', category: 'programming', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-15T00:00:00.000Z' },
    { name: 'React', proficiency: 'Intermediate', category: 'frontend', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-15T00:00:00.000Z' },
    { name: 'Node.js', proficiency: 'Intermediate', category: 'backend', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-15T00:00:00.000Z' },
    { name: 'HTML', proficiency: 'Advanced', category: 'frontend', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-15T00:00:00.000Z' },
    { name: 'CSS', proficiency: 'Advanced', category: 'frontend', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-15T00:00:00.000Z' },
    { name: 'Git', proficiency: 'Intermediate', category: 'methodology', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-15T00:00:00.000Z' },
    { name: 'Communication', proficiency: 'Intermediate', category: 'soft-skills', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-15T00:00:00.000Z' },
    { name: 'Problem Solving', proficiency: 'Advanced', category: 'soft-skills', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-15T00:00:00.000Z' },
  ],
  year: 'second-year',
  location: 'Sydney',
  goals: 'Seeking a software engineering internship in Melbourne or remote',
  linkedin_url: 'https://linkedin.com/in/student1',
  applications: [],
  interviews: [],
};

/**
 * Generate a profile with random skills for demonstration
 */
function generateRandomProfile() {
  const profiles = [];
  const years = ['first-year', 'second-year', 'third-year', 'graduate'];
  const locations = ['Sydney', 'Melbourne', 'Brisbane', 'Adelaide', 'Remote'];
  const goals = [
    'Seeking a software engineering internship',
    'Looking for a full-time role after graduation',
    'Interested in data science and machine learning',
    'Want to build a career in product management',
    'Pursuing a design internship',
    'Exploring opportunities in marketing analytics',
  ];

  for (let i = 1; i <= 10; i++) {
    const profile = {
      id: 'student-' + i,
      skills: [],
      year: years[Math.floor(Math.random() * years.length)],
      location: locations[Math.floor(Math.random() * locations.length)],
      goals: goals[Math.floor(Math.random() * goals.length)],
      applications: [],
      interviews: [],
    };

    // Add 3-8 random skills
    const skillCount = Math.floor(Math.random() * 6) + 3;
    for (let j = 0; j < skillCount; j++) {
      const skills = EXAMPLE_PROFILE.skills || [];
      const skill = skills[Math.floor(Math.random() * skills.length)];
      const proficiency = ['Beginner', 'Intermediate', 'Advanced', 'Expert'][Math.floor(Math.random() * 4)];
      profile.skills.push({
        name: skill.name,
        proficiency,
        category: skill.category,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: new Date().toISOString(),
      });
    }

    profiles.push(profile);
  }

  return profiles;
}

module.exports = { EXAMPLE_PROFILE, generateRandomProfile };
