import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MotionConfig, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarPlus,
  Check,
  Compass,
  FileText,
  Lightbulb,
  ListChecks,
  LucideIcon,
  Sparkles,
  TrendingDown,
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { useActionStore } from '../store/actionStore';
import { useCarbonStore } from '../store/carbonStore';
import { useCompanyStore } from '../store/companyStore';

type StepKey = 'profile' | 'log' | 'score' | 'recommend' | 'plan' | 'report';

interface Step {
  key: StepKey;
  icon: LucideIcon;
  title: string;
  where: string;
  description: string;
  tip?: string;
  link: { to: string; label: string };
  /** Done whenever needed rather than once, so never marked complete */
  optional?: boolean;
}

const STEPS: Step[] = [
  {
    key: 'profile',
    icon: Building2,
    title: 'Tell us about your company',
    where: 'Company Profile',
    description:
      'Your industry, number of employees and state. Your state sets how clean your electricity is, and your industry and size decide which businesses you are compared with.',
    tip: 'The optional Sustainability Context (budget, premises, vehicles) makes AI recommendations fit what you can actually do.',
    link: { to: '/company-profile', label: 'Open Company Profile' },
  },
  {
    key: 'log',
    icon: CalendarPlus,
    title: 'Log your month',
    where: 'Dashboard, then Log a Month',
    description:
      "Enter last month's totals from your bills: electricity, gas, fuel, flights and trash. For electricity, gas and fuel you can enter the dollar amount from the bill instead.",
    tip: 'Add a one-off item, like a single flight, any time with Add Activity.',
    link: { to: '/dashboard', label: 'Open Dashboard' },
  },
  {
    key: 'score',
    icon: BarChart3,
    title: 'See your footprint and grade',
    where: 'Dashboard',
    description:
      'Everything is converted into tonnes of CO₂e using published emission factors, mostly from the US EPA. Your grade, from A+ to F, compares your emissions per employee with a typical business like yours.',
    tip: 'Your grade is provisional until you have logged 3 months.',
    link: { to: '/dashboard', label: 'Open Dashboard' },
  },
  {
    key: 'recommend',
    icon: Sparkles,
    title: 'Get AI recommendations',
    where: 'Recommendations',
    description:
      'Google Gemini suggests 4 to 6 actions that fit your budget, premises and vehicles, ranked by how much they cut. They refresh on their own when your data changes.',
    link: { to: '/recommendations', label: 'Open Recommendations' },
  },
  {
    key: 'plan',
    icon: ListChecks,
    title: 'Build your action plan',
    where: 'Action Plan',
    description:
      'Add the actions you will take, move them from Planned to Done, and see how far they get you toward your reduction target.',
    tip: 'Set a target, such as 30% by 2030, on your Company Profile.',
    link: { to: '/action-plan', label: 'Open Action Plan' },
  },
  {
    key: 'report',
    icon: FileText,
    title: 'Share your results',
    where: 'Report',
    description: 'Download a CSV or print a PDF for any period, for your team, customers or investors.',
    link: { to: '/report', label: 'Open Report' },
    optional: true,
  },
];

const LOOP: { icon: LucideIcon; label: string }[] = [
  { icon: CalendarPlus, label: 'Log' },
  { icon: BarChart3, label: 'See' },
  { icon: ListChecks, label: 'Act' },
  { icon: TrendingDown, label: 'Improve' },
];

const TERMS: { term: string; meaning: string }[] = [
  {
    term: 'tCO₂e',
    meaning:
      'Metric tonnes of carbon dioxide equivalent. Other greenhouse gases are counted as the amount of CO₂ with the same warming effect, so everything adds up to one number. For scale, a typical US passenger car emits about 4.6 tonnes of CO₂ a year (EPA).',
  },
  {
    term: 'Your grade',
    meaning:
      'A+ to F. It compares your yearly emissions per employee with a typical business like yours in your state, so a small company is not penalized for being small, and a large one is not rewarded for being large.',
  },
  {
    term: 'Emission factor',
    meaning:
      'How much CO₂e one unit of activity causes, such as one kWh of electricity or one gallon of gasoline. Every factor and its source is listed on the Methodology page.',
  },
];

