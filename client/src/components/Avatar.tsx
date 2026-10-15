import React from 'react';

/** Profile picture component with fallback initials */
export const Avatar: React.FC<{ src?: string; alt: string; size?: 'sm' | 'md' | 'lg'; fallbackText?: string }> = ({ src, alt, size = 'md', fallbackText = '??' }) => {
  const sizeClass = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-20 h-20 text-lg',
  };

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${sizeClass[size]} rounded-full object-cover border-2 border-white shadow-md`}
        loading="lazy"
      />
    );
  }

  // Fallback: initials in a colored circle
  const initials = alt
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={`${sizeClass[size]} rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br from-primary-500 to-primary-700 border-2 border-white shadow-md`}
      title={alt}
    >
      {fallbackText || initials || fallbackText}
    </div>
  );
};

/** Contact info row - shown when expanded */
export const ContactRow: React.FC<{ label: string; value: string; icon?: string }> = ({ label, value, icon }) => (
  <div className="flex items-start gap-2">
    {icon && <span className="text-sm text-primary-600 mt-0.5">{icon}</span>}
    <div>
      <div className="text-xs text-gray-500 font-medium">{label}</div>
      <div className="text-sm text-gray-900 break-all">{value}</div>
    </div>
  </div>
);

/** Expandable contact info section */
export const ContactSection: React.FC<{
  contacts: Record<string, string>;
  expanded: boolean;
  onToggle: () => void;
}> = ({ contacts, expanded, onToggle }) => {
  const visibleContacts = [
    { label: 'Email', value: contacts.email || '—', icon: '✉️' },
    { label: 'Phone', value: contacts.phone || '—', icon: '📱' },
    { label: 'LinkedIn', value: contacts.linkedin || '—', icon: '💼' },
    { label: 'Twitter', value: contacts.twitter || '—', icon: '🐦' },
    { label: 'GitHub', value: contacts.github || '—', icon: '🐙' },
    { label: 'Website', value: contacts.website || '—', icon: '🌐' },
  ];

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full text-sm text-gray-600 hover:text-primary-600 transition-colors"
      >
        <span>Contact info</span>
        <span className="text-primary-600 font-medium">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {visibleContacts.map((c) => (
            <ContactRow key={c.label} {...c} />
          ))}
        </div>
      )}
    </div>
  );
};

/** Company badge component */
export const CompanyBadge: React.FC<{ name: string; hireable?: boolean; avatar?: string }> = ({ name, hireable, avatar }) => (
  <div className="flex items-center gap-2">
    {avatar && <img src={avatar} alt={name} className="w-6 h-6 rounded-full object-cover" />}
    <span className="text-sm font-semibold text-gray-900">{name}</span>
    {hireable && (
      <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
        Hiring
      </span>
    )}
  </div>
);
