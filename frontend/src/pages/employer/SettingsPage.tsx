import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../contexts/AuthContext';
import { Layout } from '../../components/layout';
import { Button, Input, Card, Modal, useToast } from '../../components/common';

type Tab = 'account' | 'company' | 'notifications' | 'danger';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const { user, logout } = useAuthStore();
  const toast = useToast();
  const navigate = useNavigate();

  // Account Settings State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);

  // Danger Zone State
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast('All password fields are required', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast('New passwords do not match', 'error');
      return;
    }

    if (newPassword.length < 8) {
      toast('Password must be at least 8 characters', 'error');
      return;
    }

    setIsChangingPassword(true);
    try {
      const result = await authService.changePassword(currentPassword, newPassword);
      toast(result.message, 'success');

      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Logout and redirect to login (all tokens revoked)
      setTimeout(() => {
        logout();
        navigate('/login');
      }, 2000);
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Failed to change password';
      toast(message, 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail || !emailPassword) {
      toast('Email and password are required', 'error');
      return;
    }

    setIsChangingEmail(true);
    try {
      const result = await authService.changeEmail(newEmail, emailPassword);
      toast(result.message, 'success');

      // Clear form
      setNewEmail('');
      setEmailPassword('');

      // Update user in store (email changed)
      if (user) {
        useAuthStore.getState().setUser({ ...user, email: result.newEmail });
      }
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Failed to change email';
      toast(message, 'error');
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast('Password is required to delete account', 'error');
      return;
    }

    setIsDeleting(true);
    try {
      await authService.deleteAccount(deletePassword);
      toast('Account deleted successfully', 'success');

      // Logout and redirect
      setTimeout(() => {
        logout();
        navigate('/');
      }, 2000);
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Failed to delete account';
      toast(message, 'error');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'account', label: 'Account' },
    { id: 'company', label: 'Company' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'danger', label: 'Danger Zone' },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-4 px-2 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Account Settings Tab */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          <Card title="Current Email">
            <div className="mb-4">
              <p className="text-gray-600">Your current email address is:</p>
              <p className="text-lg font-medium mt-1">{user?.email}</p>
            </div>
          </Card>

          <Card title="Change Password">
            <div className="space-y-4">
              <Input
                label="Current Password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
              <Input
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 8 characters)"
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
              <Button
                onClick={handleChangePassword}
                loading={isChangingPassword}
                disabled={!currentPassword || !newPassword || !confirmPassword}
              >
                Change Password
              </Button>
              <p className="text-sm text-gray-500">
                Note: Changing your password will log you out on all devices.
              </p>
            </div>
          </Card>

          <Card title="Change Email">
            <div className="space-y-4">
              <Input
                label="New Email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter new email address"
              />
              <Input
                label="Password"
                type="password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                placeholder="Enter your password to confirm"
              />
              <Button
                onClick={handleChangeEmail}
                loading={isChangingEmail}
                disabled={!newEmail || !emailPassword}
              >
                Change Email
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Company Settings Tab */}
      {activeTab === 'company' && (
        <div className="space-y-6">
          <Card title="Company Profile">
            <div className="space-y-4">
              <p className="text-gray-600">
                Manage your company profile, including company information, industry, and location.
              </p>
              <Link to="/employer/company">
                <Button>Go to Company Profile</Button>
              </Link>
            </div>
          </Card>

          <Card title="Company Users">
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6 text-center">
              <p className="text-yellow-800 font-medium">Coming Soon in Phase 2</p>
              <p className="text-sm text-yellow-700 mt-2">
                Team management and user roles will be available in the next release.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <Card title="Notification Preferences">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6 text-center">
            <p className="text-yellow-800 font-medium">Coming Soon in Phase 2</p>
            <p className="text-sm text-yellow-700 mt-2">
              Email notifications for matches, applications, and other events will be available in the next release.
            </p>
          </div>
        </Card>
      )}

      {/* Danger Zone Tab */}
      {activeTab === 'danger' && (
        <Card title="Danger Zone">
          <div className="border-2 border-red-300 rounded-md p-6 bg-red-50">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Delete Account</h3>
            <p className="text-red-700 mb-4">
              Once you delete your account, there is no going back. This action is permanent and will delete:
            </p>
            <ul className="list-disc list-inside text-red-700 space-y-1 ml-4 mb-6">
              <li>Your account and login credentials</li>
              <li>Your company profile and information</li>
              <li>All job postings and applications</li>
              <li>All candidate matches and communications</li>
            </ul>
            <Button
              variant="danger"
              onClick={() => setShowDeleteModal(true)}
            >
              Delete My Account
            </Button>
          </div>
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Account Deletion"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you absolutely sure you want to delete your account? This action cannot be undone.
          </p>
          <Input
            label="Enter your password to confirm"
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="Password"
          />
          <div className="flex space-x-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false);
                setDeletePassword('');
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAccount}
              loading={isDeleting}
              disabled={!deletePassword}
            >
              Yes, Delete My Account
            </Button>
          </div>
        </div>
      </Modal>
      </div>
    </Layout>
  );
}
