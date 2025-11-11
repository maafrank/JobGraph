import { Layout } from '../../components/layout';
import { Card } from '../../components/common';
import { useAuthStore } from '../../contexts/AuthContext';

export const CandidateDashboard = () => {
  const user = useAuthStore((state) => state.user);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.first_name}!
          </h1>
          <p className="mt-2 text-gray-600">
            Here's an overview of your job search progress
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-600">0</div>
              <div className="mt-2 text-sm text-gray-600">Skills Added</div>
            </div>
          </Card>

          <Card>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600">0</div>
              <div className="mt-2 text-sm text-gray-600">Job Matches</div>
            </div>
          </Card>

          <Card>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600">0</div>
              <div className="mt-2 text-sm text-gray-600">Profile Views</div>
            </div>
          </Card>
        </div>

        <Card title="Getting Started" subtitle="Complete these steps to maximize your job search">
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary-100 text-primary-600 font-semibold">
                  1
                </div>
              </div>
              <div className="ml-4">
                <h4 className="text-sm font-medium text-gray-900">Complete your profile</h4>
                <p className="mt-1 text-sm text-gray-600">
                  Add your work experience, education, and personal information
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
                <h4 className="text-sm font-medium text-gray-900">Add your skills</h4>
                <p className="mt-1 text-sm text-gray-600">
                  Browse our skill catalog and add skills with your proficiency scores
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
                <h4 className="text-sm font-medium text-gray-900">View your matches</h4>
                <p className="mt-1 text-sm text-gray-600">
                  Once you add skills, employers can match you to relevant job openings
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
};
