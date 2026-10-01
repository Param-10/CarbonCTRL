import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Building2, Check, Gauge, Leaf, Sparkles } from 'lucide-react';
import { useCompanyStore, CompanyProfile } from '../store/companyStore';
import { useCarbonStore, MonthEntry } from '../store/carbonStore';
import { apiClient } from '../lib/api';
import { EMPLOYEE_RANGE_OPTIONS, INDUSTRY_OPTIONS, STATE_OPTIONS } from '../lib/profileOptions';
import { sectorLabel } from '../lib/sectorColors';
import { gradedMeasure } from '../lib/gradeBasis';
import {
  LONG_ROUND_TRIP_MILES,
  SHORT_ROUND_TRIP_MILES,
  formatMonth,
  monthlyFlightMiles,
  monthlyTrashLbs,
  previousMonth,
  usageFromBill,
} from '../lib/usEstimates';

const INPUT_CLASS = 'w-full bg-gray-800/60 border border-emerald-500/30 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono';
const LABEL_CLASS = 'block font-mono text-sm text-emerald-100/80 mb-2';
const STEPS = [
  { title: 'Your company', icon: Building2 },
  { title: 'Quick footprint', icon: Gauge },
  { title: 'Your results', icon: Sparkles },
];

type UsageMode = 'usage' | 'bill';

interface FootprintAnswers {
  electricity: string;
  electricityMode: UsageMode;
  gas: string;
  gasMode: UsageMode;
  fuel: string;
  fuelMode: UsageMode;
  shortTrips: string;
  longTrips: string;
  trashCarts: string;
}

interface TopAction {
  title: string;
  impact: number;
  cost: string;
  sector?: string | null;
}

const emptyProfileDetails = {
  state: null,
  phone: '',
  email: '',
  founded: '',
  description: '',
  reductionBudget: null,
  reductionTargetPercent: null,
  reductionTargetYear: null,
  premisesOwnership: null,
  renewableElectricityShare: null,
  fleetSize: null,
  fleetType: null,
  workModel: null,
  siteCount: null,
  employeeCount: null,
  existingMeasures: null,
  reportingObligations: null,
};

const toNumber = (value: string) => (value.trim() === '' ? null : Number(value));
const isValidAmount = (value: number | null) => value === null || (Number.isFinite(value) && value >= 0);

/** Turn the plain-language answers into last month's activity totals. */
function footprintEntries(answers: FootprintAnswers): MonthEntry[] | string {
  const numbers = {
    electricity: toNumber(answers.electricity),
    gas: toNumber(answers.gas),
    fuel: toNumber(answers.fuel),
    shortTrips: toNumber(answers.shortTrips),
    longTrips: toNumber(answers.longTrips),
    trashCarts: toNumber(answers.trashCarts),
  };
  if (!Object.values(numbers).every(isValidAmount)) {
    return 'Answers must be numbers of zero or more';
  }

  const entries: MonthEntry[] = [];
  const add = (sector: string, subsector: string, amount: number | null) => {
    if (amount !== null && amount > 0) entries.push({ sector, subsector, activityAmount: amount });
  };
  const usage = (value: number | null, mode: UsageMode, sector: string, subsector: string) =>
    value === null || mode === 'usage' ? value : usageFromBill({ sector, subsector }, value);

  add('electricity', 'grid-electricity', usage(numbers.electricity, answers.electricityMode, 'electricity', 'grid-electricity'));
  add('heating_cooling', 'natural-gas', usage(numbers.gas, answers.gasMode, 'heating_cooling', 'natural-gas'));
  add('vehicles', 'gasoline', usage(numbers.fuel, answers.fuelMode, 'vehicles', 'gasoline'));
  if (numbers.shortTrips) add('business_travel', 'flight-short', monthlyFlightMiles(numbers.shortTrips, SHORT_ROUND_TRIP_MILES));
  if (numbers.longTrips) add('business_travel', 'flight-medium-long', monthlyFlightMiles(numbers.longTrips, LONG_ROUND_TRIP_MILES));
  if (numbers.trashCarts) add('waste', 'landfill', monthlyTrashLbs(numbers.trashCarts));
  return entries;
}

interface UsageQuestionProps {
  id: string;
  label: string;
  hint: string;
  unit: string;
  value: string;
  mode: UsageMode;
  onValue: (value: string) => void;
  onMode: (mode: UsageMode) => void;
}

