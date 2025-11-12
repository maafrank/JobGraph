import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobService } from '../../services/jobService';
import { matchingService } from '../../services/matchingService';
import type { Job, JobStatus } from '../../types';
import { Button, Card, LoadingSpinner, useToast } from '../../components/common';

type StatusFilter = 'all' | JobStatus;

const JobManagementPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculatingMatches, setCalculatingMatches] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Calculate matches for all active jobs
  const calculateMatchesForActiveJobs = async (activeJobs: Job[]) => {
    if (activeJobs.length === 0) return;

    setCalculatingMatches(true);
    let successCount = 0;
    let totalMatches = 0;

    try {
      // Calculate matches for each active job in parallel
      const results = await Promise.allSettled(
        activeJobs.map(job => matchingService.calculateJobMatches(job.jobId))
      );

      // Count successes
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
          totalMatches += result.value.totalMatches;
        } else {
          console.error(`Failed to calculate matches for job ${activeJobs[index].jobId}:`, result.reason);
        }
      });

      if (successCount > 0) {
        console.log(`✓ Calculated matches for ${successCount}/${activeJobs.length} active jobs (${totalMatches} total matches)`);
      }
    } catch (error) {
      console.error('Error calculating matches:', error);
    } finally {
      setCalculatingMatches(false);
    }
  };

  // Fetch jobs based on status filter
  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params = statusFilter === 'all' ? {} : { status: statusFilter };
      const { jobs: fetchedJobs } = await jobService.getMyJobs(params);

      // Filter out cancelled jobs when viewing "all"
      const filteredJobs = statusFilter === 'all'
        ? fetchedJobs.filter(job => job.status !== 'cancelled')
        : fetchedJobs;

      setJobs(filteredJobs);

      // After fetching jobs, calculate matches for all active jobs
      const activeJobs = filteredJobs.filter(job => job.status === 'active');
      if (activeJobs.length > 0) {
        // Calculate matches in the background (don't block UI)
        calculateMatchesForActiveJobs(activeJobs).then(() => {
          // Refresh jobs to get updated match counts
          jobService.getMyJobs(params).then(({ jobs: refreshedJobs }) => {
            const refreshedFiltered = statusFilter === 'all'
              ? refreshedJobs.filter(job => job.status !== 'cancelled')
              : refreshedJobs;
            setJobs(refreshedFiltered);
          });
        });
      }
    } catch (error: any) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [statusFilter]);

  // Handle job status change (close/reopen)
  const handleStatusChange = async (jobId: string, newStatus: JobStatus) => {
    try {
      await jobService.updateJob(jobId, { status: newStatus });
      toast.success(
        `Job ${newStatus === 'active' ? 'reopened and matches calculated' : 'closed'} successfully`
      );
      fetchJobs(); // Refresh the list
    } catch (error: any) {
      console.error('Error updating job status:', error);
      toast.error('Failed to update job status');
    }
  };

  // Handle view candidates
  const handleViewCandidates = (jobId: string) => {
    navigate(`/employer/jobs/${jobId}/candidates`);
  };

  // Handle edit job
  const handleEditJob = (jobId: string) => {
    navigate(`/employer/jobs/${jobId}/edit`);
  };

  // Handle delete job
  const handleDeleteJob = async (jobId: string, jobTitle: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the job "${jobTitle}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await jobService.deleteJob(jobId);
      toast.success('Job deleted successfully');
      fetchJobs();
    } catch (error: any) {
      console.error('Error deleting job:', error);
      toast.error('Failed to delete job');
    }
  };

  // Get status badge color
  const getStatusBadgeColor = (status: JobStatus): string => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Format salary range
  const formatSalary = (job: Job): string => {
    if (!job.salaryMin && !job.salaryMax) return 'Not specified';
    const currency = job.salaryCurrency || 'USD';
    const min = job.salaryMin
      ? new Intl.NumberFormat('en-US').format(job.salaryMin)
      : '';
    const max = job.salaryMax
      ? new Intl.NumberFormat('en-US').format(job.salaryMax)
      : '';
    if (min && max) return `${currency} ${min} - ${max}`;
    if (min) return `${currency} ${min}+`;
    if (max) return `Up to ${currency} ${max}`;
    return 'Not specified';
  };

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Button variant="ghost" onClick={() => navigate('/employer/dashboard')} className="mb-4">
          ← Back to Dashboard
        </Button>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Job Management</h1>
          <Button onClick={() => navigate('/employer/jobs/new')}>
            Post New Job
          </Button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 border-b border-gray-200 mb-6">
          {(['all', 'active', 'draft', 'closed'] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                statusFilter === status
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Calculating Matches Indicator */}
        {calculatingMatches && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-center gap-2 text-sm text-blue-700">
            <LoadingSpinner size="sm" />
            <span>Calculating matches for active jobs...</span>
          </div>
        )}
      </div>

      {/* Jobs List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">
              {statusFilter === 'all'
                ? 'No jobs posted yet'
                : `No ${statusFilter} jobs`}
            </p>
            <Button onClick={() => navigate('/employer/jobs/new')}>
              Post Your First Job
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.jobId}>
              <div className="flex justify-between items-start gap-4">
                {/* Job Info */}
                <div className="flex-1">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-1">{job.title}</h3>
                      <div className="flex flex-wrap gap-2 items-center text-sm text-gray-600 mb-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(
                            job.status
                          )}`}
                        >
                          {job.status.toUpperCase()}
                        </span>
                        <span>•</span>
                        <span>{job.employmentType}</span>
                        <span>•</span>
                        <span>{job.experienceLevel} level</span>
                        <span>•</span>
                        <span>
                          {job.city && job.state
                            ? `${job.city}, ${job.state}`
                            : 'Location not specified'}
                        </span>
                        <span>•</span>
                        <span className="capitalize">{job.remoteOption}</span>
                      </div>
                      <p className="text-gray-700 mb-2">
                        {job.description.length > 200
                          ? `${job.description.substring(0, 200)}...`
                          : job.description}
                      </p>
                      <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                        <span>💰 {formatSalary(job)}</span>
                        <span>📅 Posted {formatDate(job.createdAt)}</span>
                        {job.requiredSkillsCount !== undefined && (
                          <span>🔧 {job.requiredSkillsCount} required skills</span>
                        )}
                        {job.status === 'active' && job.matchCount !== undefined && (
                          <span className="font-medium text-blue-600">
                            👥 {job.matchCount} {job.matchCount === 1 ? 'match' : 'matches'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 min-w-[200px]">
                  {job.status === 'active' && (
                    <>
                      <Button
                        onClick={() => handleViewCandidates(job.jobId)}
                        size="sm"
                      >
                        View Candidates
                      </Button>
                      <Button
                        onClick={() => handleStatusChange(job.jobId, 'closed')}
                        variant="secondary"
                        size="sm"
                      >
                        Close Job
                      </Button>
                    </>
                  )}

                  {job.status === 'draft' && (
                    <>
                      <Button
                        onClick={() => handleEditJob(job.jobId)}
                        size="sm"
                      >
                        Continue Editing
                      </Button>
                      <Button
                        onClick={() => handleStatusChange(job.jobId, 'active')}
                        size="sm"
                      >
                        Publish Job
                      </Button>
                    </>
                  )}

                  {job.status === 'closed' && (
                    <Button
                      onClick={() => handleStatusChange(job.jobId, 'active')}
                      size="sm"
                    >
                      Reopen Job
                    </Button>
                  )}

                  <Button
                    onClick={() => handleEditJob(job.jobId)}
                    variant="ghost"
                    size="sm"
                    className="border border-gray-300 hover:border-gray-400"
                  >
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleDeleteJob(job.jobId, job.title)}
                    variant="danger"
                    size="sm"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default JobManagementPage;
