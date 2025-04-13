import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Leaf, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function AuthPage() {
  const [isSignIn, setIsSignIn] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { signIn, signUp } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isSignIn) {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
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
            {isSignIn ? 'Welcome Back' : 'Create Account'}
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6">
              <p className="text-red-400 text-sm font-mono">{error}</p>
            </div>
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
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-emerald-600 transition-colors duration-200 flex items-center justify-center gap-2 group"
            >
              <span className="font-space">{isSignIn ? 'Sign In' : 'Create Account'}</span>
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