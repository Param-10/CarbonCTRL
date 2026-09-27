import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Leaf, Mail, Lock, ArrowRight, KeyRound } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { apiClient, ApiError } from '../lib/api';

// Extend Window interface for Google
interface GoogleAccounts {
  id: {
    initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
    prompt: () => void;
  };
}

declare global {
  interface Window {
    google?: {
      accounts: GoogleAccounts;
    };
  }
}

const GOOGLE_REDIRECT_URI = () => `${window.location.origin}/oauth-callback.html`;

export default function AuthPage() {
  const [isSignIn, setIsSignIn] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  // Google linking challenge: the email already has a password that must be
  // proven (or explicitly discarded) before the Google identity is attached.
  const [pendingGoogleLink, setPendingGoogleLink] = useState<{ idToken: string } | null>(null);
  const [linkPassword, setLinkPassword] = useState('');
  const [linkMode, setLinkMode] = useState<'password' | 'discard'>('password');
  const [linkLoading, setLinkLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn, signUp, signInWith2FA, setSession } = useAuthStore();

  // Handle Google OAuth callback
  useEffect(() => {
    const handleGoogleCallback = async (code: string) => {
      try {
        console.log('Starting Google OAuth callback processing...');
        setLoading(true);
        setError('');
        
        // Send authorization code + the redirect URI it was issued against to
        // the backend, which exchanges it for tokens and verifies the ID token.
        console.log('Sending auth code to backend...');
        const response = await apiClient.googleAuth(code, GOOGLE_REDIRECT_URI());
        console.log('Backend response received:', response);
        
        // Set the user session in the auth store
        const user = { ...response.user, id: response.user._id }; // Add id for compatibility
        const session = { access_token: response.token, user };
        setSession(session);
        
        console.log('Google session set, navigating to dashboard...');
        navigate('/dashboard');
      } catch (err) {
        console.error('Google OAuth callback error:', err);
        // The email already has a password — the server returns a reusable
        // Google ID token so we can prove/discard the password here without
        // re-running the OAuth popup.
        if (
          err instanceof ApiError &&
          err.code === 'LINK_PASSWORD_REQUIRED' &&
          typeof err.payload?.idToken === 'string'
        ) {
          setPendingGoogleLink({ idToken: err.payload.idToken });
          setError('');
          return;
        }
        const errorMessage = err instanceof Error ? err.message : 'Google authentication failed';
        if (errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
          setError('Authentication failed: API unreachable. Check VITE_API_URL and that the server is running.');
        } else {
          setError(errorMessage);
        }
      } finally {
        setLoading(false);
      }
    };

    // Listen for messages from the popup window
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'GOOGLE_OAUTH_SUCCESS') {
        console.log('Received OAuth success message:', event.data);
        handleGoogleCallback(event.data.code);
      } else if (event.data.type === 'GOOGLE_OAUTH_ERROR') {
        console.error('OAuth error:', event.data.error);
        setError(event.data.error || 'Google authentication failed');
        setLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate, setSession, setError, setLoading]);

  const handleGoogleSignIn = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-google-client-id';
    if (!clientId || clientId === 'your-google-client-id') {
      setError('Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID in your frontend environment.');
      return;
    }
    const redirectUri = GOOGLE_REDIRECT_URI();
    
    // Debug logging
    console.log('Opening Google OAuth popup...');
    console.log('Client ID:', clientId);
    
    // Use the exact format from Google OAuth 2.0 playground
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent('openid email profile')}&` +
      `access_type=offline&` +
      `prompt=consent`;
    
    console.log('OAuth URL:', authUrl);
    
    setLoading(true);
    
    // Open popup window
    const popup = window.open(
      authUrl,
      'google-oauth',
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );
    
    // Check if popup was blocked
    if (!popup) {
      setError('Popup was blocked. Please allow popups for this site.');
      setLoading(false);
      return;
    }
    
    // Monitor popup
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        setLoading(false);
        console.log('Popup closed by user');
      }
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isSignIn) {
        const twoFactor = await signIn(email, password);
        if (twoFactor) {
          // Account has 2FA enabled — ask for the authenticator code
          setTwoFactorToken(twoFactor.twoFactorToken);
          return;
        }
      } else {
        await signUp(email, password);
      }
      navigate('/dashboard');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (!twoFactorToken) return;
      await signInWith2FA(twoFactorToken, twoFactorCode);
      navigate('/dashboard');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid verification code';
      setError(errorMessage);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setForgotMessage('');

    try {
      const result = await apiClient.forgotPassword(forgotEmail);
      setForgotMessage(
        result.resetUrl
          ? `${result.message} Reset link: ${result.resetUrl}`
          : result.message
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request password reset';
      setError(errorMessage);
    }
  };

  const cancelTwoFactor = () => {
    setTwoFactorToken(null);
    setTwoFactorCode('');
  };

  const handleGoogleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingGoogleLink) return;
    setLinkLoading(true);
    setError('');

    try {
      const options =
        linkMode === 'password'
          ? { password: linkPassword }
          : { discardPassword: true };
      const response = await apiClient.googleLink(pendingGoogleLink.idToken, options);
      const user = { ...response.user, id: response.user._id }; // Add id for compatibility
      setSession({ access_token: response.token, user });
      setPendingGoogleLink(null);
      setLinkPassword('');
      navigate('/dashboard');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to link Google account';
      setError(errorMessage);
    } finally {
      setLinkLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-800 via-emerald-900 to-gray-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 rounded-2xl"
        >
          <div className="flex justify-center mb-8">
            <div className="bg-emerald-500/20 p-4 rounded-full">
              <Leaf className="w-8 h-8 text-emerald-400" />
            </div>
          </div>

          <h2 className="text-3xl font-bold text-center text-white mb-8 font-space">
            {pendingGoogleLink ? 'Link Google Account'
              : twoFactorToken && !forgotMode ? 'Two-Factor Authentication'
              : forgotMode ? 'Reset Password'
              : isSignIn ? 'Welcome Back' : 'Create Account'}
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6">
              <p className="text-red-400 text-sm font-mono">{error}</p>
            </div>
          )}

          {/* Google Sign-In Button (hidden during 2FA / forgot-password steps) */}
          {!twoFactorToken && !forgotMode && !pendingGoogleLink && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full bg-white text-gray-900 py-3 px-6 rounded-lg font-semibold hover:bg-gray-100 transition-colors duration-200 flex items-center justify-center gap-3 mb-6 disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-emerald-500/30"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-800 text-emerald-100/70 font-mono">or</span>
                </div>
              </div>
            </>
          )}

          {pendingGoogleLink && (
            <>
              <p className="text-center text-sm text-emerald-100/80 font-mono mb-6">
                This email already has a password. Prove it to link your Google
                account — or continue with Google only (the password is removed).
              </p>

              <form onSubmit={handleGoogleLinkSubmit} className="space-y-6">
                {linkMode === 'password' ? (
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-200 mb-2 font-mono"
                      htmlFor="google-link-password"
                    >
                      Account Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        id="google-link-password"
                        type="password"
                        value={linkPassword}
                        onChange={(e) => setLinkPassword(e.target.value)}
                        className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                        placeholder="Enter your existing password"
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
                    <p className="text-yellow-300 text-sm font-mono">
                      Your account's password will be removed and you'll sign in
                      with Google only.
                    </p>
                  </div>
                )}

                {linkMode === 'password' && (
                  <button
                    type="button"
                    onClick={() => { setLinkMode('discard'); setLinkPassword(''); }}
                    className="w-full text-center text-emerald-100/60 hover:text-emerald-100 transition-colors duration-200 font-mono text-sm"
                  >
                    I don't know the password — sign in with Google only
                  </button>
                )}

                <button
                  type="submit"
                  disabled={linkLoading || (linkMode === 'password' && !linkPassword)}
                  className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-sm py-3 px-6 rounded-lg transition-colors duration-200 disabled:opacity-50"
                >
                  {linkLoading ? 'Linking...' : linkMode === 'password' ? 'Link & Continue' : 'Continue Without Password'}
                </button>

                {linkMode === 'discard' && (
                  <button
                    type="button"
                    onClick={() => setLinkMode('password')}
                    className="w-full text-center text-emerald-100/60 hover:text-emerald-100 transition-colors duration-200 font-mono text-sm"
                  >
                    Back — enter my password
                  </button>
                )}
              </form>
            </>
          )}

          {twoFactorToken && !forgotMode && (
            <>
              {/* 2FA code entry */}
              <p className="text-center text-sm text-emerald-100/80 font-mono mb-6">
                Enter the 6-digit code from your authenticator app to complete sign-in.
              </p>
              <form onSubmit={handleTwoFactorSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2 font-mono" htmlFor="2fa-code">
                    Authentication Code
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="2fa-code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                      placeholder="123456"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || twoFactorCode.length !== 6}
                  className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-sm py-3 px-6 rounded-lg transition-colors duration-200 disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify & Sign In'}
                </button>
                <button
                  type="button"
                  onClick={cancelTwoFactor}
                  className="w-full text-center text-emerald-100/60 hover:text-emerald-100 transition-colors duration-200 font-mono text-sm"
                >
                  Back to sign in
                </button>
              </form>
            </>
          )}

          {forgotMode && !twoFactorToken && (
            <>
              <p className="text-center text-sm text-emerald-100/80 font-mono mb-6">
                Enter your account email and we'll send you a password reset link.
              </p>
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2 font-mono" htmlFor="forgot-email">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                </div>

                {forgotMessage && (
                  <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4">
                    <p className="text-emerald-300 text-sm font-mono break-all">{forgotMessage}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-sm py-3 px-6 rounded-lg transition-colors duration-200 disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setForgotMessage(''); setForgotEmail(''); }}
                  className="w-full text-center text-emerald-100/60 hover:text-emerald-100 transition-colors duration-200 font-mono text-sm"
                >
                  Back to sign in
                </button>
              </form>
            </>
          )}

          {!twoFactorToken && !forgotMode && !pendingGoogleLink && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2 font-mono" htmlFor="email">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2 font-mono" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                    placeholder="Enter your password"
                    required
                  />
                </div>
                {isSignIn && (
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      onClick={() => { setForgotMode(true); setError(''); }}
                      className="text-emerald-300/80 hover:text-emerald-200 transition-colors duration-200 font-mono text-xs"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-sm py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-3 disabled:opacity-50 group"
              >
                <span className="font-space">{loading ? 'Please wait...' : isSignIn ? 'Sign In' : 'Create Account'}</span>
                {!loading && <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />}
              </button>
            </form>
          )}

          {!twoFactorToken && !forgotMode && !pendingGoogleLink && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setIsSignIn(!isSignIn)}
                className="text-emerald-300 hover:text-emerald-200 transition-colors duration-200 font-mono text-sm"
              >
                {isSignIn ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}