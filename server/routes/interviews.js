/**
 * MPUZA - Interviews API Routes
 *
 * Endpoints:
 *   GET  /api/interviews            - list user's interviews
 *   POST /api/interviews            - log an interview
 *   GET  /api/interviews/:id        - get interview detail
 *   PUT  /api/interviews/:id        - update interview feedback
 *
 * All routes use Supabase (via server/supabase.js)
 */

const express = require('express');
const router = express.Router();
const { listOpportunities, getOpportunityById } = require('../db');

// GET /api/interviews
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const profileId = req.query.profileId || req.body.profileId;
    let profile = req.body.existingProfile;
    if (!profile) {
      profile = req.query.profile;
    }

    // In production, get interviews from Supabase
    const interviews = [];
    if (profile && profile.interviews) {
      interviews.push(...profile.interviews);
    }

    // Filter by status
    let filtered = interviews;
    if (status) {
      filtered = filtered.filter(interview => interview.status === status);
    }

    // Resolve opportunity details
    const result = await Promise.all(filtered.map(async (interview) => {
      const opp = await getOpportunityById(interview.opportunity_id);
      return {
        id: interview.id,
        opportunity_id: interview.opportunity_id,
        opportunity: opp ? opp.opportunity : null,
        status: interview.status,
        interview_date: interview.interview_date,
        score: interview.score,
        feedback: interview.feedback,
        notes: interview.notes,
      };
    }));

    res.json({ success: true, interviews: result || [] });
  } catch (err) {
    console.error('❌ Interviews list error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/interviews
router.post('/', async (req, res) => {
  try {
    const { opportunity_id, interview_date, score, feedback, status } = req.body;
    if (!opportunity_id || !interview_date) {
      return res.status(400).json({ success: false, message: 'opportunity_id and interview_date required' });
    }

    const profileId = req.body.profileId || 'temp-' + Date.now();

    const interview = {
      id: 'int-' + Date.now(),
      profile_id: profileId,
      opportunity_id,
      interview_date,
      status: status || 'completed',
      score,
      feedback,
      notes: req.body.notes,
      created_at: new Date().toISOString(),
    };

    // Save to Supabase
    // In production, use a proper interviews table
    const result = await createOpportunity({ interview });
    res.status(201).json({ success: true, interview: result });
  } catch (err) {
    console.error('❌ Interview create error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/interviews/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const interview = req.body.existingInterview || {
      id,
      opportunity_id: req.query.opportunity_id,
      interview_date: req.query.interview_date,
      status: req.query.status || 'completed',
      score: req.query.score,
      feedback: req.query.feedback,
      notes: req.query.notes,
    };
    res.json({ success: true, interview });
  } catch (err) {
    console.error('❌ Interview get error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/interviews/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, score, feedback } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'status required' });
    }

    const interview = req.body.existingInterview || {
      id,
      opportunity_id: req.query.opportunity_id,
      interview_date: req.query.interview_date,
      status: req.query.currentStatus || 'completed',
      score: req.query.score,
      feedback: req.query.feedback,
      notes: req.query.notes,
    };

    interview.status = status;
    if (score) interview.score = score;
    if (feedback) interview.feedback = feedback;
    if (req.body.notes) interview.notes = req.body.notes;
    interview.updated_at = new Date().toISOString();

    res.json({ success: true, interview });
  } catch (err) {
    console.error('❌ Interview update error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
