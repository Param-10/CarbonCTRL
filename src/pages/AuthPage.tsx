import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Leaf, Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuthStore, LoginResult } from '../store/authStore';
import { loadGoogleIdentityScript } from '../lib/googleIdentity';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
// Google renders its button at a fixed pixel width within this range
const GOOGLE_BUTTON_MIN_WIDTH = 200;
const GOOGLE_BUTTON_MAX_WIDTH = 400;

const getErrorMessage = (err: unknown, fallback: string) => {
  const message = err instanceof Error ? err.message : fallback;
  if (message.includes('NetworkError') || message.includes('Failed to fetch')) {
    return 'Cannot reach the server. Check VITE_API_URL and that the API is running.';
  }
  return message;
};

export default function AuthPage() {
  const [isSignIn, setIsSignIn] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { signIn, signUp, signInWithGoogle, completeTwoFactor } = useAuthStore();

  const handleLoginResult = useCallback((result: LoginResult) => {
    if (result.twoFactorToken) {
      setTwoFactorToken(result.twoFactorToken);
      setTwoFactorCode('');
      return;
    }
    navigate('/dashboard');
  }, [navigate]);

  // Render Google's sign-in button (hidden during the 2FA step)
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || twoFactorToken) return;

    let cancelled = false;

    loadGoogleIdentityScript()
      .then(() => {
        const container = googleButtonRef.current;
        if (cancelled || !container || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async ({ credential }) => {
            setError('');
            setLoading(true);
            try {
              handleLoginResult(await signInWithGoogle(credential));
            } catch (err: unknown) {
              setError(getErrorMessage(err, 'Google sign-in failed'));
            } finally {
              setLoading(false);
            }
          },
        });

        window.google.accounts.id.renderButton(container, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: Math.min(GOOGLE_BUTTON_MAX_WIDTH, Math.max(GOOGLE_BUTTON_MIN_WIDTH, container.offsetWidth)),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load Google sign-in. Check your connection or content blocker.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [twoFactorToken, handleLoginResult, signInWithGoogle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignIn) {
        handleLoginResult(await signIn(email, password));
      } else {
        await signUp(email, password);
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'An unexpected error occurred'));
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorToken) return;

    setError('');
    setLoading(true);

    try {
      await completeTwoFactor(twoFactorToken, twoFactorCode);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Invalid verification code'));
    } finally {
      setLoading(false);
    }
  };

  const handleBackToSignIn = () => {
    setTwoFactorToken(null);
    setTwoFactorCode('');
    setError('');
  };

  if (twoFactorToken) {
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
                <ShieldCheck className="w-8 h-8 text-emerald-400" />
              </div>
            </div>

            <h2 className="text-3xl font-bold text-center text-white mb-4 font-space">
              Two-Factor Authentication
            </h2>
            <p className="text-center text-emerald-100/70 font-mono text-sm mb-8">
              Enter the 6-digit code from your authenticator app.
            </p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6">
                <p className="text-red-400 text-sm font-mono">{error}</p>
              </div>
            )}

            <form onSubmit={handleTwoFactorSubmit} className="space-y-6">
              <input
                id="two-factor-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-4 text-white text-center text-2xl tracking-[0.5em] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                placeholder="000000"
                maxLength={6}
                aria-label="Verification code"
                required
              />

              <button
                type="submit"
                disabled={loading || twoFactorCode.length !== 6}
                className="w-full bg-emerald-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-emerald-600 transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span className="font-space">{loading ? 'Verifying...' : 'Verify'}</span>
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={handleBackToSignIn}
                className="text-emerald-300 hover:text-emerald-200 transition-colors duration-200 font-mono text-sm"
              >
                Back to sign in
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

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
            {isSignIn ? 'Welcome Back' : 'Create Account'}
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6">
              <p className="text-red-400 text-sm font-mono">{error}</p>
            </div>
          )}

          {GOOGLE_CLIENT_ID && (
            <>
              {/* Google Identity Services renders its own button into this container */}
              <div ref={googleButtonRef} className="w-full flex justify-center mb-6 min-h-[44px]" />

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
                  autoComplete="email"
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
                  autoComplete={isSignIn ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-emerald-600 transition-colors duration-200 flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              <span className="font-space">
                {loading ? 'Please wait...' : isSignIn ? 'Sign In' : 'Create Account'}
              </span>
              <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignIn(!isSignIn)}
              className="text-emerald-300 hover:text-emerald-200 transition-colors duration-200 font-mono text-sm"
            >
              {isSignIn ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
