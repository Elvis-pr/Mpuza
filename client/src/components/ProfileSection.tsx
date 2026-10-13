import React from 'react';

export interface StudentProfileForm {
  skills: { name: string; proficiency: string; category: string }[];
  year: string;
  location: string;
}

const YEARS = ['first-year', 'second-year', 'third-year', 'fourth-year', 'graduate'];

const SKILL_SUGGESTIONS = [
  'JavaScript', 'Python', 'React', 'Node.js', 'Communication',
  'Teamwork', 'Problem-solving', 'Data Analysis', 'UI/UX', 'Git',
];

const PROFILE_KEY = 'mpuza-student-profile';

export function loadProfile(): StudentProfileForm {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p.skills)) return { skills: p.skills, year: p.year || 'second-year', location: p.location || '' };
    }
  } catch {}
  return {
    skills: [
      { name: 'JavaScript', proficiency: 'Intermediate', category: 'programming' },
      { name: 'Communication', proficiency: 'Intermediate', category: 'soft-skills' },
    ],
    year: 'second-year',
    location: '',
  };
}

export function saveProfile(p: StudentProfileForm) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
}

export const ProfileSection: React.FC<{ onChange?: (p: StudentProfileForm) => void }> = ({ onChange }) => {
  const [open, setOpen] = React.useState(false);
  const [profile, setProfile] = React.useState<StudentProfileForm>(() => loadProfile());
  const [skillInput, setSkillInput] = React.useState('');

  const update = (next: StudentProfileForm) => {
    setProfile(next); saveProfile(next); onChange?.(next);
  };

  const addSkill = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    if (profile.skills.some((s) => s.name.toLowerCase() === clean.toLowerCase())) return;
    update({ ...profile, skills: [...profile.skills, { name: clean, proficiency: 'Beginner', category: 'other' }] });
    setSkillInput('');
  };

  const removeSkill = (name: string) => {
    update({ ...profile, skills: profile.skills.filter((s) => s.name !== name) });
  };

  const setProficiency = (name: string, proficiency: string) => {
    update({ ...profile, skills: profile.skills.map((s) => (s.name === name ? { ...s, proficiency } : s)) });
  };

  return (
    <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div>
          <strong>👤 My profile</strong>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            {profile.skills.length} skills · {profile.year}{profile.location ? ` · ${profile.location}` : ''}
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'Done' : 'Edit profile'}
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 'var(--space-4)', display: 'grid', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 160px' }}>
              <label htmlFor="profile-year">Year</label>
              <select id="profile-year" value={profile.year} onChange={(e) => update({ ...profile, year: e.target.value })}>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div style={{ flex: '2 1 200px' }}>
              <label htmlFor="profile-location">Location</label>
              <input id="profile-location" placeholder="e.g. Kigali, Remote" value={profile.location}
                onChange={(e) => update({ ...profile, location: e.target.value })} />
            </div>
          </div>
          <div>
            <label>Skills</label>
            <div className="chips" style={{ marginTop: 0, marginBottom: 'var(--space-2)' }}>
              {profile.skills.map((s) => (
                <span key={s.name} className="chip active" style={{ cursor: 'default' }}>
                  {s.name} · {s.proficiency}
                  <select value={s.proficiency} onChange={(e) => setProficiency(s.name, e.target.value)}
                    aria-label={`${s.name} proficiency`}
                    style={{ width: 'auto', padding: '2px 6px', fontSize: 'var(--text-xs)', marginLeft: 4 }}>
                    {['Beginner', 'Intermediate', 'Advanced'].map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button type="button" onClick={() => removeSkill(s.name)} aria-label={`Remove ${s.name}`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: '0 0 0 4px' }}>✕</button>
                </span>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); addSkill(skillInput); }} style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input placeholder="Add a skill, e.g. Figma" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} aria-label="Add a skill" />
              <button className="btn btn-secondary btn-sm" type="submit">Add</button>
            </form>
            <div className="chips">
              {SKILL_SUGGESTIONS.filter((s) => !profile.skills.some((p) => p.name.toLowerCase() === s.toLowerCase())).slice(0, 6).map((s) => (
                <button key={s} type="button" className="chip" onClick={() => addSkill(s)}>+ {s}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
