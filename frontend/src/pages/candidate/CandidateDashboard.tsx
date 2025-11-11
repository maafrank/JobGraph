import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout';
import { Card, Button, LoadingSpinner } from '../../components/common';
import { useAuthStore } from '../../contexts/AuthContext';
import { profileService } from '../../services/profileService';
import { matchingService } from '../../services/matchingService';
import type { CandidateProfile, JobMatch, UserSkillScore } from '../../types';

export const CandidateDashboard = () => {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [skills, setSkills] = useState<UserSkillScore[]>([]);
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);

        // Fetch profile, skills, and matches in parallel
        const [profileData, skillsData, matchesData] = await Promise.all([
          profileService.getProfile().catch(() => null),
          profileService.getSkills().catch(() => []),
          matchingService.getCandidateMatches().catch(() => []),
        ]);

        setProfile(profileData);
        setSkills(skillsData);
        setMatches(matchesData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Calculate profile completion percentage
  const calculateProfileCompletion = (): number => {
    if (!profile) return 0;

    let completed = 0;
    const total = 6;

    if (profile.headline) completed++;
    if (profile.summary) completed++;
    if (profile.city && profile.state) completed++;
    if (profile.yearsOfExperience !== null) completed++;
    if (profile.education && profile.education.length > 0) completed++;
    if (profile.workExperience && profile.workExperience.length > 0) completed++;

    return Math.round((completed / total) * 100);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  const profileCompletion = calculateProfileCompletion();
  const skillsCount = skills.length;
  const matchesCount = matches.length;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.firstName}!
          </h1>
          <p className="mt-2 text-gray-600">
            Here's an overview of your job search progress
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-600">{profileCompletion}%</div>
              <div className="mt-2 text-sm text-gray-600">Profile Completion</div>
              <div className="mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/candidate/profile')}
                  className="text-primary-600 hover:text-primary-700"
                >
                  Complete Profile
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600">{skillsCount}</div>
              <div className="mt-2 text-sm text-gray-600">Skills Added</div>
              <div className="mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/candidate/skills')}
                  className="text-green-600 hover:text-green-700"
                >
                  {skillsCount === 0 ? 'Add Skills' : 'Manage Skills'}
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600">{matchesCount}</div>
              <div className="mt-2 text-sm text-gray-600">Job Matches</div>
              <div className="mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/candidate/matches')}
                  className="text-blue-600 hover:text-blue-700"
                  disabled={matchesCount === 0}
                >
                  View Matches
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card title="Quick Actions">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="primary"
              onClick={() => navigate('/candidate/profile')}
              className="w-full"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Edit Profile
            </Button>

            <Button
              variant="secondary"
              onClick={() => navigate('/candidate/skills')}
              className="w-full"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Manage Skills
            </Button>

            <Button
              variant="secondary"
              onClick={() => navigate('/candidate/matches')}
              className="w-full"
              disabled={matchesCount === 0}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              View Job Matches
            </Button>
          </div>
        </Card>

        {/* Getting Started Checklist */}
        {(profileCompletion < 100 || skillsCount === 0) && (
          <Card title="Getting Started" subtitle="Complete these steps to maximize your job search">
            <div className="space-y-4">
              {/* Step 1: Complete Profile */}
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {profileCompletion === 100 ? (
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-100">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary-100 text-primary-600 font-semibold">
                      1
                    </div>
                  )}
                </div>
                <div className="ml-4 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-900">Complete your profile</h4>
                    <span className="text-sm text-gray-500">{profileCompletion}%</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    Add your work experience, education, and personal information
                  </p>
                  {profileCompletion < 100 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/candidate/profile')}
                      className="mt-2 text-primary-600"
                    >
                      Complete Now →
                    </Button>
                  )}
                </div>
              </div>

              {/* Step 2: Add Skills */}
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {skillsCount > 0 ? (
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-100">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary-100 text-primary-600 font-semibold">
                      2
                    </div>
                  )}
                </div>
                <div className="ml-4 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-900">Add your skills</h4>
                    <span className="text-sm text-gray-500">{skillsCount} added</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    Browse our skill catalog and add skills with your proficiency scores
                  </p>
                  {skillsCount === 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/candidate/skills')}
                      className="mt-2 text-primary-600"
                    >
                      Add Skills Now →
                    </Button>
                  )}
                </div>
              </div>

              {/* Step 3: View Matches */}
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {matchesCount > 0 ? (
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-100">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-200 text-gray-500 font-semibold">
                      3
                    </div>
                  )}
                </div>
                <div className="ml-4 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-900">View your matches</h4>
                    <span className="text-sm text-gray-500">{matchesCount} matches</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    Once you add skills, employers can match you to relevant job openings
                  </p>
                  {matchesCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/candidate/matches')}
                      className="mt-2 text-primary-600"
                    >
                      View Matches →
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Recent Matches (if any) */}
        {matches.length > 0 && (
          <Card title="Recent Job Matches" subtitle="Top opportunities matched to your skills">
            <div className="space-y-4">
              {matches.slice(0, 3).map((match) => (
                <div
                  key={match.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => navigate('/candidate/matches')}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-base font-medium text-gray-900">{match.job.title}</h4>
                      <p className="mt-1 text-sm text-gray-600">{match.job.company.name}</p>
                      <p className="mt-1 text-sm text-gray-500">
                        {match.job.city}, {match.job.state}
                        {match.job.remote && ' • Remote'}
                      </p>
                    </div>
                    <div className="ml-4 flex-shrink-0 text-right">
                      <div className="text-2xl font-bold text-green-600">{Math.round(match.overallScore)}%</div>
                      <div className="text-xs text-gray-500">Match Score</div>
                    </div>
                  </div>
                </div>
              ))}
              {matches.length > 3 && (
                <Button
                  variant="ghost"
                  onClick={() => navigate('/candidate/matches')}
                  className="w-full text-primary-600"
                >
                  View All {matches.length} Matches →
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
};
