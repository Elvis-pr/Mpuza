import React from 'react';
import { Avatar } from './Avatar';

export interface ProfileCardProps {
  name: string;
  avatar_url?: string;
  title?: string;
  company_name?: string;
  hireable?: boolean;
  profile_url: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  name,
  avatar_url,
  title,
  company_name,
  hireable,
  profile_url,
  onClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200 hover:border-primary-300"
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center space-y-1 flex-shrink-0">
          <Avatar
            src={avatar_url}
            alt={name}
            size="md"
          />
          {hireable && (
            <span className="text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
              Hiring
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 truncate">{name}</span>
            <span className="text-xs text-gray-400">{profile_url}</span>
          </div>
          {title && (
            <div className="text-sm text-gray-600 truncate">{title}</div>
          )}
          {company_name && (
            <div className="text-sm text-primary-600 font-medium truncate">{company_name}</div>
          )}
        </div>
      </div>
    </button>
  );
};
