import React from 'react';
import type { CareerResource } from '../types';

export interface ResourceCardProps {
  resource: CareerResource;
  onOpen: (url: string) => void;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({ resource, onOpen }) => {
  return (
    <a
      className="res-card"
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onOpen(resource.url)}
    >
      <div className="res-card-icon" style={{ background: 'var(--color-secondary-100)', color: 'var(--color-secondary-600)' }}>
        {resource.icon ?? '📚'}
      </div>
      <div className="res-card-body">
        <div className="res-card-name">{resource.name}</div>
        <div className="res-card-category">{resource.category}</div>
      </div>
    </a>
  );
};
