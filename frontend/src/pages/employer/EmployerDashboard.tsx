import { Link } from 'react-router-dom';
import { Layout } from '../../components/layout';
import { Card, Button } from '../../components/common';
import { useAuthStore } from '../../contexts/AuthContext';

export const EmployerDashboard = () => {
  const user = useAuthStore((state) => state.user);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {user?.first_name}!
            </h1>
            <p className="mt-2 text-gray-600">
              Here's an overview of your recruitment activity
            </p>
          </div>
          <Link to="/employer/jobs/new">
            <Button>+ Post New Job</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-600">0</div>
              <div className="mt-2 text-sm text-gray-600">Active Jobs</div>
            </div>
          </Card>

          <Card>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600">0</div>
              <div className="mt-2 text-sm text-gray-600">Total Matches</div>
            </div>
          </Card>

          <Card>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600">0</div>
              <div className="mt-2 text-sm text-gray-600">Candidates Contacted</div>
            </div>
          </Card>
        </div>

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
