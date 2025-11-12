import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { matchingService, type RankedCandidate } from '../../services/matchingService';
import { Button, Card, LoadingSpinner, Modal, useToast } from '../../components/common';

const CandidateMatchesPage = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [jobTitle, setJobTitle] = useState('');
  const [candidates, setCandidates] = useState<RankedCandidate[]>([]);
  const [contactingCandidateId, setContactingCandidateId] = useState<string | null>(null);

  // Filter state
  const [filterTab, setFilterTab] = useState<'all' | 'matched' | 'applied' | 'both'>('all');

  // Application details modal state
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [applicationDetails, setApplicationDetails] = useState<any>(null);
  const [loadingApplication, setLoadingApplication] = useState(false);
  const [updatingApplicationStatus, setUpdatingApplicationStatus] = useState(false);

  useEffect(() => {
    if (jobId) {
      fetchCandidates();
    }
  }, [jobId]);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const data = await matchingService.getJobCandidates(jobId!);
      setJobTitle(data.jobTitle);

      // Debug: Check for duplicate matchIds in API response
      const matchIds = data.candidates.map(c => c.matchId);
      const uniqueMatchIds = new Set(matchIds);
      if (matchIds.length !== uniqueMatchIds.size) {
        console.warn('⚠️ API returned duplicate candidates:', {
          total: matchIds.length,
          unique: uniqueMatchIds.size,
          duplicates: matchIds.filter((id, index) => matchIds.indexOf(id) !== index)
        });
      }

      setCandidates(data.candidates);
    } catch (error: any) {
      console.error('Error fetching candidates:', error);
      toast.error('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  };

  const handleContactCandidate = async (matchId: string) => {
    setContactingCandidateId(matchId);
    try {
      await matchingService.contactCandidate(matchId);
      toast.success('Candidate contacted successfully');
      fetchCandidates(); // Refresh to show updated status
    } catch (error: any) {
      console.error('Error contacting candidate:', error);
      toast.error('Failed to contact candidate');
    } finally {
      setContactingCandidateId(null);
    }
  };

  const handleUpdateStatus = async (matchId: string, newStatus: string) => {
    try {
      await matchingService.updateMatchStatus(matchId, newStatus);
      toast.success(`Match status updated to ${newStatus}`);
      fetchCandidates(); // Refresh to show updated status
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleViewApplication = async (applicationId: string) => {
    setSelectedApplicationId(applicationId);
    setIsApplicationModalOpen(true);
    setLoadingApplication(true);

    try {
      const details = await matchingService.getApplicationDetails(applicationId);
      setApplicationDetails(details);
    } catch (error: any) {
      console.error('Error fetching application:', error);
      toast.error('Failed to load application details');
      setIsApplicationModalOpen(false);
    } finally {
      setLoadingApplication(false);
    }
  };

  const handleDownloadResume = async (userId: string, fileName: string) => {
    try {
      await matchingService.downloadCandidateResume(userId, fileName);
      toast.success('Resume downloaded successfully');
    } catch (error: any) {
      console.error('Error downloading resume:', error);
      if (error.response?.status === 403) {
        toast.error('You do not have access to this resume');
      } else {
        toast.error('Failed to download resume');
      }
    }
  };

  const handleUpdateApplicationStatus = async (newStatus: string) => {
    if (!selectedApplicationId) return;

    setUpdatingApplicationStatus(true);
    try {
      await matchingService.updateApplicationStatus(selectedApplicationId, newStatus);
      toast.success(`Application status updated to ${newStatus.replace('_', ' ')}`);

      // Update local state
      if (applicationDetails) {
        setApplicationDetails({
          ...applicationDetails,
          status: newStatus,
        });
      }

      // Refresh candidates list
      fetchCandidates();
    } catch (error: any) {
      console.error('Error updating application status:', error);
      toast.error('Failed to update application status');
    } finally {
      setUpdatingApplicationStatus(false);
    }
  };

  // Filter candidates based on selected tab
  const filteredCandidates = candidates
    .filter((candidate) => {
      switch (filterTab) {
        case 'matched':
          return !candidate.hasApplied; // Only matched, not applied
        case 'applied':
          return candidate.hasApplied; // Only applied
        case 'both':
          return candidate.hasApplied; // Applied (same as 'applied')
        case 'all':
        default:
          return true; // All candidates
      }
    })
    // Deduplicate by matchId to prevent duplicate key warnings
    .filter((candidate, index, self) =>
      index === self.findIndex((c) => c.matchId === candidate.matchId)
    );

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 90) return 'bg-green-100';
    if (score >= 80) return 'bg-blue-100';
    if (score >= 70) return 'bg-yellow-100';
    return 'bg-gray-100';
  };

  const getStatusBadgeColor = (status: string): string => {
    switch (status) {
      case 'matched':
        return 'bg-blue-100 text-blue-800';
      case 'viewed':
        return 'bg-purple-100 text-purple-800';
      case 'contacted':
        return 'bg-yellow-100 text-yellow-800';
      case 'shortlisted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'hired':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getApplicationStatusBadgeColor = (status: string): string => {
    switch (status) {
      case 'submitted':
        return 'bg-blue-100 text-blue-800';
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800';
      case 'interviewing':
        return 'bg-purple-100 text-purple-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'withdrawn':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatApplicationStatus = (status: string): string => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" onClick={() => navigate('/employer/jobs')} className="mb-4">
          ← Back to Jobs
        </Button>
        <h1 className="text-3xl font-bold mb-2">Candidates</h1>
        <p className="text-gray-600">
          Job: <span className="font-medium">{jobTitle}</span>
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {candidates.length} total • {candidates.filter(c => c.hasApplied).length} applied
        </p>
      </div>

      {/* Filter Tabs */}
      {candidates.length > 0 && (
        <Card className="mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterTab === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({candidates.length})
            </button>
            <button
              onClick={() => setFilterTab('applied')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterTab === 'applied'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Applied ({candidates.filter(c => c.hasApplied).length})
            </button>
            <button
              onClick={() => setFilterTab('matched')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterTab === 'matched'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Matched Only ({candidates.filter(c => !c.hasApplied).length})
            </button>
          </div>
        </Card>
      )}

      {/* Candidates List */}
      {candidates.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No candidates matched yet</p>
            <p className="text-sm text-gray-400 mb-6">
              Click "Calculate Matches" on the job management page to find qualified candidates
            </p>
            <Button onClick={() => navigate('/employer/jobs')}>
              Go to Job Management
            </Button>
          </div>
        </Card>
      ) : filteredCandidates.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500">No candidates match this filter</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredCandidates.map((candidate) => (
            <Card key={candidate.matchId}>
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Left: Candidate Info */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">
                          {candidate.firstName} {candidate.lastName}
                        </h3>
                        <span className="text-2xl font-bold">#{candidate.rank}</span>
                      </div>
                      {candidate.profile.headline && (
                        <p className="text-gray-700 mb-1">{candidate.profile.headline}</p>
                      )}
                      <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                        {candidate.profile.city && candidate.profile.state && (
                          <span>📍 {candidate.profile.city}, {candidate.profile.state}</span>
                        )}
                        {candidate.profile.yearsOfExperience && (
                          <span>• {candidate.profile.yearsOfExperience} years experience</span>
                        )}
                        {candidate.profile.remotePreference && (
                          <span>• {candidate.profile.remotePreference}</span>
                        )}
                      </div>
                    </div>

                    {/* Match Score Badge */}
                    <div className={`px-4 py-2 rounded-lg ${getScoreBgColor(candidate.overallScore)}`}>
                      <div className={`text-3xl font-bold ${getScoreColor(candidate.overallScore)}`}>
                        {candidate.overallScore.toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-600 text-center">Match</div>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="mb-4 flex flex-wrap gap-2">
                    {/* Application Badge */}
                    {candidate.hasApplied && (
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getApplicationStatusBadgeColor(candidate.applicationStatus!)}`}>
                        📝 {formatApplicationStatus(candidate.applicationStatus!)}
                      </span>
                    )}

                    {/* Match Status Badge */}
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(candidate.status)}`}>
                      🎯 {candidate.status.toUpperCase()}
                    </span>

                    {/* Source Badge */}
                    {candidate.hasApplied && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {candidate.source === 'both' ? '✓ Applied & Matched' : '✓ Applied'}
                      </span>
                    )}
                  </div>

                  {/* Dates */}
                  <div className="mb-3 text-xs text-gray-500 space-y-1">
                    {candidate.hasApplied && candidate.appliedAt && (
                      <div>📅 Applied on {formatDate(candidate.appliedAt)}</div>
                    )}
                    {candidate.contactedAt && (
                      <div>📞 Contacted on {formatDate(candidate.contactedAt)}</div>
                    )}
                    {candidate.hasApplied && candidate.applicationReviewedAt && (
                      <div>👁️ Reviewed on {formatDate(candidate.applicationReviewedAt)}</div>
                    )}
                  </div>

                  {/* Skills Breakdown */}
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Skill Match Breakdown</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {candidate.skillBreakdown.map((skill, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">
                            {skill.skillName}
                            {skill.required && <span className="text-red-500 ml-1">*</span>}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${skill.meetsThreshold ? 'text-green-600' : 'text-red-600'}`}>
                              {skill.candidateScore}
                            </span>
                            <span className="text-gray-400">/</span>
                            <span className="text-gray-500">{skill.minimumScore}</span>
                            {skill.meetsThreshold ? (
                              <span className="text-green-500">✓</span>
                            ) : (
                              <span className="text-red-500">✗</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">* Required skill</p>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="lg:w-64 flex flex-col gap-2">
                  {/* View Application Button (if applied) */}
                  {candidate.hasApplied && candidate.applicationId && (
                    <Button
                      variant="primary"
                      onClick={() => handleViewApplication(candidate.applicationId!)}
                      size="sm"
                    >
                      📄 View Application
                    </Button>
                  )}

                  {/* Download Resume Button (if shared) */}
                  {candidate.resumeShared && candidate.resumeFileName && (
                    <Button
                      variant="secondary"
                      onClick={() => handleDownloadResume(candidate.userId, candidate.resumeFileName!)}
                      size="sm"
                    >
                      📎 Download Resume
                    </Button>
                  )}

                  {/* Resume Not Available Message */}
                  {candidate.hasResume && !candidate.resumeShared && (
                    <div className="text-xs text-gray-500 italic px-2 py-1 bg-gray-50 rounded">
                      Resume not yet shared
                    </div>
                  )}

                  {/* Contact Candidate Button */}
                  {candidate.status === 'matched' && (
                    <Button
                      onClick={() => handleContactCandidate(candidate.matchId)}
                      disabled={contactingCandidateId === candidate.matchId}
                      size="sm"
                    >
                      {contactingCandidateId === candidate.matchId ? 'Contacting...' : 'Contact Candidate'}
                    </Button>
                  )}

                  {/* Match Status Update Dropdown */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Match Status:
                    </label>
                    <select
                      value={candidate.status}
                      onChange={(e) => handleUpdateStatus(candidate.matchId, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="matched">Matched</option>
                      <option value="viewed">Viewed</option>
                      <option value="contacted">Contacted</option>
                      <option value="shortlisted">Shortlisted</option>
                      <option value="rejected">Rejected</option>
                      <option value="hired">Hired</option>
                    </select>
                  </div>

                  <div className="text-xs text-gray-500">
                    Matched on {formatDate(candidate.createdAt)}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Application Details Modal */}
      <Modal
        isOpen={isApplicationModalOpen}
        onClose={() => {
          setIsApplicationModalOpen(false);
          setSelectedApplicationId(null);
          setApplicationDetails(null);
        }}
        title="Application Details"
        size="lg"
      >
        {loadingApplication ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : applicationDetails ? (
          <div className="space-y-6">
            {/* Candidate Info */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-xl font-bold text-gray-900 mb-1">
                {applicationDetails.candidate.firstName} {applicationDetails.candidate.lastName}
              </h3>
              <p className="text-gray-700 mb-2">{applicationDetails.candidate.email}</p>
              {applicationDetails.candidate.profile.headline && (
                <p className="text-gray-600 text-sm mb-2">{applicationDetails.candidate.profile.headline}</p>
              )}
              <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                {applicationDetails.candidate.profile.city && (
                  <span>📍 {applicationDetails.candidate.profile.city}, {applicationDetails.candidate.profile.state}</span>
                )}
                {applicationDetails.candidate.profile.yearsOfExperience && (
                  <span>• {applicationDetails.candidate.profile.yearsOfExperience} years experience</span>
                )}
                {applicationDetails.candidate.profile.remotePreference && (
                  <span>• {applicationDetails.candidate.profile.remotePreference}</span>
                )}
              </div>
            </div>

            {/* Application Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Application Status
              </label>
              <select
                value={applicationDetails.status}
                onChange={(e) => handleUpdateApplicationStatus(e.target.value)}
                disabled={updatingApplicationStatus}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="interviewing">Interviewing</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Match Score (if available) */}
            {applicationDetails.matchScore && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Match Score</p>
                    <p className="text-xs text-gray-500">Based on skills and profile</p>
                  </div>
                  <div className={`text-3xl font-bold ${applicationDetails.matchScore >= 80 ? 'text-green-600' : applicationDetails.matchScore >= 60 ? 'text-blue-600' : 'text-yellow-600'}`}>
                    {applicationDetails.matchScore.toFixed(0)}%
                  </div>
                </div>
                {applicationDetails.matchRank && (
                  <p className="text-xs text-gray-500 mt-2">Ranked #{applicationDetails.matchRank} for this position</p>
                )}
              </div>
            )}

            {/* Cover Letter */}
            {applicationDetails.coverLetter && (
              <div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">Cover Letter</h4>
                <div className="p-4 bg-gray-50 rounded-lg max-h-64 overflow-y-auto">
                  <p className="text-gray-700 whitespace-pre-wrap">{applicationDetails.coverLetter}</p>
                </div>
              </div>
            )}

            {/* Candidate Profile Summary */}
            {applicationDetails.candidate.profile.summary && (
              <div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">Profile Summary</h4>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-700 whitespace-pre-wrap">{applicationDetails.candidate.profile.summary}</p>
                </div>
              </div>
            )}

            {/* Skill Breakdown (if available) */}
            {applicationDetails.skillBreakdown && applicationDetails.skillBreakdown.length > 0 && (
              <div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">Skill Match Breakdown</h4>
                <div className="space-y-2">
                  {applicationDetails.skillBreakdown.map((skill: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{skill.skillName}</span>
                        {skill.required && <span className="text-xs text-red-600 font-medium">Required</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${skill.meetsThreshold ? 'text-green-600' : 'text-red-600'}`}>
                          {skill.candidateScore}
                        </span>
                        <span className="text-gray-400">/</span>
                        <span className="text-gray-600">{skill.minimumScore}</span>
                        {skill.meetsThreshold ? (
                          <span className="text-green-500 text-xl">✓</span>
                        ) : (
                          <span className="text-red-500 text-xl">✗</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Application Timeline */}
            <div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">Timeline</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-700">Applied on {formatDate(applicationDetails.appliedAt)}</span>
                </div>
                {applicationDetails.reviewedAt && (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-gray-700">Reviewed on {formatDate(applicationDetails.reviewedAt)}</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                  <span className="text-gray-700">Last updated: {formatDate(applicationDetails.updatedAt)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsApplicationModalOpen(false);
                  setSelectedApplicationId(null);
                  setApplicationDetails(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">Failed to load application details</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CandidateMatchesPage;
