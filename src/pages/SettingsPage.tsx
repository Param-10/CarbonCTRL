import React from 'react';
import { motion } from 'framer-motion';
import { Shield, User, Mail } from 'lucide-react';

const SettingsPage = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-space text-4xl font-bold text-white mb-2">Settings</h1>
        <p className="font-mono text-emerald-100/80">Manage your account preferences and security settings</p>
      </div>

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
              <input
                type="text"
                placeholder="First Name"
                className="bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
              />
              <input
                type="text"
                placeholder="Last Name"
                className="bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
              />
            </div>
            <input
              type="email"
              placeholder="Email Address"
              className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
            />
            <button className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-sm py-3 rounded-lg transition-colors">
              Update Profile
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
              <Mail className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-space text-xl font-semibold text-white">Email Preferences</h2>
              <p className="font-mono text-sm text-emerald-100/70">Manage your notification settings</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input type="checkbox" className="form-checkbox h-5 w-5 text-emerald-500 rounded border-emerald-500/30" />
              <span className="font-mono text-white">Weekly Reports</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="form-checkbox h-5 w-5 text-emerald-500 rounded border-emerald-500/30" />
              <span className="font-mono text-white">Achievement Notifications</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="form-checkbox h-5 w-5 text-emerald-500 rounded border-emerald-500/30" />
              <span className="font-mono text-white">Tips & Recommendations</span>
            </label>
            <button className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-sm py-3 rounded-lg transition-colors">
              Save Preferences
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
            <button className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-sm py-3 rounded-lg transition-colors">
              Change Password
            </button>
            <button className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-300 font-mono text-sm py-3 rounded-lg transition-colors">
              Delete Account
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SettingsPage;