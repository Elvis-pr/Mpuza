import React from 'react';

export const WhyStrip: React.FC = () => {
  return (
    <div className="why-strip">
      {whyItems.map((w) => (
        <div key={w.title} className="why-card">
          <span className="why-icon">{w.icon}</span>
          <span>
            <div className="why-title">{w.title}</div>
            <div className="why-desc">{w.desc}</div>
          </span>
        </div>
      ))}
    </div>
  );
};

const whyItems = [
  { icon: '💬', title: 'Real-time chat', desc: 'Message recruiters and peers instantly — no email ping-pong.' },
  { icon: '🎙️', title: 'Voice & video notes', desc: 'Say more than text allows: send voice notes and video intros right in the chat.' },
  { icon: '📹', title: 'Video & audio calls', desc: 'Jump into 1:1 calls from any conversation, right in your browser.' },
  { icon: '🎯', title: 'Skill-matched roles', desc: 'Opportunities ranked against your profile, Rwanda-first.' },
];