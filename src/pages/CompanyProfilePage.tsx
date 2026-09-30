import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, MapPin, Phone, Mail, Calendar, BarChart3, AlertTriangle, Save, Edit3, Leaf } from 'lucide-react';
import { useCarbonStore } from '../store/carbonStore';
import { useCompanyStore, CompanyProfile } from '../store/companyStore';
import { useAuthStore } from '../store/authStore';
import {
  EMPLOYEE_RANGE_OPTIONS,
  EXISTING_MEASURE_OPTIONS,
  INDUSTRY_OPTIONS,
  FLEET_TYPE_OPTIONS,
  labelFor,
  Option,
  PREMISES_OWNERSHIP_OPTIONS,
  REDUCTION_BUDGET_OPTIONS,
  RENEWABLE_SHARE_OPTIONS,
  REPORTING_OBLIGATION_OPTIONS,
  STATE_OPTIONS,
  WORK_MODEL_OPTIONS,
} from '../lib/profileOptions';

const INPUT_CLASS = 'w-full bg-gray-800/50 border-2 border-emerald-500/30 rounded-xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono shadow-inner';
const VIEW_CLASS = 'font-mono text-white bg-gray-800/30 p-4 px-6 rounded-xl border border-gray-700/30';
const NOT_SPECIFIED = 'Not specified';

type ListField = 'existingMeasures' | 'reportingObligations';