/** A usage question that also accepts a dollar amount from the bill. */
const UsageQuestion = ({ id, label, hint, unit, value, mode, onValue, onMode }: UsageQuestionProps) => (
  <div>
    <label htmlFor={id} className={LABEL_CLASS}>{label}</label>
    <div className="flex gap-2">
      <input
        id={id}
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        value={value}
        placeholder={mode === 'bill' ? 'Bill amount in $' : unit}
        onChange={(e) => onValue(e.target.value)}
        className={INPUT_CLASS}
      />
      <div role="radiogroup" aria-label={`${label} units`} className="flex rounded-lg border border-emerald-500/30 overflow-hidden flex-shrink-0">
        {(['usage', 'bill'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={mode === option}
            onClick={() => onMode(option)}
            className={`px-3 font-mono text-xs ${mode === option ? 'bg-emerald-500/30 text-white' : 'text-emerald-100/60 hover:text-white'}`}
          >
            {option === 'usage' ? unit : '$'}
          </button>
        ))}
      </div>
    </div>
    <p className="font-mono text-xs text-emerald-100/50 mt-1">{hint}</p>
  </div>
);

/** Three-step first-run setup: company basics, a quick footprint, instant results. */
const OnboardingPage = () => {
  const navigate = useNavigate();
  const { profile, loaded, updateProfile } = useCompanyStore();
  const { carbonScore, logMonth } = useCarbonStore();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [company, setCompany] = useState({ name: '', industry: '', employees: '1-10', employeeCount: '', location: '', state: '' });
  const [answers, setAnswers] = useState<FootprintAnswers>({
    electricity: '', electricityMode: 'bill', gas: '', gasMode: 'bill', fuel: '', fuelMode: 'bill',
    shortTrips: '', longTrips: '', trashCarts: '',
  });
  const [topActions, setTopActions] = useState<TopAction[] | null>(null);
  const [actionsError, setActionsError] = useState('');
  // Set when AI recommendations weren't available and standard ones are shown
  const [actionsNotice, setActionsNotice] = useState('');
  const decided = useRef(false);
  const month = previousMonth();

  // Onboarding is for companies without a profile; everyone else goes on to the dashboard
  useEffect(() => {
    if (!loaded || decided.current) return;
    decided.current = true;
    if (profile?.name) navigate('/dashboard', { replace: true });
  }, [loaded, profile, navigate]);

  const saveCompany = async () => {
    const employeeCount = toNumber(company.employeeCount);
    if (!company.name.trim() || !company.industry || !company.location.trim() || !company.state) {
      setError('Company name, industry, city and state are required');
      return;
    }
    if (employeeCount !== null && (!Number.isInteger(employeeCount) || employeeCount < 1)) {
      setError('Exact headcount must be a whole number of at least 1');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const newProfile: CompanyProfile = {
        ...emptyProfileDetails,
        name: company.name.trim(),
        industry: company.industry,
        employees: company.employees,
        employeeCount,
        location: company.location.trim(),
        state: company.state,
      };
      await updateProfile(newProfile);
      setStep(1);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not save your company');
    } finally {
      setSaving(false);
    }
  };

  const saveFootprint = async () => {
    const entries = footprintEntries(answers);
    if (typeof entries === 'string') {
      setError(entries);
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (entries.length > 0) await logMonth(month, entries);
      setStep(2);
      if (entries.length > 0) loadTopActions();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not save your footprint');
    } finally {
      setSaving(false);
    }
  };

  // Top actions come from the same Gemini recommendations the Recommendations page shows
  const loadTopActions = async () => {
    const score = useCarbonStore.getState().carbonScore;
    if (!score) return;
    const focus = Object.entries(score.emissions_breakdown).sort(([, a], [, b]) => b - a).slice(0, 3).map(([s]) => s);
    try {
      const result = await apiClient.getRecommendations({
        industry: company.industry,
        selected_sectors: focus,
      });
      setTopActions((result.recommendations ?? []).slice(0, 3));
      setActionsNotice(typeof result.notice === 'string' ? result.notice : '');
    } catch (err) {
      setActionsError(err instanceof Error && err.message ? err.message : 'Could not load recommendations');
    }
  };

  const setAnswer = (field: keyof FootprintAnswers) => (value: string) =>
    setAnswers((current) => ({ ...current, [field]: value }));

  const breakdown = carbonScore
    ? Object.entries(carbonScore.emissions_breakdown).sort(([, a], [, b]) => b - a)
    : [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-800 via-emerald-900 to-gray-800 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Leaf className="w-7 h-7 text-emerald-400" />
          <span className="font-space text-xl font-bold text-white">CarbonCTRL</span>
        </div>

        <ol className="flex items-center gap-2 mb-8" aria-label="Setup progress">
          {STEPS.map(({ title, icon: Icon }, index) => (
            <li key={title} className="flex items-center gap-2 flex-1" aria-current={index === step ? 'step' : undefined}>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                index < step ? 'bg-emerald-700 text-white' : index === step ? 'bg-emerald-500/30 text-emerald-200 ring-2 ring-emerald-400' : 'bg-gray-700 text-gray-400'
              }`}>
                {index < step ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </span>
              <span className={`font-mono text-xs ${index === step ? 'text-white' : 'text-emerald-100/50'}`}>{title}</span>
            </li>
          ))}
        </ol>

        <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="feature-card p-8 space-y-6">
          {error && (
            <div role="alert" className="flex items-center gap-3 p-3 rounded-lg bg-red-900/20 text-red-300">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p className="font-mono text-sm">{error}</p>
            </div>
          )}

          {step === 0 && (
            <>
              <div>
                <h1 className="font-space text-2xl font-bold text-white mb-2">Tell us about your company</h1>
                <p className="font-mono text-sm text-emerald-100/70">Your industry and size let us grade your footprint fairly.</p>
                <Link to="/how-it-works" className="inline-block mt-2 font-mono text-sm text-emerald-300 underline hover:text-emerald-200">
                  New here? See how CarbonCTRL works
                </Link>
              </div>
              <div>
                <label htmlFor="ob-name" className={LABEL_CLASS}>Company name</label>
                <input id="ob-name" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} className={INPUT_CLASS} />
              </div>
              <div>
                <label htmlFor="ob-industry" className={LABEL_CLASS}>Industry</label>
                <select id="ob-industry" value={company.industry} onChange={(e) => setCompany({ ...company, industry: e.target.value })} className={INPUT_CLASS}>
                  <option value="" disabled>Select an industry</option>
                  {INDUSTRY_OPTIONS.map((industry) => <option key={industry} value={industry}>{industry}</option>)}
                </select>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ob-employees" className={LABEL_CLASS}>Employees</label>
                  <select id="ob-employees" value={company.employees} onChange={(e) => setCompany({ ...company, employees: e.target.value })} className={INPUT_CLASS}>
                    {EMPLOYEE_RANGE_OPTIONS.map((range) => <option key={range} value={range}>{range}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="ob-headcount" className={LABEL_CLASS}>Exact headcount (optional)</label>
                  <input id="ob-headcount" type="number" min={1} step={1} value={company.employeeCount} onChange={(e) => setCompany({ ...company, employeeCount: e.target.value })} className={INPUT_CLASS} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ob-location" className={LABEL_CLASS}>City</label>
                  <input id="ob-location" value={company.location} onChange={(e) => setCompany({ ...company, location: e.target.value })} className={INPUT_CLASS} />
                </div>
                <div>
                  <label htmlFor="ob-state" className={LABEL_CLASS}>State</label>
                  <select id="ob-state" aria-describedby="ob-state-hint" value={company.state} onChange={(e) => setCompany({ ...company, state: e.target.value })} className={INPUT_CLASS}>
                    <option value="" disabled>Select a state</option>
                    {STATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
              </div>
              <p id="ob-state-hint" className="font-mono text-xs text-emerald-100/60 -mt-2">Your state's power grid sets your electricity emissions.</p>
              <button onClick={saveCompany} disabled={saving} className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-mono py-3 rounded-lg inline-flex items-center justify-center gap-2">
                {saving ? 'Saving...' : 'Continue'} <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <h1 className="font-space text-2xl font-bold text-white mb-2">Your footprint for {formatMonth(month)}</h1>
                <p className="font-mono text-sm text-emerald-100/70">
                  Rough numbers are fine; skip anything that doesn't apply. Bill amounts are converted at US average prices, so they're estimates you can refine later.
                </p>
              </div>
              <UsageQuestion id="ob-electricity" label="Electricity" unit="kWh" hint="From your electric bill" value={answers.electricity} mode={answers.electricityMode} onValue={setAnswer('electricity')} onMode={(m) => setAnswers({ ...answers, electricityMode: m })} />
              <UsageQuestion id="ob-gas" label="Natural gas" unit="therms" hint="From your gas bill; leave blank if you don't use gas" value={answers.gas} mode={answers.gasMode} onValue={setAnswer('gas')} onMode={(m) => setAnswers({ ...answers, gasMode: m })} />
              <UsageQuestion id="ob-fuel" label="Fuel for company vehicles" unit="gallons" hint="Gasoline for the month; add diesel later on the dashboard" value={answers.fuel} mode={answers.fuelMode} onValue={setAnswer('fuel')} onMode={(m) => setAnswers({ ...answers, fuelMode: m })} />
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ob-short" className={LABEL_CLASS}>Short round-trip flights per year</label>
                  <input id="ob-short" type="number" min={0} value={answers.shortTrips} onChange={(e) => setAnswer('shortTrips')(e.target.value)} className={INPUT_CLASS} />
                  <p className="font-mono text-xs text-emerald-100/50 mt-1">Under 300 miles each way</p>
                </div>
                <div>
                  <label htmlFor="ob-long" className={LABEL_CLASS}>Longer round-trip flights per year</label>
                  <input id="ob-long" type="number" min={0} value={answers.longTrips} onChange={(e) => setAnswer('longTrips')(e.target.value)} className={INPUT_CLASS} />
                  <p className="font-mono text-xs text-emerald-100/50 mt-1">Counted as a monthly average</p>
                </div>
              </div>
              <div>
                <label htmlFor="ob-trash" className={LABEL_CLASS}>Trash carts filled per week</label>
                <input id="ob-trash" type="number" min={0} step="any" value={answers.trashCarts} onChange={(e) => setAnswer('trashCarts')(e.target.value)} className={INPUT_CLASS} />
                <p className="font-mono text-xs text-emerald-100/50 mt-1">96-gallon carts, about 70 lbs each</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={saveFootprint} disabled={saving} className="flex-1 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-mono py-3 rounded-lg inline-flex items-center justify-center gap-2">
                  {saving ? 'Saving...' : 'See my results'} <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={() => navigate('/dashboard')} disabled={saving} className="px-4 font-mono text-sm text-emerald-100/70 hover:text-white">
                  Skip for now
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {!carbonScore ? (
                <div>
                  <h1 className="font-space text-2xl font-bold text-white mb-2">You're all set</h1>
                  <p className="font-mono text-sm text-emerald-100/70">Log your first month on the dashboard to see your footprint and grade.</p>
                </div>
              ) : (
                <>
                  <div>
                    <h1 className="font-space text-2xl font-bold text-white mb-2">Your footprint for {formatMonth(month)}</h1>
                    <div className="flex flex-wrap items-baseline gap-6 mt-4">
                      <p className="font-mono text-emerald-100/70">
                        <span className="font-space text-4xl font-bold text-white">{carbonScore.total_emissions_tons_co2e.toFixed(1)}</span> tCO₂e
                      </p>
                      <p className="font-mono text-emerald-100/70">
                        Grade <span className="font-space text-4xl font-bold text-white">{carbonScore.carbon_rating}</span>
                      </p>
                    </div>
                    <p className="font-mono text-sm text-emerald-100/70 mt-2">
                      {carbonScore.benchmark_comparison}
                      {carbonScore.intensity && ` · ${gradedMeasure(carbonScore.intensity).toLowerCase()} of about ${carbonScore.intensity.per_employee.toFixed(1)} tCO₂e per employee per year`}
                      {carbonScore.intensity?.provisional && ' (provisional until you log 3 months)'}
                    </p>
                  </div>

                  <ul className="space-y-2">
                    {breakdown.map(([sector, tonnes]) => (
                      <li key={sector} className="flex justify-between font-mono text-sm">
                        <span className="text-emerald-100/80">{sectorLabel(sector)}</span>
                        <span className="text-white">{tonnes.toFixed(2)} t ({((tonnes / carbonScore.total_emissions_tons_co2e) * 100).toFixed(0)}%)</span>
                      </li>
                    ))}
                  </ul>

                  <div>
                    <h2 className="font-space text-lg font-semibold text-white mb-3">Your top actions</h2>
                    {topActions === null && !actionsError && (
                      <p className="font-mono text-sm text-emerald-100/60">Finding the actions that fit your company... this can take up to a minute.</p>
                    )}
                    {actionsError && (
                      <p className="font-mono text-sm text-amber-300">
                        {actionsError.replace(/\.?$/, '.')} You can generate them later on the Recommendations page.
                      </p>
                    )}
                    {actionsNotice && <p className="font-mono text-xs text-amber-300/90 mb-3">{actionsNotice}</p>}
                    {topActions && (
                      <ol className="space-y-3">
                        {topActions.map((action, index) => (
                          <li key={action.title} className="p-3 rounded-lg bg-gray-900/40 border border-emerald-500/10">
                            <p className="font-mono text-white">{index + 1}. {action.title}</p>
                            <p className="font-mono text-xs text-emerald-100/60 mt-1">
                              Saves about {action.impact.toFixed(2)} tCO₂e · {action.cost} cost{action.sector ? ` · ${sectorLabel(action.sector)}` : ''}
                            </p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </>
              )}
              <button onClick={() => navigate('/dashboard')} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-mono py-3 rounded-lg inline-flex items-center justify-center gap-2">
                Go to my dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
        </motion.div>
      </div>
    </main>
  );
};

export default OnboardingPage;
