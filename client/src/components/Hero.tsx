import React from 'react';
import { useAuth } from '../lib/auth';
import { WhyStrip } from './WhyStrip';

/**
 * Hero: the first impression.
 *
 * A warm, friendly, distinct hero:
 *  - A soft, warm gradient instead of a cold flat blue
 *  - A friendly "how it works" mini-strip (Explore → Apply → Grow)
 *  - Rounded, hugging stat cards with a paper texture
 */

const stats = [
  { value: '120+', label: 'Opportunities' },
  { value: '50+', label: 'Student-led projects' },
  { value: '10+', label: 'Career hubs' },
];

const steps = [
  { icon: '🔍', title: 'Find your fit', desc: 'Search internships and full-time roles that match your skills and goals.' },
  { icon: '❤️', title: 'Match with care', desc: 'Jobs are ranked by how well they fit your experience, so you spend less time guessing.' },
  { icon: '🚀', title: 'Go get it', desc: 'Apply, prepare for interviews, and grow into the role you deserve.' },
];

export const Hero: React.FC = () => {
  const { user } = useAuth();

  return (
    <section className="hero" id="home">
      <div className="container hero-content">
        <div className="hero-text">
          <h1>Find Your <span style={{ background: 'linear-gradient(135deg, #fff 60%, #ffe5b0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Next Chapter</span></h1>
          <p>
            Your hub for campus jobs, internships, and full-time roles &mdash; plus the best career resources in one place.
            Friendly, fast, and made for students.
          </p>
          <div className="hero-actions">
            <a href="#opportunities" className="btn btn-primary btn-lg">
              Browse Opportunities
            </a>
            <a href="#career-hub" className="btn btn-outline btn-lg" style={{ borderColor: 'rgba(255,255,255,0.5)', color: 'white', background: 'rgba(255,255,255,0.1)' }}>
              Career Resources
            </a>
          </div>
        </div>

        <div className="hero-stats">
          {stats.map((s) => (
            <div key={s.label} className="hero-stat">
              <span className="stat-number">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Why Mpuza differentiator strip — only after login */}
      {user && <WhyStrip />}

      {/* How it works strip */}
      <div className="container" style={{ padding: 'var(--space-6) 0 var(--space-4)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', justifyContent: 'center' }}>
          {steps.map((s, i) => (
            <div
              key={s.title}
              style={{
                flex: '1 1 200px',
                textAlign: 'center',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4)',
              }}
            >
              <div style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-2)' }}>{s.icon}</div>
              <div style={{ fontWeight: 800, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>{s.title}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>{s.desc}</div>
              {i < steps.length - 1 && (
                <div
                  style={{
                    position: 'absolute',
                    right: '100%',
                    top: '50%',
                    width: '40px',
                    height: '2px',
                    background: 'var(--color-primary-300)',
                    marginTop: '12px',
                    marginRight: '16px',
                    opacity: 0.6,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
