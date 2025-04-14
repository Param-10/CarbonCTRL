import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Leaf, ArrowRight, BarChart3, Globe2 } from 'lucide-react';



const LandingPage = () => {
  // Add state to control when to load heavy components
  const [isVisible, setIsVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check if user prefers reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    // Delay showing the 3D scene for faster initial rendering
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-800 via-emerald-900 to-gray-800 relative overflow-hidden">

      {/* Navigation */}
      <nav className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-3">
              <Leaf className="w-8 h-8 text-emerald-400" />
              <span className="font-space text-white font-bold text-xl">CarbonCTRL</span>
            </div>
            <div className="flex items-center gap-6">
              <Link to="/auth" className="font-mono text-emerald-100 hover:text-emerald-300 transition-colors">
                Sign In
              </Link>
              <Link
                to="/auth"
                className="glass-button font-mono px-6 py-2 rounded-lg flex items-center gap-2 group"
              >
                Get Started
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="font-space text-6xl font-bold text-white mb-6 heading-gradient">
              Track Your Carbon Impact
            </h1>
            <p className="font-mono text-xl text-emerald-100/80 mb-12">
              Monitor, reduce, and offset your environmental footprint with our comprehensive carbon tracking platform.
            </p>
            <Link
              to="/auth"
              className="glass-button inline-flex items-center gap-3 px-8 py-4 rounded-lg text-lg font-mono group text-white"
            >
              Start Your Journey
              <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </main>

      {/* Features Section */}
      <section className="relative z-10 bg-gray-900/50 backdrop-blur-xl py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-space text-4xl font-bold text-white mb-4">
              Comprehensive Carbon Management
            </h2>
            <p className="font-mono text-lg text-emerald-100/80">
              Everything you need to understand and reduce your carbon footprint
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 justify-items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="feature-card p-8 rounded-xl"
            >
              <div className="bg-emerald-500/20 p-4 rounded-lg w-fit mb-6">
                <BarChart3 className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="font-space text-xl font-semibold text-white mb-4">
                Detailed Analytics
              </h3>
              <p className="font-mono text-emerald-100/70">
                Get comprehensive insights into your carbon footprint with detailed tracking and analysis.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="feature-card p-8 rounded-xl"
            >
              <div className="bg-emerald-500/20 p-4 rounded-lg w-fit mb-6">
                <Globe2 className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="font-space text-xl font-semibold text-white mb-4">
                Global Impact
              </h3>
              <p className="font-mono text-emerald-100/70">
                Connect with eco-friendly projects worldwide and make a real difference in fighting climate change.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-12 rounded-2xl"
          >
            <h2 className="font-space text-4xl font-bold text-white mb-6">
              Ready to Make a Difference?
            </h2>
            <p className="font-mono text-xl text-emerald-100/80 mb-8">
              Join thousands of others tracking their environmental impact today.
            </p>
            <Link
              to="/auth"
              className="glass-button inline-flex items-center gap-3 px-8 py-4 rounded-lg text-lg font-mono group text-white"
            >
              Create Your Account
              <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
