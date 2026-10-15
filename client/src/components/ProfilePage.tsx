import React, { useEffect, useState } from 'react';
import { Avatar, ContactSection, CompanyBadge } from './Avatar';

export interface Profile {
  id: string;
  name: string;
  avatar_url?: string;
  title?: string;
  company_id?: string;
  company_name?: string;
  hireable?: boolean;
  contacts?: Record<string, string>;
  created_at?: string;
  profile_url?: string;
  skills?: string[];
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  linkedin?: string;
  twitter?: string;
  github?: string;
  website?: string;
}

export const ProfilePage: React.FC<{ profileId: string }> = ({ profileId }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/profiles/${profileId}?showHidden=true`);
        const data = await res.json();
        if (data.success) {
          setProfile(data.profile);
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [profileId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-gray-500">Loading profile...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Profile not found</h2>
        <p className="text-gray-500 mt-2">This profile doesn't exist or you don't have access to it.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <Avatar
              src={profile.avatar_url}
              alt={profile.name}
              size="lg"
            />
            <button className="text-sm text-primary-600 hover:underline">
              Edit profile
            </button>
          </div>

          {/* Name & Title */}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
            {(profile.title || profile.company_name) && (
              <div className="mt-2">
                <CompanyBadge
                  name={profile.company_name || ''}
                  hireable={profile.hireable}
                  avatar={profile.avatar_url}
                />
              </div>
            )}
            {profile.title && (
              <p className="text-gray-600 mt-1">{profile.title}</p>
            )}

            {/* Connect button */}
            <button className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium">
              Connect
            </button>
          </div>
        </div>
      </div>

      {/* About / Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">About</h2>
        <p className="text-gray-600">
          {profile.title
            ? `${profile.title} at ${profile.company_name || 'your company'}`
            : profile.company_name
              ? `Founder at ${profile.company_name}`
              : 'Open to work and connecting with great people.'}
        </p>
      </div>

      {/* Contact Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact info</h2>
        <ContactSection
          contacts={profile.contacts || {}}
          expanded={expanded}
          onToggle={() => setExpanded(!expanded)}
        />
      </div>

      {/* Company / Opportunities */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {profile.company_name ? 'Company' : 'Hireable'}
        </h2>
        <div className="flex flex-wrap gap-3">
          {profile.company_name && (
            <CompanyBadge
              name={profile.company_name}
              hireable={profile.hireable}
              avatar={profile.avatar_url}
            />
          )}
          {profile.hireable && (
            <span className="px-3 py-1 text-sm font-medium bg-green-100 text-green-800 rounded-full">
              Open to hiring
            </span>
          )}
        </div>
        {profile.title && (
          <p className="text-sm text-gray-600 mt-2">{profile.title}</p>
        )}
      </div>

      {/* Opportunities posted by this profile */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Opportunities from {profile.company_name || 'this profile'}
        </h2>
        <div className="space-y-3">
          {/* Placeholder for opportunities */}
          <div className="text-gray-500 text-center py-8">
            Loading opportunities...
          </div>
        </div>
      </div>
    </div>
  );
};
