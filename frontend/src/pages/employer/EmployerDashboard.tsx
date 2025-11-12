import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Layout } from '../../components/layout';
import { Card, Button, LoadingSpinner, useToast } from '../../components/common';
import { useAuthStore } from '../../contexts/AuthContext';
import { jobService } from '../../services/jobService';
import { matchingService } from '../../services/matchingService';

export const EmployerDashboard = () => {
  const user = useAuthStore((state) => state.user);
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeJobsCount: 0,
    totalMatchesCount: 0,
    contactedCandidatesCount: 0,
  });

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);

      // Fetch job statistics (active jobs count and total matches count)
      const jobStats = await jobService.getEmployerStats();

      // Fetch all jobs to get job IDs for contacted candidates count
      const { jobs } = await jobService.getMyJobs({ limit: 1000 });
      const jobIds = jobs.map(job => job.jobId);

      // Fetch contacted candidates count across all jobs
      const contactedCount = await matchingService.getContactedCandidatesCount(jobIds);

      setStats({
        activeJobsCount: jobStats.activeJobsCount,
        totalMatchesCount: jobStats.totalMatchesCount,
        contactedCandidatesCount: contactedCount,
      });
    } catch (error: any) {
      console.error('Error fetching dashboard stats:', error);
      toast('Failed to load dashboard statistics', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {user?.firstName || 'there'}!
            </h1>
            <p className="mt-2 text-gray-600">
              Here's an overview of your recruitment activity
            </p>
          </div>
          <Link to="/employer/jobs/new">
            <Button>+ Post New Job</Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <div className="text-center">
                <div className="text-4xl font-bold text-primary-600">
                  {stats.activeJobsCount}
                </div>
                <div className="mt-2 text-sm text-gray-600">Active Jobs</div>
              </div>
            </Card>

            <Card>
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600">
                  {stats.totalMatchesCount}
                </div>
                <div className="mt-2 text-sm text-gray-600">Total Matches</div>
              </div>
            </Card>

            <Card>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600">
                  {stats.contactedCandidatesCount}
                </div>
                <div className="mt-2 text-sm text-gray-600">Candidates Contacted</div>
              </div>
            </Card>
          </div>
        )}

        <Card title="Getting Started" subtitle="Complete these steps to start finding candidates">
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary-100 text-primary-600 font-semibold">
                  1
                </div>
              </div>
              <div className="ml-4">
                <h4 className="text-sm font-medium text-gray-900">Create company profile</h4>
                <p className="mt-1 text-sm text-gray-600">
                  Set up your company information to attract top talent
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary-100 text-primary-600 font-semibold">
                  2
                </div>
              </div>
              <div className="ml-4">
                <h4 className="text-sm font-medium text-gray-900">Post a job</h4>
                <p className="mt-1 text-sm text-gray-600">
                  Create job postings with required skills and minimum score thresholds
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary-100 text-primary-600 font-semibold">
                  3
                </div>
              </div>
              <div className="ml-4">
                <h4 className="text-sm font-medium text-gray-900">Find matched candidates</h4>
                <p className="mt-1 text-sm text-gray-600">
                  Run matching algorithm to find candidates ranked by skill compatibility
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
};
