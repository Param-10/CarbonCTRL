import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, User, Mail, Bell, LogOut, Save, Check, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useCompanyStore } from '../store/companyStore';
import { supabase } from '../lib/supabase';

interface UserPreferences {
  weeklyReports: boolean;
  achievementNotifications: boolean;
  tipsRecommendations: boolean;
}

const SettingsPage = () => {
  const { user, signOut } = useAuthStore();
const {} = useCompanyStore();
  
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });
  
  const [emailPreferences, setEmailPreferences] = useState<UserPreferences>({
    weeklyReports: false,
    achievementNotifications: false,
    tipsRecommendations: false
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [notifications, setNotifications] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [loading, setLoading] = useState({
    profile: false,
    preferences: false,
    password: false
  });

  useEffect(() => {
    const loadUserData = async () => {
      if (!user) return;
      
      setProfileData({
        firstName: user.user_metadata?.first_name || '',
        lastName: user.user_metadata?.last_name || '',
        email: user.email || '',
      });
      
      // Fetch user preferences from Supabase
      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single();
          
        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching preferences:', error);
          return;
        }
        
        if (data) {
          setEmailPreferences({
            weeklyReports: data.weekly_reports || false,
            achievementNotifications: data.achievement_notifications || false,
            tipsRecommendations: data.tips_recommendations || false
          });
        }
      } catch (err) {
        console.error('Error fetching user preferences:', err);
      }
    };
    
    loadUserData();
  }, [user]);
  
  const handleProfileUpdate = async () => {
    if (!user) return;
    
    setLoading(prev => ({ ...prev, profile: true }));
    
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: profileData.firstName,
          last_name: profileData.lastName
        }
      });
      
      if (error) throw error;
      
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
  
  const handlePreferencesUpdate = async () => {
    if (!user) return;
    
    setLoading(prev => ({ ...prev, preferences: true }));
    
    try {
      const { data: existingPrefs, error: fetchError } = await supabase
        .from('user_preferences')
        .select('id')
        .eq('user_id', user.id)
        .single();
        
      let result;
      
      if (existingPrefs) {
        // Update existing preferences
        result = await supabase
          .from('user_preferences')
          .update({
            weekly_reports: emailPreferences.weeklyReports,
            achievement_notifications: emailPreferences.achievementNotifications,
            tips_recommendations: emailPreferences.tipsRecommendations,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPrefs.id);
      } else {
        // Insert new preferences
        result = await supabase
          .from('user_preferences')
          .insert({
            user_id: user.id,
            weekly_reports: emailPreferences.weeklyReports,
            achievement_notifications: emailPreferences.achievementNotifications,
            tips_recommendations: emailPreferences.tipsRecommendations,
            created_at: new Date().toISOString()
          });
      }
      
      if (result.error) throw result.error;
      
      setNotifications({ type: 'success', message: 'Preferences saved successfully' });
      setTimeout(() => setNotifications(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save preferences';
      setNotifications({ type: 'error', message: errorMessage });
      setTimeout(() => setNotifications(null), 3000);
    } finally {
      setLoading(prev => ({ ...prev, preferences: false }));
    }
  };
  
  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setNotifications({ type: 'error', message: 'Passwords do not match' });
      setTimeout(() => setNotifications(null), 3000);
      return;
    }
    
    setLoading(prev => ({ ...prev, password: true }));
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });
      
      if (error) throw error;
      
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      setIsChangingPassword(false);
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
  
  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }
    
    try {
      // In a real implementation, you would typically have a secure server-side
      // function to handle deletion of all user data
      
      // Sign out the user after successful deletion
      await signOut();
      // Redirect to the landing page
      window.location.href = '/';
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete account';
      setNotifications({ type: 'error', message: errorMessage });
      setTimeout(() => setNotifications(null), 3000);
    }
  };

  if (!user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <p className="font-mono text-emerald-100/70">Please log in to access your settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-space text-4xl font-bold text-white mb-2">Settings</h1>
        <p className="font-mono text-emerald-100/80">Manage your account preferences and security settings</p>
      </div>

      {notifications && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`p-4 rounded-lg font-mono ${notifications.type === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}
        >
          <div className="flex items-center gap-2">
            {notifications.type === 'success' ? (
              <Check className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            <p>{notifications.message}</p>
          </div>
        </motion.div>
      )}

      <div className="grid gap-6">
        {/* Profile Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="feature-card p-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-emerald-500/20 p-4 rounded-lg">
              <User className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-space text-xl font-semibold text-white">Profile Settings</h2>
              <p className="font-mono text-sm text-emerald-100/70">Manage your personal information</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-2">First Name</label>
                <input
                  type="text"
                  value={profileData.firstName}
                  onChange={(e) => setProfileData({...profileData, firstName: e.target.value})}
                  placeholder="First Name"
                  className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                />
              </div>
              <div>
                <label className="block font-mono text-sm text-emerald-100/70 mb-2">Last Name</label>
                <input
                  type="text"
                  value={profileData.lastName}
                  onChange={(e) => setProfileData({...profileData, lastName: e.target.value})}
                  placeholder="Last Name"
                  className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block font-mono text-sm text-emerald-100/70 mb-2">Email Address</label>
              <input
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                placeholder="Email Address"
                disabled
                className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono cursor-not-allowed opacity-70"
              />
              <p className="mt-1 text-xs text-emerald-100/50 font-mono">Email address cannot be changed directly</p>
            </div>
            <button 
              onClick={handleProfileUpdate}
              disabled={loading.profile}
              className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-sm py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading.profile ? (
                <>
                  <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                  Updating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Update Profile
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Email Preferences */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="feature-card p-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-emerald-500/20 p-4 rounded-lg">
              <Bell className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-space text-xl font-semibold text-white">Email Preferences</h2>
              <p className="font-mono text-sm text-emerald-100/70">Manage your notification settings</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input 
                type="checkbox" 
                checked={emailPreferences.weeklyReports}
                onChange={(e) => setEmailPreferences({...emailPreferences, weeklyReports: e.target.checked})}
                className="form-checkbox h-5 w-5 text-emerald-500 rounded border-emerald-500/30" 
              />
              <span className="font-mono text-white">Weekly Reports</span>
            </label>
            <label className="flex items-center gap-3">
              <input 
                type="checkbox"
                checked={emailPreferences.achievementNotifications}
                onChange={(e) => setEmailPreferences({...emailPreferences, achievementNotifications: e.target.checked})}
                className="form-checkbox h-5 w-5 text-emerald-500 rounded border-emerald-500/30" 
              />
              <span className="font-mono text-white">Achievement Notifications</span>
            </label>
            <label className="flex items-center gap-3">
              <input 
                type="checkbox"
                checked={emailPreferences.tipsRecommendations}
                onChange={(e) => setEmailPreferences({...emailPreferences, tipsRecommendations: e.target.checked})} 
                className="form-checkbox h-5 w-5 text-emerald-500 rounded border-emerald-500/30" 
              />
              <span className="font-mono text-white">Tips & Recommendations</span>
            </label>
            <button 
              onClick={handlePreferencesUpdate}
              disabled={loading.preferences}
              className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-sm py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading.preferences ? (
                <>
                  <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Preferences
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Security Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="feature-card p-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-emerald-500/20 p-4 rounded-lg">
              <Shield className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-space text-xl font-semibold text-white">Security</h2>
              <p className="font-mono text-sm text-emerald-100/70">Manage your account security settings</p>
            </div>
          </div>

          <div className="space-y-4">
            {isChangingPassword ? (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="block font-mono text-sm text-emerald-100/70 mb-2">New Password</label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                      placeholder="New Password"
                      className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-sm text-emerald-100/70 mb-2">Confirm New Password</label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                      placeholder="Confirm New Password"
                      className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handlePasswordChange}
                    disabled={loading.password}
                    className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-sm py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading.password ? (
                      <>
                        <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                        Changing...
                      </>
                    ) : "Change Password"}
                  </button>
                  <button 
                    onClick={() => {
                      setIsChangingPassword(false);
                      setPasswordData({
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: ''
                      });
                    }}
                    className="flex-1 bg-gray-700/50 hover:bg-gray-700/70 text-gray-300 font-mono text-sm py-3 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <button 
                onClick={() => setIsChangingPassword(true)}
                className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-sm py-3 rounded-lg transition-colors"
              >
                Change Password
              </button>
            )}
            
            <div className="pt-4 border-t border-emerald-500/10 mt-4">
              <button 
                onClick={handleDeleteAccount}
                className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-300 font-mono text-sm py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                Delete Account
              </button>
            </div>
            
            <div className="pt-4 border-t border-emerald-500/10 mt-4">
              <button 
                onClick={() => signOut()}
                className="w-full bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 font-mono text-sm py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SettingsPage;