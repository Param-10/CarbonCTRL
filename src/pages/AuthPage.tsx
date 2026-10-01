import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Leaf, Mail, Lock, ArrowLeft, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { apiClient, ApiError } from '../lib/api';
import { initializeGoogleSignIn, loadGoogleIdentityScript } from '../lib/googleIdentity';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const [isSignIn, setIsSignIn] = useState(searchParams.get('mode') !== 'signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  // Google linking challenge: the email already has a password that must be
  // proven (or explicitly discarded) before the Google identity is attached.
  const [pendingGoogleLink, setPendingGoogleLink] = useState<{ idToken: string } | null>(null);
  const [linkPassword, setLinkPassword] = useState('');
  const [linkMode, setLinkMode] = useState<'password' | 'discard'>('password');
  const [linkLoading, setLinkLoading] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { signIn, signUp, setSession } = useAuthStore();

  // Keep Google's existing one-tap button flow from main. The signed ID token
  // is verified by the server before a session is issued.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;

    loadGoogleIdentityScript().then(() => {
      const container = googleButtonRef.current;
      if (cancelled || !container || !window.google) return;

      initializeGoogleSignIn(GOOGLE_CLIENT_ID, async (credential) => {
        setError('');
        setLoading(true);
        try {
          const response = await apiClient.googleAuth(credential);
          const user = { ...response.user, id: response.user._id };
          setSession({ access_token: response.token, user });
          navigate('/dashboard');
        } catch (err) {
          if (err instanceof ApiError && err.code === 'LINK_PASSWORD_REQUIRED') {
            setPendingGoogleLink({ idToken: credential });
            setLinkPassword('');
          } else {
            setError(err instanceof Error ? err.message : 'Google sign-in failed');
          }
        } finally {
          setLoading(false);
        }
      });

      window.google.accounts.id.renderButton(container, {
        theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular',
        width: Math.min(370, Math.max(240, container.offsetWidth)),
      });
    }).catch(() => {
      if (!cancelled) setError('Could not load Google sign-in. Check your connection or content blocker.');
    });

    return () => { cancelled = true; };
  }, [navigate, setSession]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // A second click while the first request runs would sign up twice
    if (loading) return;
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
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setForgotMessage('');

    try {
      const result = await apiClient.forgotPassword(forgotEmail);
      setForgotMessage(result.message);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request password reset';
      setError(errorMessage);
    }
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
          <Link to="/" className="inline-flex items-center gap-2 mb-4 text-emerald-100/70 hover:text-emerald-200 font-mono text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
          <div className="flex justify-center mb-8">
            <div className="bg-emerald-500/20 p-4 rounded-full">
              <Leaf className="w-8 h-8 text-emerald-400" />
            </div>
          </div>

          <h2 className="text-3xl font-bold text-center text-white mb-8 font-space">
            {pendingGoogleLink ? 'Link Google Account'
              : forgotMode ? 'Reset Password'
              : isSignIn ? 'Welcome Back' : 'Create Account'}
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6">
              <p className="text-red-400 text-sm font-mono">{error}</p>
            </div>
          )}

          {/* Keep Google's rendered button mounted while showing account challenges. */}
          <div className={forgotMode || pendingGoogleLink ? 'hidden' : 'mb-6'}>
            <div ref={googleButtonRef} className="flex justify-center" />
            {GOOGLE_CLIENT_ID && <div className="relative mt-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-emerald-500/30"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-800 text-emerald-100/70 font-mono">or</span>
                </div>
            </div>}
          </div>

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

          {forgotMode && (
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

          {!forgotMode && !pendingGoogleLink && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {!isSignIn && (
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2 font-mono" htmlFor="name">Name</label>
                  <input
                    id="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                    required
                    className="w-full bg-gray-800/50 border border-emerald-500/30 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                    placeholder="Enter your name"
                  />
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

          {!forgotMode && !pendingGoogleLink && (
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