const emptyContext = {
  state: null,
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

const toNumberOrNull = (value: string) => (value.trim() === '' ? null : Number(value));

const isWholeNumberIn = (value: number | null, min: number, max: number) =>
  value === null || (Number.isInteger(value) && value >= min && value <= max);

/** Mirrors the server's checks so most mistakes are caught before saving. */
function validateProfile(data: CompanyProfile): string | null {
  if (!data.name.trim() || !data.industry || !data.location.trim()) {
    return 'Company name, industry and location are required.';
  }
  if (!isWholeNumberIn(data.reductionTargetPercent, 1, 100)) {
    return 'Reduction target must be a whole percentage between 1 and 100.';
  }
  if (!isWholeNumberIn(data.reductionTargetYear, 2020, 2100)) {
    return 'Target year must be a year between 2020 and 2100.';
  }
  if (data.reductionTargetYear !== null && data.reductionTargetPercent === null) {
    return 'Add a reduction percentage for your target year.';
  }
  if (!isWholeNumberIn(data.fleetSize, 0, 100000)) {
    return 'Number of company vehicles must be a whole number (0 if none).';
  }
  if (!isWholeNumberIn(data.siteCount, 1, 10000)) {
    return 'Number of sites must be a whole number of at least 1.';
  }
  if (!isWholeNumberIn(data.employeeCount, 1, 1000000)) {
    return 'Exact headcount must be a whole number of at least 1.';
  }
  return null;
}

function describeTarget(data: CompanyProfile) {
  if (data.reductionTargetPercent === null) return NOT_SPECIFIED;
  return data.reductionTargetYear
    ? `${data.reductionTargetPercent}% by ${data.reductionTargetYear}`
    : `${data.reductionTargetPercent}%`;
}

function describeFleet(data: CompanyProfile) {
  if (data.fleetSize === null) return NOT_SPECIFIED;
  if (data.fleetSize === 0) return 'None';
  const type = labelFor(FLEET_TYPE_OPTIONS, data.fleetType);
  return type ? `${data.fleetSize} (${type})` : String(data.fleetSize);
}

const CompanyProfilePage = () => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { carbonScore, loadSavedData } = useCarbonStore();
  const { user } = useAuthStore();
  const { profile, loading, loaded, error, fetchProfile, updateProfile } = useCompanyStore();
  const [companyData, setCompanyData] = useState<CompanyProfile | null>(null);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile) {
      // Profiles saved before the context fields existed come back without
      // them, and blank optional text fields come back as null
      setCompanyData({
        ...emptyContext,
        ...profile,
        phone: profile.phone ?? '',
        email: profile.email ?? '',
        founded: profile.founded ?? '',
        description: profile.description ?? ''
      });
    } else if (loaded) {
      // Empty company profile for new users - let them fill it out
      setCompanyData({
        name: "",
        employees: "1-10",
        location: "",
        phone: "",
        email: "",
        founded: "",
        industry: "",
        description: "",
        ...emptyContext
      });
      // Start in editing mode only once the lookup confirmed there is no
      // profile, not while it is still loading
      setIsEditing(true);
    }
  }, [profile, loaded]);

  const handleSave = async () => {
    if (!companyData) return;

    const validationError = validateProfile(companyData);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSaveError(null);
    const isFirstSetup = !profile;
    try {
      await updateProfile(companyData);
      setIsEditing(false);
      // State, industry and headcount change the grade, so reload the score
      if (user) loadSavedData(user.id);
      // New users go straight on to recording their first activity
      if (isFirstSetup) navigate('/dashboard');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save your profile. Please try again.');
    }
  };

  const toggleListValue = (field: ListField, value: string) => {
    if (!companyData) return;
    const current = companyData[field] ?? [];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    setCompanyData({ ...companyData, [field]: next });
  };

  const setFleetSize = (value: string) => {
    if (!companyData) return;
    const fleetSize = toNumberOrNull(value);
    setCompanyData({
      ...companyData,
      fleetSize,
      fleetType: fleetSize === 0 ? null : companyData.fleetType
    });
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-mono text-emerald-100/70">Loading profile data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center max-w-lg">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="font-space text-xl font-bold text-white mb-2">Error Loading Profile</h2>
          <p className="font-mono text-red-400 mb-6">{error.message || String(error)}</p>
          <button 
            onClick={() => fetchProfile()} 
            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-sm py-3 px-6 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!companyData) return null;

  return (
    <div className="fixed inset-0 md:left-64 overflow-y-auto bg-gradient-to-b from-gray-800 via-emerald-900 to-gray-800">
      <div className="px-4 pt-20 pb-8 sm:px-8 md:pt-8 space-y-10">
      {/* Welcome Message for New Users */}
      {!profile && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-emerald-500/20 to-blue-500/20 border border-emerald-500/30 rounded-xl p-6"
        >
          <div className="flex items-start gap-4">
            <div className="bg-emerald-500/20 p-3 rounded-lg flex-shrink-0">
              <Building2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-space text-xl font-semibold text-white mb-2">
                Welcome to CarbonCTRL
              </h2>
              <p className="font-mono text-emerald-100/90 leading-relaxed">
                Before we can help you track and reduce your carbon footprint, we need to know a bit about your organization. 
                Please fill out your company details below to get started on your sustainability journey!
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-mono text-emerald-300">
                <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                <span>This helps us provide personalized carbon insights for your industry and size</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div>
        <h1 className="font-space text-3xl sm:text-4xl font-bold text-white mb-3">Company Profile</h1>
        <p className="font-mono text-emerald-100/80">
          {!profile 
            ? "Set up your organization's details to begin tracking your carbon impact"
            : "Manage your organization's details and view performance metrics"
          }
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Company Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="feature-card lg:col-span-3 p-5 sm:p-8 border border-emerald-500/20 shadow-xl rounded-2xl bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-500/20 p-4 rounded-xl border border-emerald-500/30">
                <Building2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="font-space text-xl font-semibold text-white">Company Information</h2>
                <p className="font-mono text-sm text-emerald-100/60 mt-1">Fill out your organization details</p>
              </div>
            </div>
            <button
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              className={`glass-button px-6 py-3 rounded-xl font-mono text-sm flex items-center gap-2 transition-all ${
                isEditing 
                  ? 'bg-emerald-500/40 hover:bg-emerald-500/50 text-white' 
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300'
              }`}
            >
              {isEditing ? (
                <>
                  <Save className="w-4 h-4" />
                  {!profile ? 'Complete Setup & Continue' : 'Save Changes'}
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4" />
                  Edit Profile
                </>
              )}
            </button>
          </div>

          {saveError && (
            <div role="alert" className="mb-8 flex items-start gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="font-mono text-sm text-red-200">{saveError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-8">
              <div>
                <label htmlFor="companyName" className="block font-mono text-sm text-emerald-100/70 mb-3">Company Name</label>
                {isEditing ? (
                  <input
                    id="companyName"
                    type="text"
                    value={companyData.name}
                    onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                    placeholder="Enter your company name"
                    className="w-full bg-gray-800/40 border-2 border-emerald-500/20 rounded-xl py-3 px-5 text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 font-mono shadow-inner transition-all duration-200"
                  />
                ) : (
                  <div className="w-full bg-gray-800/20 border border-gray-700/30 rounded-xl py-3 px-5 text-white font-mono min-h-[48px] flex items-center">
                    {companyData.name || 'Not specified'}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="companyEmployees" className="block font-mono text-sm text-emerald-100/70 mb-3">
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" aria-hidden="true" />
                    Employees
                  </span>
                </label>
                {isEditing ? (
                  <select
                    id="companyEmployees"
                    value={companyData.employees}
                    onChange={(e) => setCompanyData({ ...companyData, employees: e.target.value })}
                    className="w-full bg-gray-800/50 border-2 border-emerald-500/30 rounded-xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono shadow-inner"
                  >
                    {EMPLOYEE_RANGE_OPTIONS.map((range) => (
                      <option key={range} value={range}>{range}</option>
                    ))}
                  </select>
                ) : (
                  <p className="font-mono text-white bg-gray-800/30 p-4 px-6 rounded-xl border border-gray-700/30">
                    {companyData.employees}
                    {companyData.employeeCount !== null && ` · exactly ${companyData.employeeCount}`}
                  </p>
                )}
                {isEditing && (
                  <input
                    type="number"
                    min={1}
                    step={1}
                    aria-label="Exact headcount (optional)"
                    placeholder="Exact headcount (optional, improves your grade)"
                    value={companyData.employeeCount ?? ''}
                    onChange={(e) => setCompanyData({ ...companyData, employeeCount: toNumberOrNull(e.target.value) })}
                    className={`${INPUT_CLASS} mt-3`}
                  />
                )}
              </div>

              <div>
                <label htmlFor="companyLocation" className="block font-mono text-sm text-emerald-100/70 mb-3">
                  <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" aria-hidden="true" />
                    Location
                  </span>
                </label>
                {isEditing ? (
                  <>
                    <input
                      id="companyLocation"
                      type="text"
                      placeholder="City"
                      value={companyData.location}
                      onChange={(e) => setCompanyData({ ...companyData, location: e.target.value })}
                      className="w-full bg-gray-800/50 border-2 border-emerald-500/30 rounded-xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono shadow-inner"
                    />
                    <select
                      aria-label="State"
                      value={companyData.state ?? ''}
                      onChange={(e) => setCompanyData({ ...companyData, state: e.target.value || null })}
                      className={`${INPUT_CLASS} mt-3`}
                    >
                      <option value="">State: not specified (uses the US average grid)</option>
                      {STATE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <p className="font-mono text-xs text-emerald-100/60 mt-2">Your state sets the electricity emission factor and the benchmark you are graded against.</p>
                  </>
                ) : (
                  <p className="font-mono text-white bg-gray-800/30 p-4 px-6 rounded-xl border border-gray-700/30">
                    {companyData.location}
                    {companyData.state && ` · ${labelFor(STATE_OPTIONS, companyData.state)}`}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <label htmlFor="companyPhone" className="block font-mono text-sm text-emerald-100/70 mb-3">
                  <span className="flex items-center gap-2">
                    <Phone className="w-4 h-4" aria-hidden="true" />
                    Phone
                  </span>
                </label>
                {isEditing ? (
                  <input
                    id="companyPhone"
                    type="tel"
                    value={companyData.phone}
                    onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
                    className="w-full bg-gray-800/50 border-2 border-emerald-500/30 rounded-xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono shadow-inner"
                  />
                ) : (
                  <p className="font-mono text-white bg-gray-800/30 p-4 px-6 rounded-xl border border-gray-700/30">{companyData.phone}</p>
                )}
              </div>

              <div>
                <label htmlFor="companyEmail" className="block font-mono text-sm text-emerald-100/70 mb-3">
                  <span className="flex items-center gap-2">
                    <Mail className="w-4 h-4" aria-hidden="true" />
                    Email
                  </span>
                </label>
                {isEditing ? (
                  <input
                    id="companyEmail"
                    type="email"
                    value={companyData.email}
                    onChange={(e) => setCompanyData({ ...companyData, email: e.target.value })}
                    className="w-full bg-gray-800/50 border-2 border-emerald-500/30 rounded-xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono shadow-inner"
                  />
                ) : (
                  <p className="font-mono text-white bg-gray-800/30 p-4 px-6 rounded-xl border border-gray-700/30">{companyData.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="companyFounded" className="block font-mono text-sm text-emerald-100/70 mb-3">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" aria-hidden="true" />
                    Founded
                  </span>
                </label>
                {isEditing ? (
                  <input
                    id="companyFounded"
                    type="text"
                    value={companyData.founded}
                    onChange={(e) => setCompanyData({ ...companyData, founded: e.target.value })}
                    className="w-full bg-gray-800/50 border-2 border-emerald-500/30 rounded-xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono shadow-inner"
                  />
                ) : (
                  <p className="font-mono text-white bg-gray-800/30 p-4 px-6 rounded-xl border border-gray-700/30">{companyData.founded}</p>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-3">
              <label htmlFor="companyDescription" className="block font-mono text-sm text-emerald-100/70 mb-3">Company Description</label>
              {isEditing ? (
                <textarea
                  id="companyDescription"
                  value={companyData.description}
                  onChange={(e) => setCompanyData({ ...companyData, description: e.target.value })}
                  className="w-full bg-gray-800/50 border-2 border-emerald-500/30 rounded-xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono shadow-inner h-40"
                />
              ) : (
                <p className="font-mono text-white bg-gray-800/30 p-4 px-6 rounded-xl border border-gray-700/30 min-h-[6rem] leading-relaxed">{companyData.description}</p>
              )}
            </div>

            <div className="lg:col-span-2 space-y-3 mb-4">
              <label htmlFor="companyIndustry" className="block font-mono text-sm text-emerald-100/70 mb-3">Industry</label>
              {isEditing ? (
                <select
                  id="companyIndustry"
                  value={companyData.industry}
                  onChange={(e) => setCompanyData({ ...companyData, industry: e.target.value })}
                  className="w-full bg-gray-800/50 border-2 border-emerald-500/30 rounded-xl py-4 px-6 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono shadow-inner"
                >
                  <option value="" disabled>Select an industry</option>
                  {INDUSTRY_OPTIONS.map((industry) => (
                    <option key={industry} value={industry}>{industry}</option>
                  ))}
                </select>
              ) : (
                <p className="font-mono text-white bg-gray-800/30 p-4 px-6 rounded-xl border border-gray-700/30">{companyData.industry}</p>
              )}
            </div>

            {/* Sustainability context used to tailor recommendations */}
            <div className="lg:col-span-2 pt-8 border-t border-emerald-500/20">
              <div className="flex items-center gap-3 mb-2">
                <Leaf className="w-5 h-5 text-emerald-400" />
                <h3 className="font-space text-lg font-semibold text-white">Sustainability Context</h3>
              </div>
              <p className="font-mono text-sm text-emerald-100/60 mb-8">
                Optional. The more you fill in, the better your AI recommendations fit what your company can actually do.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ContextSelect
                  label="Budget for reduction measures"
                  value={companyData.reductionBudget}
                  options={REDUCTION_BUDGET_OPTIONS}
                  isEditing={isEditing}
                  onChange={(value) => setCompanyData({ ...companyData, reductionBudget: value })}
                />

                <div>
                  <label className="block font-mono text-sm text-emerald-100/70 mb-3">Reduction target</label>
                  {isEditing ? (
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        step={1}
                        aria-label="Reduction target percentage"
                        placeholder="% e.g. 30"
                        value={companyData.reductionTargetPercent ?? ''}
                        onChange={(e) => setCompanyData({ ...companyData, reductionTargetPercent: toNumberOrNull(e.target.value) })}
                        className={INPUT_CLASS}
                      />
                      <input
                        type="number"
                        min={2020}
                        max={2100}
                        step={1}
                        aria-label="Reduction target year"
                        placeholder="Year e.g. 2030"
                        value={companyData.reductionTargetYear ?? ''}
                        onChange={(e) => setCompanyData({ ...companyData, reductionTargetYear: toNumberOrNull(e.target.value) })}
                        className={INPUT_CLASS}
                      />
                    </div>
                  ) : (
                    <p className={VIEW_CLASS}>{describeTarget(companyData)}</p>
                  )}
                </div>

                <ContextSelect
                  label="Premises"
                  value={companyData.premisesOwnership}
                  options={PREMISES_OWNERSHIP_OPTIONS}
                  isEditing={isEditing}
                  onChange={(value) => setCompanyData({ ...companyData, premisesOwnership: value })}
                />

                <div>
                  <label htmlFor="siteCount" className="block font-mono text-sm text-emerald-100/70 mb-3">Number of sites</label>
                  {isEditing ? (
                    <input
                      id="siteCount"
                      type="number"
                      min={1}
                      step={1}
                      value={companyData.siteCount ?? ''}
                      onChange={(e) => setCompanyData({ ...companyData, siteCount: toNumberOrNull(e.target.value) })}
                      className={INPUT_CLASS}
                    />
                  ) : (
                    <p className={VIEW_CLASS}>{companyData.siteCount ?? NOT_SPECIFIED}</p>
                  )}
                </div>

                <ContextSelect
                  label="Work model"
                  value={companyData.workModel}
                  options={WORK_MODEL_OPTIONS}
                  isEditing={isEditing}
                  onChange={(value) => setCompanyData({ ...companyData, workModel: value })}
                />

                <ContextSelect
                  label="Electricity from renewable sources"
                  value={companyData.renewableElectricityShare}
                  options={RENEWABLE_SHARE_OPTIONS}
                  isEditing={isEditing}
                  onChange={(value) => setCompanyData({ ...companyData, renewableElectricityShare: value })}
                />

                <div>
                  <label htmlFor="fleetSize" className="block font-mono text-sm text-emerald-100/70 mb-3">Company vehicles</label>
                  {isEditing ? (
                    <input
                      id="fleetSize"
                      type="number"
                      min={0}
                      step={1}
                      placeholder="0 if none"
                      value={companyData.fleetSize ?? ''}
                      onChange={(e) => setFleetSize(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  ) : (
                    <p className={VIEW_CLASS}>{describeFleet(companyData)}</p>
                  )}
                </div>

                {isEditing && companyData.fleetSize !== null && companyData.fleetSize > 0 && (
                  <ContextSelect
                    label="Vehicle type"
                    value={companyData.fleetType}
                    options={FLEET_TYPE_OPTIONS}
                    isEditing={isEditing}
                    onChange={(value) => setCompanyData({ ...companyData, fleetType: value })}
                  />
                )}

                <ContextChecklist
                  label="Measures already in place"
                  values={companyData.existingMeasures}
                  options={EXISTING_MEASURE_OPTIONS}
                  isEditing={isEditing}
                  onToggle={(value) => toggleListValue('existingMeasures', value)}
                />

                <ContextChecklist
                  label="Reporting obligations"
                  values={companyData.reportingObligations}
                  options={REPORTING_OBLIGATION_OPTIONS}
                  isEditing={isEditing}
                  onToggle={(value) => toggleListValue('reportingObligations', value)}
                />
              </div>
            </div>

            {/* Motivational message for new users */}
            {!profile && isEditing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-8 p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
              >
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="font-space text-lg font-semibold text-white">Almost there</h3>
                </div>
                <p className="font-mono text-sm text-emerald-300 leading-relaxed">
                  Complete your company setup to unlock carbon tracking, AI-powered insights, and personalized recommendations. 
                  <br />
                  <span className="text-emerald-400 font-semibold">Let's help you reduce your carbon footprint together.</span>
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Quick Stats Card */}
        {carbonScore && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="feature-card p-6 border border-emerald-500/20 shadow-xl rounded-2xl bg-gradient-to-br from-emerald-900/20 to-blue-900/20 backdrop-blur-sm"
          >
            <div className="flex items-center gap-5 mb-8">
              <div className="bg-emerald-500/20 p-5 rounded-xl">
                <BarChart3 className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="font-space text-2xl font-semibold text-white">Carbon Stats</h2>
            </div>

            <div className="space-y-8">
              <div>
                <p className="font-mono text-sm text-emerald-100/70 mb-3">Total Emissions</p>
                <div className="flex items-baseline gap-2 bg-gray-800/30 p-5 rounded-xl border border-gray-700/30">
                  <span className="font-space text-3xl font-bold text-white">
                    {carbonScore.total_emissions_tons_co2e.toFixed(1)}
                  </span>
                  <span className="font-mono text-emerald-400">tCO₂e</span>
                </div>
              </div>

              <div>
                <p className="font-mono text-sm text-emerald-100/70 mb-3">Carbon Rating</p>
                <div className="flex items-center justify-between gap-2 bg-gray-800/30 p-5 rounded-xl border border-gray-700/30">
                  <span className="font-space text-3xl font-bold text-white">
                    {carbonScore.carbon_rating}
                  </span>
                  <span className="font-mono text-emerald-400">Rating</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
      </div>
    </div>
  );
};

interface ContextSelectProps {
  label: string;
  value: string | null;
  options: Option[];
  isEditing: boolean;
  onChange: (value: string | null) => void;
}

const ContextSelect = ({ label, value, options, isEditing, onChange }: ContextSelectProps) => (
  <div>
    <label className="block font-mono text-sm text-emerald-100/70 mb-3">
      {label}
      {isEditing && (
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
          className={`${INPUT_CLASS} mt-3`}
        >
          <option value="">{NOT_SPECIFIED}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      )}
    </label>
    {!isEditing && <p className={VIEW_CLASS}>{labelFor(options, value) ?? NOT_SPECIFIED}</p>}
  </div>
);

interface ContextChecklistProps {
  label: string;
  values: string[] | null;
  options: Option[];
  isEditing: boolean;
  onToggle: (value: string) => void;
}

const ContextChecklist = ({ label, values, options, isEditing, onToggle }: ContextChecklistProps) => {
  const selected = values ?? [];

  if (!isEditing) {
    const text = values === null
      ? NOT_SPECIFIED
      : values.length === 0
        ? 'None'
        : values.map((value) => labelFor(options, value) ?? value).join(', ');
    return (
      <div className="lg:col-span-2">
        <p className="block font-mono text-sm text-emerald-100/70 mb-3">{label}</p>
        <p className={VIEW_CLASS}>{text}</p>
      </div>
    );
  }

  return (
    <fieldset className="lg:col-span-2">
      <legend className="block font-mono text-sm text-emerald-100/70 mb-3">{label}</legend>
      <div className="flex flex-wrap gap-3">
        {options.map((option) => {
          const isChecked = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className={`cursor-pointer select-none px-4 py-2 rounded-lg border font-mono text-sm transition-colors ${
                isChecked
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200'
                  : 'bg-gray-800/50 border-gray-600 text-gray-300 hover:border-emerald-500/50'
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={isChecked}
                onChange={() => onToggle(option.value)}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};

export default CompanyProfilePage;