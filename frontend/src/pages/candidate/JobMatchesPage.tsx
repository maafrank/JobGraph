import { useEffect, useState } from 'react';
import { Layout } from '../../components/layout';
import { Card, Button, LoadingSpinner, Modal, useToast, Textarea } from '../../components/common';
import { matchingService } from '../../services/matchingService';
import { applicationService } from '../../services/applicationService';
import type { JobWithScore, SkillBreakdownItem } from '../../services/matchingService';

export const JobMatchesPage = () => {
  const toast = useToast();

  const [jobs, setJobs] = useState<JobWithScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<JobWithScore | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Apply modal state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [jobToApply, setJobToApply] = useState<JobWithScore | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());

  // Filters
  const [filterRemote, setFilterRemote] = useState<'all' | 'remote' | 'onsite'>('all');
  const [filterQualified, setFilterQualified] = useState<'all' | 'qualified' | 'partial'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'date'>('score');

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      const data = await matchingService.browseJobsWithScores();
      setJobs(data.jobs);
    } catch (error: any) {
      toast.error('Failed to load job matches');
      console.error('Error fetching jobs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetails = (job: JobWithScore) => {
    setSelectedJob(job);
    setIsDetailModalOpen(true);
  };

  const handleApplyClick = (job: JobWithScore) => {
    setJobToApply(job);
    setCoverLetter('');
    setIsApplyModalOpen(true);
  };

  const handleApplySubmit = async () => {
    if (!jobToApply) return;

    try {
      setIsApplying(true);
      await applicationService.applyToJob(jobToApply.jobId, {
        coverLetter: coverLetter.trim() || undefined,
      });

      // Add to applied jobs set
      setAppliedJobIds(prev => new Set(prev).add(jobToApply.jobId));

      toast.success(`Successfully applied to ${jobToApply.jobTitle}!`);
      setIsApplyModalOpen(false);
      setCoverLetter('');
      setJobToApply(null);
    } catch (error: any) {
      if (error.response?.data?.error?.code === 'ALREADY_APPLIED') {
        toast.info('You have already applied to this job');
        setAppliedJobIds(prev => new Set(prev).add(jobToApply.jobId));
        setIsApplyModalOpen(false);
      } else {
        toast.error(error.response?.data?.error?.message || 'Failed to apply to job');
      }
    } finally {
      setIsApplying(false);
    }
  };

  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return 'Not specified';
    if (min && max) return `$${(min / 1000).toFixed(0)}k - $${(max / 1000).toFixed(0)}k`;
    if (min) return `$${(min / 1000).toFixed(0)}k+`;
    if (max) return `Up to $${(max / 1000).toFixed(0)}k`;
    return 'Not specified';
  };

  const formatLocation = (city: string, state: string, remoteOption: boolean) => {
    if (remoteOption) return 'Remote';
    if (city && state) return `${city}, ${state}`;
    if (state) return state;
    return 'Location not specified';
  };

  const formatEmploymentType = (type: string) => {
    const typeMap: Record<string, string> = {
      full_time: 'Full-time',
      part_time: 'Part-time',
      contract: 'Contract',
      internship: 'Internship',
    };
    return typeMap[type] || type;
  };

  const formatExperienceLevel = (level: string) => {
    const levelMap: Record<string, string> = {
      entry: 'Entry Level',
      mid: 'Mid Level',
      senior: 'Senior Level',
      lead: 'Lead',
      executive: 'Executive',
    };
    return levelMap[level] || level;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-blue-100';
    if (score >= 40) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  // Apply filters and sorting
  const filteredJobs = jobs
    .filter((job) => {
      if (filterRemote === 'remote' && !job.remoteOption) return false;
      if (filterRemote === 'onsite' && job.remoteOption) return false;
      if (filterQualified === 'qualified' && !job.isFullyQualified) return false;
      if (filterQualified === 'partial' && job.isFullyQualified) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'score') {
        return b.overallScore - a.overallScore;
      } else {
        return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
      }
    });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Browse Jobs</h1>
          <p className="text-gray-600 mt-2">
            {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} available with match scores based on your skills
          </p>
        </div>

        {/* Filters */}
        {jobs.length > 0 && (
          <Card>
            <div className="flex flex-wrap gap-4">
              {/* Remote Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location Type
                </label>
                <select
                  value={filterRemote}
                  onChange={(e) => setFilterRemote(e.target.value as 'all' | 'remote' | 'onsite')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Locations</option>
                  <option value="remote">Remote Only</option>
                  <option value="onsite">On-site Only</option>
                </select>
              </div>

              {/* Qualification Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Qualification
                </label>
                <select
                  value={filterQualified}
                  onChange={(e) => setFilterQualified(e.target.value as 'all' | 'qualified' | 'partial')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Jobs</option>
                  <option value="qualified">Fully Qualified</option>
                  <option value="partial">Partial Match</option>
                </select>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'score' | 'date')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="score">Match Score (High to Low)</option>
                  <option value="date">Recently Posted</option>
                </select>
              </div>
            </div>
          </Card>
        )}

        {/* Jobs List */}
        {filteredJobs.length > 0 ? (
          <div className="space-y-4">
            {filteredJobs.map((job) => (
              <Card key={job.jobId}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Match Score Badge */}
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={`px-3 py-1 rounded-full ${getScoreBgColor(job.overallScore)}`}
                      >
                        <span className={`text-lg font-bold ${getScoreColor(job.overallScore)}`}>
                          {Math.round(job.overallScore)}% Match
                        </span>
                      </div>
                      {job.isFullyQualified && (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                          ✓ Fully Qualified
                        </span>
                      )}
                      {!job.isFullyQualified && job.overallScore > 0 && (
                        <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                          {job.requiredSkillsMet}/{job.totalRequiredSkills} Required Skills Met
                        </span>
                      )}
                    </div>

                    {/* Job Title & Company */}
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{job.jobTitle}</h3>
                    <p className="text-gray-700 font-medium mb-2">{job.company.name}</p>

                    {/* Job Details */}
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Location:</span>
                        {formatLocation(job.location.city, job.location.state, job.remoteOption)}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Salary:</span>
                        {formatSalary(job.salary.min, job.salary.max)}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Type:</span>
                        {formatEmploymentType(job.employmentType)}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium">Level:</span>
                        {formatExperienceLevel(job.experienceLevel)}
                      </div>
                    </div>

                    {/* Skills Preview */}
                    <div className="space-y-2">
                      {/* Required Skills */}
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-1">Required Skills:</p>
                        <div className="flex flex-wrap gap-2">
                          {job.skillBreakdown
                            .filter((skill) => skill.required)
                            .map((skill) => (
                              <span
                                key={skill.skillId}
                                className={`text-xs px-2 py-1 rounded ${
                                  skill.candidateScore === 0
                                    ? 'bg-gray-200 text-gray-500'
                                    : skill.meetsThreshold
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {skill.skillName}: {skill.candidateScore > 0 ? Math.round(skill.candidateScore) : 'N/A'}
                              </span>
                            ))}
                        </div>
                      </div>
                      {/* Optional Skills */}
                      {job.skillBreakdown.some((s) => !s.required) && (
                        <div>
                          <p className="text-xs font-semibold text-gray-700 mb-1">Optional Skills:</p>
                          <div className="flex flex-wrap gap-2">
                            {job.skillBreakdown
                              .filter((skill) => !skill.required)
                              .map((skill) => (
                                <span
                                  key={skill.skillId}
                                  className={`text-xs px-2 py-1 rounded ${
                                    skill.candidateScore === 0
                                      ? 'bg-gray-200 text-gray-500'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}
                                >
                                  {skill.skillName}: {skill.candidateScore > 0 ? Math.round(skill.candidateScore) : 'N/A'}
                                </span>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Posted Date */}
                    <p className="text-xs text-gray-500 mt-3">
                      Posted on {formatDate(job.postedAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="ml-4 flex flex-col gap-2">
                    <Button variant="primary" size="sm" onClick={() => handleViewDetails(job)}>
                      View Details
                    </Button>
                    {appliedJobIds.has(job.jobId) ? (
                      <div className="px-3 py-1.5 bg-green-100 text-green-700 text-sm font-medium rounded text-center">
                        ✓ Applied
                      </div>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => handleApplyClick(job)}>
                        Apply Now
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                {jobs.length === 0
                  ? 'No jobs available yet'
                  : 'No jobs match your current filters'}
              </p>
              {jobs.length === 0 && (
                <p className="text-sm text-gray-400">
                  Add skills to your profile to see job matches
                </p>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Job Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedJob(null);
        }}
        title="Job Details"
        size="lg"
      >
        {selectedJob && (
          <div className="space-y-6">
            {/* Match Score */}
            <div className="text-center">
              <div
                className={`inline-block px-6 py-3 rounded-full ${getScoreBgColor(selectedJob.overallScore)}`}
              >
                <span className={`text-3xl font-bold ${getScoreColor(selectedJob.overallScore)}`}>
                  {Math.round(selectedJob.overallScore)}% Match
                </span>
              </div>
              {selectedJob.isFullyQualified && (
                <p className="text-sm text-green-600 font-medium mt-2">
                  ✓ You meet all requirements for this position
                </p>
              )}
              {!selectedJob.isFullyQualified && selectedJob.overallScore > 0 && (
                <p className="text-sm text-yellow-600 font-medium mt-2">
                  You meet {selectedJob.requiredSkillsMet} of {selectedJob.totalRequiredSkills} required skills
                </p>
              )}
            </div>

            {/* Job Info */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedJob.jobTitle}</h2>
              <p className="text-lg text-gray-700 font-medium mb-4">{selectedJob.company.name}</p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Industry:</span>
                  <p className="text-gray-600">{selectedJob.company.industry}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Location:</span>
                  <p className="text-gray-600">
                    {formatLocation(
                      selectedJob.location.city,
                      selectedJob.location.state,
                      selectedJob.remoteOption
                    )}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Salary:</span>
                  <p className="text-gray-600">
                    {formatSalary(selectedJob.salary.min, selectedJob.salary.max)}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Type:</span>
                  <p className="text-gray-600">{formatEmploymentType(selectedJob.employmentType)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Experience:</span>
                  <p className="text-gray-600">
                    {formatExperienceLevel(selectedJob.experienceLevel)}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Posted:</span>
                  <p className="text-gray-600">{formatDate(selectedJob.postedAt)}</p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Job Description</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{selectedJob.jobDescription}</p>
            </div>

            {/* Skill Breakdown */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Skill Match Breakdown</h3>

              {/* Required Skills Section */}
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Required Skills</h4>
                <div className="space-y-2">
                  {selectedJob.skillBreakdown
                    .filter((skill) => skill.required)
                    .map((skill) => (
                      <div
                        key={skill.skillId}
                        className="p-3 border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{skill.skillName}</span>
                            {skill.candidateScore === 0 && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                                Missing
                              </span>
                            )}
                            {skill.candidateScore > 0 && !skill.meetsThreshold && (
                              <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                                Below Minimum
                              </span>
                            )}
                          </div>
                          <span className={`font-bold ${skill.candidateScore > 0 ? getScoreColor(skill.candidateScore) : 'text-gray-400'}`}>
                            {skill.candidateScore > 0 ? Math.round(skill.candidateScore) : 'N/A'}/{Math.round(skill.minimumScore)}
                          </span>
                        </div>
                        {skill.candidateScore > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  skill.meetsThreshold
                                    ? 'bg-green-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min((skill.candidateScore / 100) * 100, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">
                              Weight: {Math.round(skill.weight * 100)}%
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {/* Optional Skills Section */}
              {selectedJob.skillBreakdown.some((s) => !s.required) && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Optional Skills (Bonus)</h4>
                  <div className="space-y-2">
                    {selectedJob.skillBreakdown
                      .filter((skill) => !skill.required)
                      .map((skill) => (
                        <div
                          key={skill.skillId}
                          className="p-3 border border-gray-200 rounded-lg bg-blue-50"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{skill.skillName}</span>
                              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                Optional
                              </span>
                              {skill.candidateScore === 0 && (
                                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                                  Not Added
                                </span>
                              )}
                            </div>
                            <span className={`font-bold ${skill.candidateScore > 0 ? getScoreColor(skill.candidateScore) : 'text-gray-400'}`}>
                              {skill.candidateScore > 0 ? Math.round(skill.candidateScore) : 'N/A'}/{Math.round(skill.minimumScore)}
                            </span>
                          </div>
                          {skill.candidateScore > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    skill.meetsThreshold
                                      ? 'bg-green-500'
                                      : 'bg-yellow-500'
                                  }`}
                                  style={{ width: `${Math.min((skill.candidateScore / 100) * 100, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600">
                                Weight: {Math.round(skill.weight * 100)}%
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setSelectedJob(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Apply Modal */}
      <Modal
        isOpen={isApplyModalOpen}
        onClose={() => {
          if (!isApplying) {
            setIsApplyModalOpen(false);
            setCoverLetter('');
            setJobToApply(null);
          }
        }}
        title="Apply to Job"
        size="md"
      >
        {jobToApply && (
          <div className="space-y-4">
            {/* Job Info */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-bold text-lg text-gray-900">{jobToApply.jobTitle}</h3>
              <p className="text-gray-700">{jobToApply.company.name}</p>
              <div className="mt-2">
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getScoreBgColor(jobToApply.overallScore)}`}>
                  <span className={getScoreColor(jobToApply.overallScore)}>
                    {Math.round(jobToApply.overallScore)}% Match
                  </span>
                </span>
              </div>
            </div>

            {/* Cover Letter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cover Letter (Optional)
              </label>
              <Textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Tell the employer why you're interested in this position and how your skills align with their needs..."
                rows={6}
                disabled={isApplying}
              />
              <p className="text-xs text-gray-500 mt-1">
                A cover letter helps you stand out. Share your enthusiasm and relevant experience.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsApplyModalOpen(false);
                  setCoverLetter('');
                  setJobToApply(null);
                }}
                disabled={isApplying}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleApplySubmit}
                disabled={isApplying}
              >
                {isApplying ? 'Submitting...' : 'Submit Application'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
};
