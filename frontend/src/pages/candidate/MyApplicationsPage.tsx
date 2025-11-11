import { useEffect, useState } from 'react';
import { Layout } from '../../components/layout';
import { Card, Button, LoadingSpinner, Modal, useToast } from '../../components/common';
import { applicationService } from '../../services/applicationService';
import type { JobApplication } from '../../services/applicationService';

export const MyApplicationsPage = () => {
  const toast = useToast();

  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  useEffect(() => {
    fetchApplications();
  }, [statusFilter]);

  const fetchApplications = async () => {
    try {
      setIsLoading(true);
      const data = await applicationService.getMyApplications(1, 50, statusFilter || undefined);
      setApplications(data.applications);
    } catch (error: any) {
      toast.error('Failed to load applications');
      console.error('Error fetching applications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = async (applicationId: string, jobTitle: string) => {
    if (!confirm(`Are you sure you want to withdraw your application to "${jobTitle}"?`)) {
      return;
    }

    try {
      setWithdrawingId(applicationId);
      await applicationService.withdrawApplication(applicationId);
      toast.success('Application withdrawn successfully');
      fetchApplications(); // Refresh list
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to withdraw application');
    } finally {
      setWithdrawingId(null);
    }
  };

  const handleViewDetails = (application: JobApplication) => {
    setSelectedApplication(application);
    setIsDetailModalOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatSalary = (min: number | null, max: number | null, currency: string) => {
    if (!min && !max) return 'Not specified';
    if (min && max) return `$${(min / 1000).toFixed(0)}k - $${(max / 1000).toFixed(0)}k ${currency}`;
    if (min) return `$${(min / 1000).toFixed(0)}k+ ${currency}`;
    if (max) return `Up to $${(max / 1000).toFixed(0)}k ${currency}`;
    return 'Not specified';
  };

  const getStatusColor = (status: string) => {
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

  const formatStatus = (status: string) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Applications</h1>
          <p className="text-gray-600 mt-2">
            Track the status of your {applications.length} job application{applications.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Filters */}
        {applications.length > 0 && (
          <Card>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Applications</option>
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="interviewing">Interviewing</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>
          </Card>
        )}

        {/* Applications List */}
        {applications.length > 0 ? (
          <div className="space-y-4">
            {applications.map((application) => (
              <Card key={application.applicationId}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Status Badge */}
                    <div className="mb-3">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(application.status)}`}>
                        {formatStatus(application.status)}
                      </span>
                      {application.matchScore && (
                        <span className="ml-2 text-sm text-gray-600">
                          Match: <span className="font-semibold">{Math.round(application.matchScore)}%</span>
                        </span>
                      )}
                    </div>

                    {/* Job Info */}
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{application.jobTitle}</h3>
                    <p className="text-gray-700 font-medium mb-2">{application.company.name}</p>

                    {/* Details */}
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                      <div>
                        <span className="font-medium">Location:</span>{' '}
                        {application.remoteOption ? 'Remote' : `${application.location.city}, ${application.location.state}`}
                      </div>
                      <div>
                        <span className="font-medium">Salary:</span>{' '}
                        {formatSalary(application.salary.min, application.salary.max, application.salary.currency)}
                      </div>
                      <div>
                        <span className="font-medium">Type:</span>{' '}
                        {application.employmentType}
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="flex gap-4 text-xs text-gray-500">
                      <div>Applied: {formatDate(application.appliedAt)}</div>
                      {application.reviewedAt && (
                        <div>Reviewed: {formatDate(application.reviewedAt)}</div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="ml-4 flex flex-col gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleViewDetails(application)}
                    >
                      View Details
                    </Button>
                    {(application.status === 'submitted' || application.status === 'under_review') && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleWithdraw(application.applicationId, application.jobTitle)}
                        disabled={withdrawingId === application.applicationId}
                      >
                        {withdrawingId === application.applicationId ? 'Withdrawing...' : 'Withdraw'}
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
                You haven't applied to any jobs yet
              </p>
              <p className="text-sm text-gray-400 mb-6">
                Browse available jobs and apply to positions that match your skills
              </p>
              <Button onClick={() => window.location.href = '/candidate/job-matches'}>
                Browse Jobs
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Application Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedApplication(null);
        }}
        title="Application Details"
        size="lg"
      >
        {selectedApplication && (
          <div className="space-y-6">
            {/* Status */}
            <div className="text-center">
              <span className={`inline-block px-6 py-2 rounded-full text-sm font-medium ${getStatusColor(selectedApplication.status)}`}>
                {formatStatus(selectedApplication.status)}
              </span>
              {selectedApplication.matchScore && (
                <p className="text-sm text-gray-600 mt-2">
                  Match Score: <span className="font-semibold">{Math.round(selectedApplication.matchScore)}%</span>
                  {selectedApplication.matchRank && ` (Ranked #{selectedApplication.matchRank})`}
                </p>
              )}
            </div>

            {/* Job Info */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedApplication.jobTitle}</h2>
              <p className="text-lg text-gray-700 font-medium mb-4">{selectedApplication.company.name}</p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Industry:</span>
                  <p className="text-gray-600">{selectedApplication.company.industry}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Location:</span>
                  <p className="text-gray-600">
                    {selectedApplication.remoteOption ? 'Remote' : `${selectedApplication.location.city}, ${selectedApplication.location.state}`}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Salary:</span>
                  <p className="text-gray-600">
                    {formatSalary(selectedApplication.salary.min, selectedApplication.salary.max, selectedApplication.salary.currency)}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Type:</span>
                  <p className="text-gray-600">{selectedApplication.employmentType}</p>
                </div>
              </div>
            </div>

            {/* Cover Letter */}
            {selectedApplication.coverLetter && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Your Cover Letter</h3>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedApplication.coverLetter}</p>
                </div>
              </div>
            )}

            {/* Application Timeline */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Application Timeline</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-700">Applied on {formatDate(selectedApplication.appliedAt)}</span>
                </div>
                {selectedApplication.reviewedAt && (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-gray-700">Reviewed on {formatDate(selectedApplication.reviewedAt)}</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                  <span className="text-gray-700">Last updated: {formatDate(selectedApplication.updatedAt)}</span>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setSelectedApplication(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
};
