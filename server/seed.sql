
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

CREATE INDEX IF NOT EXISTS idx_opportunities_id    ON opportunities(id);
CREATE INDEX IF NOT EXISTS idx_opportunities_type  ON opportunities(type);
CREATE INDEX IF NOT EXISTS idx_opportunities_company ON opportunities(company);
CREATE INDEX IF NOT EXISTS idx_opportunities_title ON opportunities(title);

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

-- Unique on name so ON CONFLICT (name) DO NOTHING dedupes on re-runs
CREATE UNIQUE INDEX IF NOT EXISTS uq_resources_name ON career_resources(name);
CREATE INDEX IF NOT EXISTS idx_resources_category ON career_resources(category);

-- ==================== SEED OPPORTUNITIES ====================

-- Insert 6 sample opportunities (3 internship, 3 full-time)
INSERT INTO opportunities (id, title, company, type, location, description, requirements, pay, deadline, posted_at)
VALUES
  -- --- INTERNSHIPS ---
  ('00000000-0000-4000-8000-000000000001', 'Software Engineering Intern', 'TechCorp', 'internship', 'Remote',
    'Build full-stack features for a growing SaaS platform. Work with Node.js, React, and cloud services.',
    ARRAY['1+ years programming','JavaScript/TypeScript','React or Node.js']::text[], '$20-25/hr', '2026-03-01', '2026-01-15'),
  ('00000000-0000-4000-8000-000000000002', 'Data Science Intern', 'DataWorks', 'internship', 'Sydney',
    'Analyze large datasets and build predictive models using Python, SQL, and ML libraries.',
    ARRAY['Python','SQL','Statistics','Machine Learning basics']::text[], '$30/hr', '2026-02-28', '2026-01-10'),
  ('00000000-0000-4000-8000-000000000003', 'Marketing Intern', 'Brandify', 'internship', 'Melbourne',
    'Support digital marketing campaigns, social media, and market research for client brands.',
    ARRAY['Communication skills','Social media familiarity','Aspiring marketers']::text[], '$22/hr', '2026-03-15', '2026-01-05'),
  -- --- FULL-TIME JOBS ---
  ('00000000-0000-4000-8000-000000000004', 'Junior Software Developer', 'Cloudify', 'fulltime', 'Remote',
    'Help scale a cloud infrastructure platform. Write clean, maintainable code and collaborate with a distributed team.',
    ARRAY['React/Node.js','REST APIs','Git','Problem solving']::text[], '$100k-130k', '2026-04-01', '2026-01-20'),
  ('00000000-0000-4000-8000-000000000005', 'UX/UI Designer', 'DesignHub', 'fulltime', 'Brisbane',
    'Design user-centered experiences for a design-tech startup. Create wireframes, prototypes, and design systems.',
    ARRAY['Figma','User research','Prototyping','Portofolio required']::text[], '$90k-110k', '2026-03-30', '2026-01-18'),
  ('00000000-0000-4000-8000-000000000006', 'Financial Analyst', 'FinEdge', 'fulltime', 'Adelaide',
    'Perform financial analysis, build models, and support investment decision-making for a mid-sized firm.',
    ARRAY['Finance degree','Excel/Models','Attention to detail']::text[], '$85k-100k', '2026-02-20', '2026-01-12')
ON CONFLICT (id) DO NOTHING;

-- ==================== SEED CAREER RESOURCES ====================

INSERT INTO career_resources (name, url, category, icon, active)
VALUES
  ('LinkedIn', 'https://linkedin.com', 'Networking', '🤝', true),
  ('Indeed', 'https://indeed.com', 'Job Search', '🧭', true),
  ('Glassdoor', 'https://glassdoor.com', 'Reviews & Salaries', '🪞', true),
  ('GradConnection', 'https://gradconnection.com', 'Grad Jobs', '🎓', true),
  ('Skillshare', 'https://skillshare.com', 'Learning', '🎨', true),
  ('Coursera', 'https://coursera.org', 'Learning', '📖', true),
  ('LeetCode', 'https://leetcode.com', 'Coding Practice', '🧩', true),
  ('GitHub', 'https://github.com', 'Development', '🐙', true),
  ('AngelList (Wellfound)', 'https://wellfound.com', 'Startups', '🚀', true),
  ('Seek', 'https://seek.com.au', 'Job Search', '🔎', true)
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

-- ==================== APPLICANT DETAILS + CV STORAGE ====================
-- Real application packages: who applied, their message, and their CV.

ALTER TABLE applications ADD COLUMN IF NOT EXISTS applicant_name  text DEFAULT '';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS applicant_email text DEFAULT '';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS applicant_phone text DEFAULT '';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS cover_letter    text DEFAULT '';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS cv_path         text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS cv_filename     text;

-- Private bucket for uploaded CVs. The server uploads with the anon key and
-- serves downloads through GET /api/applications/:id/cv as signed URLs, so
-- files are never directly public.
INSERT INTO storage.buckets (id, name, public)
VALUES ('application-docs', 'application-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon upload application-docs" ON storage.objects;
CREATE POLICY "anon upload application-docs" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'application-docs');

DROP POLICY IF EXISTS "anon read application-docs" ON storage.objects;
CREATE POLICY "anon read application-docs" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'application-docs');

-- ==================== AUTH TABLES: USERS + SESSIONS (persistent login on Vercel) ====================

-- Without these, auth falls back to per-instance memory on Vercel (users vanish
-- on cold start). Run the SQL below in Supabase, then set SUPABASE_URL +
-- SUPABASE_ANON_KEY in Vercel env vars to make registrations permanent.

CREATE TABLE IF NOT EXISTS users (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  email           text NOT NULL UNIQUE,
  salt            text NOT NULL,
  password_hash   text NOT NULL,
  created_at      timestamp with time zone DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  token           text PRIMARY KEY,
  user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      timestamp with time zone DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Anon-key access (same pattern as applications: only the server calls these).
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public all" ON users;
CREATE POLICY "public all" ON users FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public all" ON sessions;
CREATE POLICY "public all" ON sessions FOR ALL USING (true) WITH CHECK (true);

-- ==================== VERIFY SEED ====================

-- Count opportunities
SELECT 'opportunities' AS table_name, COUNT(*) AS row_count FROM opportunities
UNION ALL
SELECT 'career_resources' AS table_name, COUNT(*) FROM career_resources
UNION ALL
SELECT 'applications' AS table_name, COUNT(*) FROM applications
UNION ALL
SELECT 'users' AS table_name, COUNT(*) FROM users
UNION ALL
SELECT 'sessions' AS table_name, COUNT(*) FROM sessions;
