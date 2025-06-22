import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';

interface TwoFactorSettingsProps {
  user: {
    twoFactorEnabled?: boolean;
  } | null;
  onUpdate: () => void;
}

export const TwoFactorSettings: React.FC<TwoFactorSettingsProps> = ({ user, onUpdate }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setIsEnabled(user?.twoFactorEnabled || false);
  }, [user]);

  const handleSetup2FA = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await apiClient.setup2FA();
      setQrCode(response.qrCode);
      setSecret(response.secret);
      setIsSetupMode(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to setup 2FA';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    try {
      setLoading(true);
      setError('');
      
      await apiClient.verify2FA(verificationCode, secret);
      setIsEnabled(true);
      setIsSetupMode(false);
      setQrCode('');
      setSecret('');
      setVerificationCode('');
      onUpdate();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid verification code';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    try {
      setLoading(true);
      setError('');
      
      await apiClient.disable2FA();
      setIsEnabled(false);
      onUpdate();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disable 2FA';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (isSetupMode) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-emerald-500/20">
        <h3 className="text-xl font-semibold text-emerald-100 mb-4">Setup Two-Factor Authentication</h3>
        
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-emerald-100/70 mb-4">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>
            {qrCode && (
              <div className="bg-white p-4 rounded-lg inline-block">
                <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-emerald-100/70 text-sm font-medium mb-2">
              Manual Entry Key (if you can't scan the QR code):
            </label>
            <div className="bg-gray-700 p-3 rounded-lg font-mono text-sm text-emerald-100 break-all">
              {secret}
            </div>
          </div>

          <div>
            <label className="block text-emerald-100/70 text-sm font-medium mb-2">
              Enter verification code from your app:
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700/50 border border-emerald-500/30 rounded-lg text-emerald-100 focus:border-emerald-400 focus:outline-none"
              placeholder="123456"
              maxLength={6}
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm">{error}</div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleVerify2FA}
              disabled={loading || !verificationCode}
              className="flex-1 bg-emerald-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-emerald-700 transition-colors duration-200 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Enable'}
            </button>
            <button
              onClick={() => setIsSetupMode(false)}
              className="px-6 py-3 text-emerald-100/70 hover:text-emerald-100 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-emerald-500/20">
      <h3 className="text-xl font-semibold text-emerald-100 mb-4">Two-Factor Authentication</h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-emerald-100 font-medium">
              2FA Status: {isEnabled ? 'Enabled' : 'Disabled'}
            </p>
            <p className="text-emerald-100/70 text-sm">
              {isEnabled 
                ? 'Your account is protected with two-factor authentication'
                : 'Add an extra layer of security to your account'
              }
            </p>
          </div>
          
          <div className={`w-12 h-6 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-gray-600'} relative transition-colors duration-200`}>
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform duration-200 ${isEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-sm">{error}</div>
        )}

        <div className="flex gap-3">
          {!isEnabled ? (
            <button
              onClick={handleSetup2FA}
              disabled={loading}
              className="bg-emerald-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-emerald-700 transition-colors duration-200 disabled:opacity-50"
            >
              {loading ? 'Setting up...' : 'Enable 2FA'}
            </button>
          ) : (
            <button
              onClick={handleDisable2FA}
              disabled={loading}
              className="bg-red-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-red-700 transition-colors duration-200 disabled:opacity-50"
            >
              {loading ? 'Disabling...' : 'Disable 2FA'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}; 