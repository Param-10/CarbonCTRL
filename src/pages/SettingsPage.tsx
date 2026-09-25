import { useState, useEffect } from 'react';
import { User, Shield, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../lib/api';

// Google-only accounts have no password, so they confirm deletion by typing this word
const DELETE_CONFIRMATION_WORD = 'DELETE';

const SettingsPage = () => {
  const { user, refreshUser } = useAuthStore();
  const [loading, setLoading] = useState({
    profile: false,
    password: false,
    delete: false
  });
  
  const [name, setName] = useState(user?.name || '');
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [notifications, setNotifications] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Update the name field when user changes
  useEffect(() => {
    if (user) {
      setName(user.name || '');
    }
  }, [user]);

  const handleProfileUpdate = async () => {
    if (!user) return;
    
    setLoading(prev => ({ ...prev, profile: true }));
    
    try {
      await apiClient.updateUser({ name });
      refreshUser().catch(err => console.error('Error refreshing user:', err));

      setNotifications({ type: 'success', message: 'Profile updated successfully' });
      setTimeout(() => setNotifications(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setNotifications({ type: 'error', message: errorMessage });
      setTimeout(() => setNotifications(null), 3000);
    } finally {
      setLoading(prev => ({ ...prev, profile: false }));
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordData.newPassword) {
      setNotifications({ type: 'error', message: 'Enter a new password' });
      setTimeout(() => setNotifications(null), 3000);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setNotifications({ type: 'error', message: 'Passwords do not match' });
      setTimeout(() => setNotifications(null), 3000);
      return;
    }
    
    setLoading(prev => ({ ...prev, password: true }));
    
    try {
      await apiClient.updateUser({
        password: passwordData.newPassword,
        currentPassword: user?.hasPassword ? passwordData.currentPassword : undefined
      });

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      setIsChangingPassword(false);
      // A Google-only user who just set a first password now has one
      refreshUser().catch(err => console.error('Error refreshing user:', err));
      setNotifications({ type: 'success', message: 'Password changed successfully' });
      setTimeout(() => setNotifications(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to change password';
      setNotifications({ type: 'error', message: errorMessage });
      setTimeout(() => setNotifications(null), 3000);
    } finally {
      setLoading(prev => ({ ...prev, password: false }));
    }
  };
  
  const isDeleteConfirmed = user?.hasPassword
    ? deleteConfirmation.length > 0
    : deleteConfirmation === DELETE_CONFIRMATION_WORD;

  const handleDeleteAccount = async () => {
    setLoading(prev => ({ ...prev, delete: true }));

    try {
      await apiClient.deleteAccount(user?.hasPassword ? { password: deleteConfirmation } : {});
      localStorage.removeItem('carbonctrl_last_page');
      // Full reload clears every in-memory store along with the session
      window.location.href = '/';
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete account';
      setNotifications({ type: 'error', message: errorMessage });
      setTimeout(() => setNotifications(null), 3000);
      setLoading(prev => ({ ...prev, delete: false }));
    }
  };

  const handleCancelDelete = () => {
    setIsConfirmingDelete(false);
    setDeleteConfirmation('');
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400">Please log in to access settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-space text-4xl font-bold text-white mb-3">Settings</h1>
        <p className="font-mono text-emerald-100/80">Manage your account preferences and security</p>
      </div>

      {/* Notifications */}
      {notifications && (
        <div className={`p-4 rounded-lg ${
          notifications.type === 'success' 
            ? 'bg-emerald-900/20 text-emerald-300 border border-emerald-500/20' 
            : 'bg-red-900/20 text-red-300 border border-red-500/20'
        }`}>
          {notifications.message}
        </div>
      )}

      {/* Profile Information */}
      <div className="feature-card p-8">
        <div className="flex items-center gap-3 mb-6">
          <User className="w-6 h-6 text-emerald-400" />
          <h2 className="font-space text-2xl font-semibold text-white">Profile Information</h2>
        </div>

        <div className="grid gap-6">
          <div>
            <label className="block font-mono text-sm text-emerald-100/70 mb-3" htmlFor="settings-name">Name</label>
            <input
              id="settings-name"
              type="text"
              autoComplete="name"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-3 text-white font-mono placeholder-gray-400 focus:border-emerald-500/50 focus:outline-none"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label className="block font-mono text-sm text-emerald-100/70 mb-3">Email</label>
            <div className="w-full bg-gray-800/30 border border-gray-700/30 rounded-lg px-4 py-3 text-gray-400 font-mono">
              {user.email}
            </div>
            <p className="font-mono text-xs text-gray-500 mt-2">Email cannot be changed</p>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={handleProfileUpdate}
            disabled={loading.profile || !name.trim()}
            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-sm py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading.profile ? 'Updating...' : 'Update Profile'}
          </button>
        </div>
      </div>

      {/* Security Settings */}
      <div className="feature-card p-8">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-emerald-400" />
          <h2 className="font-space text-2xl font-semibold text-white">Security</h2>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 border border-gray-700/50 rounded-lg">
            <div>
              <h3 className="font-mono text-white mb-1">Password</h3>
              <p className="font-mono text-sm text-gray-400">
                {user.hasPassword
                  ? 'Update your password. Other signed-in devices will be signed out.'
                  : 'You sign in with Google. Set a password to also sign in with email.'}
              </p>
            </div>
            <button
              onClick={() => setIsChangingPassword(!isChangingPassword)}
              className="bg-gray-700/50 hover:bg-gray-700/70 text-white font-mono text-sm py-2 px-4 rounded-lg transition-colors"
            >
              {isChangingPassword ? 'Cancel' : user.hasPassword ? 'Change Password' : 'Set Password'}
            </button>
          </div>

          {isChangingPassword && (
            <div className="grid gap-4 p-4 border border-gray-700/50 rounded-lg bg-gray-800/20">
              {user.hasPassword && (
                <div>
                  <label className="block font-mono text-sm text-emerald-100/70 mb-2">Current Password</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-3 text-white font-mono placeholder-gray-400 focus:border-emerald-500/50 focus:outline-none"
                    placeholder="Enter current password"
                  />
                </div>
              )}

              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-2">New Password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  maxLength={72}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-3 text-white font-mono placeholder-gray-400 focus:border-emerald-500/50 focus:outline-none"
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-2">Confirm New Password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  maxLength={72}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-3 text-white font-mono placeholder-gray-400 focus:border-emerald-500/50 focus:outline-none"
                  placeholder="Confirm new password"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handlePasswordChange}
                  disabled={loading.password}
                  className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-sm py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading.password ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="feature-card p-8 border-red-500/20">
        <div className="flex items-center gap-3 mb-6">
          <Trash2 className="w-6 h-6 text-red-400" />
          <h2 className="font-space text-2xl font-semibold text-white">Danger Zone</h2>
        </div>

        <div className="space-y-4">
          <div className="p-4 border border-red-500/20 rounded-lg bg-red-900/10">
            <h3 className="font-mono text-red-300 mb-2">Delete Account</h3>
            <p className="font-mono text-sm text-gray-400 mb-4">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            {!isConfirmingDelete ? (
              <button
                onClick={() => setIsConfirmingDelete(true)}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-300 font-mono text-sm py-2 px-4 rounded-lg transition-colors"
              >
                Delete Account
              </button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block font-mono text-sm text-red-200/80 mb-2">
                    {user.hasPassword
                      ? 'Enter your password to confirm'
                      : `Type ${DELETE_CONFIRMATION_WORD} to confirm`}
                  </label>
                  <input
                    type={user.hasPassword ? 'password' : 'text'}
                    autoComplete={user.hasPassword ? 'current-password' : 'off'}
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    className="w-full bg-gray-800/50 border border-red-500/30 rounded-lg px-4 py-3 text-white font-mono placeholder-gray-400 focus:border-red-500/60 focus:outline-none"
                    placeholder={user.hasPassword ? 'Password' : DELETE_CONFIRMATION_WORD}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={loading.delete || !isDeleteConfirmed}
                    className="bg-red-600 hover:bg-red-700 text-white font-mono text-sm py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loading.delete ? 'Deleting...' : 'Permanently Delete Account'}
                  </button>
                  <button
                    onClick={handleCancelDelete}
                    disabled={loading.delete}
                    className="font-mono text-sm text-gray-300 hover:text-white py-2 px-4 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;