const QUESTIONS: { question: string; answer: string; link?: { to: string; label: string } }[] = [
  {
    question: 'Do I need exact numbers?',
    answer: 'No. Bill amounts and rough figures work, estimates are labeled, and you can edit any entry later.',
  },
  {
    question: 'What does the AI see?',
    answer:
      'Your industry, size, location, the details you add to your profile and your activity totals. Never your company name or contact details.',
  },
  {
    question: 'Where do the numbers come from?',
    answer: 'Mostly from US EPA and EIA data. Every factor, benchmark and source is on the Methodology page.',
    link: { to: '/methodology', label: 'Open Methodology' },
  },
  {
    question: 'Will you remind me to log?',
    answer: 'If you want. Turn on the monthly reminder email in Settings.',
    link: { to: '/settings', label: 'Open Settings' },
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
};

/** Which steps are done, from the company's own data; null until everything has loaded. */
function useStepProgress(): Partial<Record<StepKey, boolean>> | null {
  const { profile, loaded: profileLoaded } = useCompanyStore();
  const { activities, carbonScore, initialized: carbonLoaded } = useCarbonStore();
  const { actions, loaded: actionsLoaded, load: loadActions } = useActionStore();
  const [hasRecommendations, setHasRecommendations] = useState<boolean | null>(null);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getLatestRecommendations()
      .then(({ saved }: { saved: unknown }) => !cancelled && setHasRecommendations(Boolean(saved)))
      .catch(() => !cancelled && setHasRecommendations(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!profileLoaded || !carbonLoaded || !actionsLoaded || hasRecommendations === null) return null;
  return {
    profile: Boolean(profile?.name),
    log: activities.length > 0,
    score: Boolean(carbonScore),
    recommend: hasRecommendations,
    plan: actions.length > 0,
  };
}

/** A new user's guide: what CarbonCTRL is, the monthly routine, and what to do next. */
const HowItWorksPage = () => {
  const { profile } = useCompanyStore();
  const progress = useStepProgress();
  const reduceMotion = useReducedMotion();

  // New companies go through the guided setup rather than the full profile form
  const linkFor = (step: Step) => (step.key === 'profile' && !profile?.name ? { to: '/onboarding', label: 'Start setup' } : step.link);
  const nextStep = progress ? STEPS.find((step) => !step.optional && !progress[step.key]) : undefined;

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-space text-3xl sm:text-4xl font-bold text-white mb-2">How CarbonCTRL works</h1>
          <p className="font-mono text-emerald-100/80 max-w-3xl">
            Measure your company's carbon footprint, see how it compares with similar businesses, and cut it. It takes a few
            minutes a month.
          </p>

          <ol aria-label="The monthly routine" className="mt-6 flex flex-wrap items-center gap-2 font-mono text-sm">
            {LOOP.map(({ icon: Icon, label }, index) => (
              <motion.li
                key={label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + index * 0.15 }}
                className="flex items-center gap-2"
              >
                <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-100">
                  <Icon className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                  {label}
                </span>
                {index < LOOP.length - 1 && <ArrowRight className="w-4 h-4 text-emerald-400/60" aria-hidden="true" />}
              </motion.li>
            ))}
            <motion.li
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 + LOOP.length * 0.15 }}
              className="text-emerald-100/60 pl-2"
            >
              then repeat each month
            </motion.li>
          </ol>
        </motion.div>

        {progress && (
          <section aria-labelledby="next-step-title" className="feature-card p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-500/20 p-4 rounded-lg">
                <Compass className="w-6 h-6 text-emerald-400" aria-hidden="true" />
              </div>
              <div>
                {nextStep && <p className="font-mono text-xs text-amber-200">Your next step</p>}
                <h2 id="next-step-title" className="font-space text-xl font-semibold text-white">
                  {nextStep ? nextStep.title : "You're all set up"}
                </h2>
                <p className="font-mono text-sm text-emerald-100/70">
                  {nextStep
                    ? `Go to ${nextStep.where}.`
                    : 'Log each month when your bills arrive to keep your grade and recommendations current.'}
                </p>
              </div>
            </div>
            <Link
              to={nextStep ? linkFor(nextStep).to : '/dashboard'}
              className="px-5 py-3 rounded-lg inline-flex items-center gap-2 font-mono text-sm bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              {nextStep ? linkFor(nextStep).label : 'Open Dashboard'}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </section>
        )}

        <section aria-labelledby="steps-title">
          <h2 id="steps-title" className="font-space text-2xl font-semibold text-white mb-6">Step by step</h2>
          <ol className="relative space-y-6">
            {/* The line joining the step numbers draws in as the list scrolls into view */}
            <motion.div
              aria-hidden="true"
              className="absolute left-6 top-6 bottom-6 w-px bg-emerald-500/30 origin-top"
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
            {STEPS.map((step, index) => {
              const done = Boolean(progress?.[step.key]) && !step.optional;
              const isNext = step === nextStep;
              const link = linkFor(step);
              return (
                <motion.li key={step.key} {...fadeUp} transition={{ duration: 0.4 }} className="relative pl-16">
                  <span
                    className={`absolute left-0 top-0 w-12 h-12 rounded-full flex items-center justify-center font-space text-lg border-2 ${
                      done
                        ? 'bg-emerald-700 border-emerald-400 text-white'
                        : isNext
                          ? 'bg-gray-900 border-amber-300 text-amber-200'
                          : 'bg-gray-900 border-emerald-500/40 text-emerald-300'
                    }`}
                  >
                    {done ? <Check className="w-5 h-5" aria-hidden="true" /> : index + 1}
                    {isNext && !reduceMotion && (
                      <motion.span
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full border-2 border-amber-300"
                        animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                      />
                    )}
                  </span>

                  <div className="feature-card p-6">
                    <div className="flex items-start gap-4">
                      <div className="bg-emerald-500/20 p-3 rounded-lg flex-shrink-0 hidden sm:block">
                        <step.icon className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-space text-lg font-semibold text-white">{step.title}</h3>
                          {done && <span className="px-2 py-0.5 rounded-full text-xs font-mono text-emerald-200 bg-emerald-500/20">Done</span>}
                          {isNext && <span className="px-2 py-0.5 rounded-full text-xs font-mono text-amber-200 bg-amber-500/15">Your next step</span>}
                          {step.optional && <span className="px-2 py-0.5 rounded-full text-xs font-mono text-emerald-100/80 bg-white/5">When you need it</span>}
                        </div>
                        <p className="font-mono text-xs text-emerald-300/80">Where: {step.where}</p>
                        <p className="font-mono text-sm text-emerald-100/80 leading-relaxed">{step.description}</p>
                        {step.tip && (
                          <p className="font-mono text-xs text-emerald-100/70 flex items-start gap-2">
                            <Lightbulb className="w-4 h-4 text-amber-300/80 flex-shrink-0" aria-hidden="true" />
                            <span>{step.tip}</span>
                          </p>
                        )}
                        <Link to={link.to} className="inline-flex items-center gap-1 font-mono text-sm text-emerald-300 hover:text-emerald-200 group">
                          {link.label}
                          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="terms-title">
          <h2 id="terms-title" className="font-space text-2xl font-semibold text-white mb-6">Key terms, in plain English</h2>
          <div className="grid gap-6 lg:grid-cols-3">
            {TERMS.map(({ term, meaning }, index) => (
              <motion.div key={term} {...fadeUp} transition={{ duration: 0.4, delay: index * 0.1 }}>
                <div className="feature-card p-6 h-full">
                  <h3 className="font-space text-lg font-semibold text-white mb-2">{term}</h3>
                  <p className="font-mono text-sm text-emerald-100/80 leading-relaxed">{meaning}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <motion.section aria-labelledby="faq-title" {...fadeUp} transition={{ duration: 0.4 }}>
          <div className="feature-card p-6">
            <h2 id="faq-title" className="font-space text-2xl font-semibold text-white mb-6">Good to know</h2>
            <dl className="grid gap-6 lg:grid-cols-2">
              {QUESTIONS.map(({ question, answer, link }) => (
                <div key={question}>
                  <dt className="font-space font-semibold text-white mb-1">{question}</dt>
                  <dd className="font-mono text-sm text-emerald-100/80 leading-relaxed">
                    {answer}
                    {link && (
                      <Link to={link.to} className="block mt-1 text-emerald-300 hover:text-emerald-200 underline">
                        {link.label}
                      </Link>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </motion.section>
      </div>
    </MotionConfig>
  );
};

export default HowItWorksPage;
