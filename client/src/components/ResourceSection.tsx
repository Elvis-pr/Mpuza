import React, { useState, useEffect } from 'react';
import { listResources } from '../lib/api';
import { ResourceCard } from './ResourceCard';

/**
 * ResourceSection: the Career Hub.
 * Hand-picked resources the user can explore.
 */

export const ResourceSection: React.FC = () => {
  const [resources, setResources] = useState<{ id: string; name: string; category: string; url: string; icon?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openUrl, setOpenUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listResources();
        setResources(data);
      } catch (err) {
        setError('Could not load career resources right now.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleOpen = (url: string) => {
    setOpenUrl(url);
    window.open(url, '_blank', 'noopener noreferrer');
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
      {resources.map((res) => (
        <ResourceCard key={res.id} resource={res} onOpen={handleOpen} />
      ))}

      {loading && (
        <div className="card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
          <span className="skeleton" style={{ width: '140px', height: '140px', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-3)' }} />
          <span className="skeleton" style={{ width: '200px', height: '16px', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-3)' }} />
          <span className="skeleton" style={{ width: '120px', height: '14px', borderRadius: 'var(--radius-sm)' }} />
        </div>
      )}

      {error && (
        <div className="card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
          <div className="empty-state">
            <div className="empty-icon">⚠️</div>
            <h3>{error}</h3>
            <p>{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && resources.length === 0 && (
        <div className="card" style={{ padding: 'var(--space-5)', textAlign: 'center' }}>
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <h3>No resources yet</h3>
            <p>Check back soon for more career resources.</p>
          </div>
        </div>
      )}

      {openUrl && (
        <div className="toast show" style={{ bottom: 'var(--space-6)', left: 'auto', right: 'var(--space-6)', borderColor: 'var(--color-success)' }}>
          <span>✅</span>
          <span>Your opening has been opened in a new tab.</span>
        </div>
      )}
    </div>
  );
};
