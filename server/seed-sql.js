/**
 * MPUZA - Supabase Seed: SQL Schema & Data
 *
 * This file contains the raw SQL to run against Supabase.
 * It defines the schema (tables) and seed data.
 *
 * How to use:
 *   Option 1 (Recommended): Paste this whole string into
 *     Supabase Dashboard > SQL > New Query > Run
 *
 *   Option 2 (Production): Save as a .sql migration file and use
 *     a migration tool like `supabase-migration` or `drizzle-orm`
 *     to apply it.
 *
 * If you just want to run this script directly (it will print
 * the SQL for you to paste), see server/supabase-seed.js.
 */

const SEED_SQL = `
-- ==================== OPPORTUNITIES TABLE ====================

CREATE TABLE IF NOT EXISTS opportunities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  company         text NOT NULL,
  type            text NOT NULL CHECK (type IN ('internship', 'fulltime')),
  location        text NOT NULL,
  description     text NOT NULL,
  requirements    text[] DEFAULT '{}',
  pay             text NOT NULL,
  deadline        timestamp with time zone,
  posted_at       timestamp with time zone DEFAULT NOW(),
  created_at      timestamp with time zone DEFAULT NOW()
);

CREATE INDEX idx_opportunities_id    ON opportunities(id);
CREATE INDEX idx_opportunities_type  ON opportunities(type);
CREATE INDEX idx_opportunities_company ON opportunities(company);
CREATE INDEX idx_opportunities_title ON opportunities(title);

-- ==================== CAREER RESOURCES TABLE ====================

CREATE TABLE IF NOT EXISTS career_resources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  url             text NOT NULL,
  category        text NOT NULL,
  icon            text,
  active          boolean DEFAULT true,
  created_at      timestamp with time zone DEFAULT NOW()
);

CREATE INDEX idx_resources_name  ON career_resources(name);
CREATE INDEX idx_resources_category ON career_resources(category);

-- ==================== SEED OPPORTUNITIES ====================

-- Insert 6 sample opportunities (3 internship, 3 full-time)
INSERT INTO opportunities (id, title, company, type, location, description, requirements, pay, deadline, posted_at)
VALUES
  -- --- INTERNSHIPS ---
  ('opp-1', 'Software Engineering Intern', 'TechCorp', 'internship', 'Remote',
    'Build full-stack features for a growing SaaS platform. Work with Node.js, React, and cloud services.',
    ARRAY['1+ years programming','JavaScript/TypeScript','React or Node.js']::text[], '$20-25/hr', '2026-03-01', '2026-01-15'),
  ('opp-2', 'Data Science Intern', 'DataWorks', 'internship', 'Sydney',
    'Analyze large datasets and build predictive models using Python, SQL, and ML libraries.',
    ARRAY['Python','SQL','Statistics','Machine Learning basics']::text[], '$30/hr', '2026-02-28', '2026-01-10'),
  ('opp-3', 'Marketing Intern', 'Brandify', 'internship', 'Melbourne',
    'Support digital marketing campaigns, social media, and market research for client brands.',
    ARRAY['Communication skills','Social media familiarity','Aspiring marketers']::text[], '$22/hr', '2026-03-15', '2026-01-05'),
  -- --- FULL-TIME JOBS ---
  ('opp-4', 'Junior Software Developer', 'Cloudify', 'fulltime', 'Remote',
    'Help scale a cloud infrastructure platform. Write clean, maintainable code and collaborate with a distributed team.',
    ARRAY['React/Node.js','REST APIs','Git','Problem solving']::text[], '$100k-130k', '2026-04-01', '2026-01-20'),
  ('opp-5', 'UX/UI Designer', 'DesignHub', 'fulltime', 'Brisbane',
    'Design user-centered experiences for a design-tech startup. Create wireframes, prototypes, and design systems.',
    ARRAY['Figma','User research','Prototyping','Portofolio required']::text[], '$90k-110k', '2026-03-30', '2026-01-18'),
  ('opp-6', 'Financial Analyst', 'FinEdge', 'fulltime', 'Adelaide',
    'Perform financial analysis, build models, and support investment decision-making for a mid-sized firm.',
    ARRAY['Finance degree','Excel/Models','Attention to detail']::text[], '$85k-100k', '2026-02-20', '2026-01-12')
ON CONFLICT (id) DO NOTHING;

-- ==================== SEED CAREER RESOURCES ====================

INSERT INTO career_resources (name, url, category, icon, active)
VALUES
  ('LinkedIn', 'https://linkedin.com', 'Networking', '💼', true),
  ('Indeed', 'https://indeed.com', 'Job Search', '🔍', true),
  ('Glassdoor', 'https://glassdoor.com', 'Reviews & Salaries', '📊', true),
  ('GradConnection', 'https://gradconnection.com', 'Grad Jobs', '🎓', true),
  ('Skillshare', 'https://skillshare.com', 'Learning', '📚', true),
  ('Coursera', 'https://coursera.org', 'Learning', '📚', true),
  ('LeetCode', 'https://leetcode.com', 'Coding Practice', '💻', true),
  ('GitHub', 'https://github.com', 'Development', '💻', true),
  ('AngelList (Wellfound)', 'https://wellfound.com', 'Startups', '🚀', true),
  ('Seek', 'https://seek.com.au', 'Job Search', '🔍', true)
ON CONFLICT (name) DO NOTHING;

-- ==================== APPLICATIONS TABLE (permanent tracking, Vercel-safe) ====================

-- Run this in Supabase Dashboard > SQL > New Query > Run.
-- Afterwards set SUPABASE_URL + SUPABASE_ANON_KEY in Vercel env vars.

CREATE TABLE IF NOT EXISTS applications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      text NOT NULL DEFAULT 'local-user',
  opportunity_id  text NOT NULL,
  status          text NOT NULL DEFAULT 'applied'
                  CHECK (status IN ('saved','applied','interview','offer','rejected','withdrawn')),
  notes           text DEFAULT '',
  snapshot        jsonb,
  applied_at      timestamp with time zone DEFAULT NOW(),
  updated_at      timestamp with time zone DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_profile ON applications(profile_id);
CREATE INDEX IF NOT EXISTS idx_applications_opp ON applications(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_applications_profile_opp ON applications(profile_id, opportunity_id);

-- Anon-key access (no auth yet — you chose Supabase tables after launch for auth).
-- Allows the Vercel serverless API to read/write with the anon key.
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public all" ON applications;
CREATE POLICY "public all" ON applications FOR ALL USING (true) WITH CHECK (true);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION set_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_applications_updated_at ON applications;
CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION set_applications_updated_at();

-- ==================== VERIFY SEED ====================

-- Count opportunities
SELECT 'opportunities' AS table_name, COUNT(*) AS row_count FROM opportunities
UNION ALL
SELECT 'career_resources' AS table_name, COUNT(*) FROM career_resources;
`;

module.exports = SEED_SQL;
