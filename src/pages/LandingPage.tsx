import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Leaf, ArrowRight, BarChart3, Globe2, Lightbulb, ShieldCheck, LucideIcon } from 'lucide-react';

const SIGN_UP_PATH = '/auth?mode=signup';

const FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: BarChart3,
    title: 'Detailed Analytics',
    description: 'Get comprehensive insights into your carbon footprint with detailed tracking and analysis.',
  },
  {
    icon: Globe2,
    title: 'Global Impact',
    description: 'Connect with eco-friendly projects worldwide and make a real difference in fighting climate change.',
  },
  {
    icon: Lightbulb,
    title: 'Smart Recommendations',
    description: 'Receive AI-powered reduction strategies tailored to your industry, company size, and biggest emission sources.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure by Default',
    description: "Sign in with Google or email, with your organization's data kept private to your account.",
  },
];

// Stagger for the .feature-card entrance animation
const FEATURE_ANIMATION_STEP_SECONDS = 0.1;

const LandingPage = () => {

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-800 via-emerald-900 to-gray-800 relative overflow-hidden">

      {/* Navigation */}
      <nav className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center gap-3">
            <Link to="/" className="flex items-center gap-2 sm:gap-3 min-w-0" aria-label="CarbonCTRL home">
              <Leaf className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-400 flex-shrink-0" />
              <span className="font-space text-white font-bold text-lg sm:text-xl hidden min-[360px]:inline">
                CarbonCTRL
              </span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <Link
                to="/auth"
                className="font-mono text-sm whitespace-nowrap px-3 sm:px-6 py-2 rounded-lg bg-transparent border border-white/20 text-emerald-100 hover:border-emerald-400/50 hover:bg-white/5 hover:text-emerald-300 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to={SIGN_UP_PATH}
                className="glass-button font-mono whitespace-nowrap px-3 sm:px-6 py-2 rounded-lg flex items-center gap-2 group"
              >
                Get Started
                <ArrowRight className="w-4 h-4 hidden sm:block transform group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-16 sm:pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="font-space text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6 heading-gradient">
              Track Your Carbon Impact
            </h1>
            <p className="font-mono text-base sm:text-xl text-emerald-100/80 mb-10 sm:mb-12">
              Monitor, reduce, and offset your environmental footprint with our comprehensive carbon tracking platform.
            </p>
            <Link
              to={SIGN_UP_PATH}
              className="glass-button inline-flex items-center gap-3 px-8 py-4 rounded-lg text-lg font-mono group text-white"
            >
              Get Started
              <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </main>

      {/* Features Section */}
      <section className="relative z-10 pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="font-space text-3xl sm:text-4xl font-bold text-white mb-4">
              Comprehensive Carbon Management
            </h2>
            <p className="font-mono text-base sm:text-lg text-emerald-100/80">
              Everything you need to understand and reduce your carbon footprint
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {FEATURES.map(({ icon: Icon, title, description }, index) => (
              <div
                key={title}
                className="feature-card p-6 sm:p-8 rounded-xl"
                style={{ animationDelay: `${index * FEATURE_ANIMATION_STEP_SECONDS}s` }}
              >
                <div className="bg-emerald-500/20 p-4 rounded-lg w-fit mb-6">
                  <Icon className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="font-space text-xl font-semibold text-white mb-4">
                  {title}
                </h3>
                <p className="font-mono text-emerald-100/70">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
