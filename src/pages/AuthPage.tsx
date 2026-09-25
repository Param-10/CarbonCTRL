import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Leaf, Mail, Lock, User, ArrowLeft, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { ApiError, type GoogleLinkOptions } from '../lib/api';
import { initializeGoogleSignIn, loadGoogleIdentityScript } from '../lib/googleIdentity';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
// Google renders its button at a fixed pixel width within this range
const GOOGLE_BUTTON_MIN_WIDTH = 200;
const GOOGLE_BUTTON_MAX_WIDTH = 400;
// Must match the server's limits
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 72;
const MAX_NAME_LENGTH = 100;
const LINK_PASSWORD_REQUIRED = 'LINK_PASSWORD_REQUIRED';

const isLinkPasswordError = (err: unknown) => err instanceof ApiError && err.code === LINK_PASSWORD_REQUIRED;

const getErrorMessage = (err: unknown, fallback: string) => {
  const message = err instanceof Error ? err.message : fallback;
  if (message.includes('NetworkError') || message.includes('Failed to fetch')) {
    return 'Cannot reach the server. Check VITE_API_URL and that the API is running.';
  }
  return message;
};

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const [isSignIn, setIsSignIn] = useState(searchParams.get('mode') !== 'signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Google credential waiting for the existing account's password (or consent to remove it)
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState<string | null>(null);
  const [linkPassword, setLinkPassword] = useState('');
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { signIn, signUp, signInWithGoogle } = useAuthStore();

  // Render Google's sign-in button
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    let cancelled = false;

    loadGoogleIdentityScript()
      .then(() => {
        const container = googleButtonRef.current;
        if (cancelled || !container || !window.google) return;

        initializeGoogleSignIn(GOOGLE_CLIENT_ID, async (credential) => {
          setError('');
          setLoading(true);
          try {
            await signInWithGoogle(credential);
            navigate('/dashboard');
          } catch (err: unknown) {
            if (isLinkPasswordError(err)) {
              setLinkPassword('');
              setPendingGoogleCredential(credential);
            } else {
              setError(getErrorMessage(err, 'Google sign-in failed'));
            }
          } finally {
            setLoading(false);
          }
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
  }, [navigate, signInWithGoogle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignIn) {
        await signIn(email, password);
      } else {
        await signUp(name, email, password);
      }
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'An unexpected error occurred'));
    } finally {
      setLoading(false);
    }
  };

  const linkGoogleAccount = async (link: GoogleLinkOptions) => {
    if (!pendingGoogleCredential) return;
    setError('');
    setLoading(true);

    try {
      await signInWithGoogle(pendingGoogleCredential, link);
      navigate('/dashboard');
    } catch (err: unknown) {
      // Any other failure (e.g. the Google credential expired) needs a fresh Google sign-in
      if (!isLinkPasswordError(err)) {
        setPendingGoogleCredential(null);
      }
      setError(getErrorMessage(err, 'Could not connect Google'));
    } finally {
      setLoading(false);
    }
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    linkGoogleAccount({ password: linkPassword });
  };

  const cancelGoogleLink = () => {
    setPendingGoogleCredential(null);
    setLinkPassword('');
    setError('');
  };

  const handleToggleMode = () => {
    setIsSignIn(!isSignIn);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-800 via-emerald-900 to-gray-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 mb-4 text-emerald-100/70 hover:text-emerald-200 transition-colors duration-200 font-mono text-sm group"
        >
          <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" />
          <span>Back</span>
        </Link>

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
            {pendingGoogleCredential ? 'Connect Google' : isSignIn ? 'Welcome Back' : 'Create Account'}
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6">
              <p className="text-red-400 text-sm font-mono">{error}</p>
            </div>
          )}

          {GOOGLE_CLIENT_ID && (
            // Hidden rather than unmounted while linking: Google renders its button into this container only once
            <div className={pendingGoogleCredential ? 'hidden' : undefined}>
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
            </div>
          )}

          {pendingGoogleCredential ? (
            <form onSubmit={handleLinkSubmit} className="space-y-6">
              <p className="text-emerald-100/80 text-sm font-mono">
                An account with this email already exists. Enter its password to connect your Google account.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2 font-mono" htmlFor="link-password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="link-password"
                    type="password"
                    autoComplete="current-password"
                    value={linkPassword}
                    onChange={(e) => setLinkPassword(e.target.value)}
                    className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                    placeholder="Enter your password"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-emerald-600 transition-colors duration-200 flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                <span className="font-space">{loading ? 'Please wait...' : 'Connect Google'}</span>
                <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="border-t border-emerald-500/30 pt-6">
                <p className="text-emerald-100/70 text-xs font-mono mb-3">
                  Don't know this password? Continue with Google only. The password will be removed and every other
                  device signed in to this account will be signed out.
                </p>
                <button
                  type="button"
                  onClick={() => linkGoogleAccount({ discardPassword: true })}
                  disabled={loading}
                  className="w-full border border-emerald-500/30 text-emerald-300 py-2 px-4 rounded-lg font-mono text-sm hover:bg-emerald-500/10 transition-colors duration-200 disabled:opacity-50"
                >
                  Continue with Google only
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {!isSignIn && (
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2 font-mono" htmlFor="name">
                    Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="name"
                      type="text"
                      autoComplete="name"
                      maxLength={MAX_NAME_LENGTH}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                </div>
              )}

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
                    minLength={isSignIn ? undefined : MIN_PASSWORD_LENGTH}
                    maxLength={isSignIn ? undefined : MAX_PASSWORD_LENGTH}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                    placeholder={isSignIn ? 'Enter your password' : 'At least 6 characters'}
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
          )}

          <div className="mt-6 text-center">
            <button
              onClick={pendingGoogleCredential ? cancelGoogleLink : handleToggleMode}
              className="text-emerald-300 hover:text-emerald-200 transition-colors duration-200 font-mono text-sm"
            >
              {pendingGoogleCredential
                ? 'Cancel'
                : isSignIn ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
