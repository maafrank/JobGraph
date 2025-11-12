import { Card } from '../common';
import type { CandidateProfile } from '../../types';

interface ContactInfoSectionProps {
  profile: CandidateProfile;
}

export const ContactInfoSection = ({ profile }: ContactInfoSectionProps) => {
  const displayName = profile.preferredFirstName && profile.preferredLastName
    ? `${profile.preferredFirstName} ${profile.preferredLastName}`
    : `${profile.firstName} ${profile.lastName}`;

  const hasPreferredName = profile.preferredFirstName !== profile.firstName ||
                           profile.preferredLastName !== profile.lastName;

  return (
    <Card title="Contact Information">
      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <p className="text-base text-gray-900">{displayName}</p>
          {hasPreferredName && (
            <p className="text-sm text-gray-500">
              Legal name: {profile.firstName} {profile.lastName}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <p className="text-base text-gray-900">{profile.email}</p>
        </div>

        {/* Phone */}
        {profile.phone && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <p className="text-base text-gray-900">{profile.phone}</p>
          </div>
        )}

        {!profile.phone && (
          <div className="text-sm text-gray-500 italic">
            No phone number added yet
          </div>
        )}

        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            To update your email or phone number, please visit{' '}
            <a href="/candidate/settings" className="text-primary-600 hover:text-primary-700 underline">
              Settings
            </a>
          </p>
        </div>
      </div>
    </Card>
  );
};

export default ContactInfoSection;
