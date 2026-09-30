import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Plus,
  X,
  AlertTriangle,
  PieChart,
  Leaf,
  ArrowRight,
  Pencil,
  Trash2,
  ListChecks,
  CalendarPlus
} from 'lucide-react';
import { useCarbonStore, EmissionsIntensity, CarbonActivity, ActivityInput } from '../store/carbonStore';
import { useCompanyStore } from '../store/companyStore';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../lib/api';
import { sectorLabel } from '../lib/sectorColors';
import { benchmarkDescription, gradedMeasure } from '../lib/gradeBasis';
import { useDialog } from '../hooks/useDialog';
import EmissionsTrendChart from '../components/EmissionsTrendChart';
import EmissionsBreakdownChart from '../components/EmissionsBreakdownChart';
import LogMonthModal, { EmissionCatalog } from '../components/LogMonthModal';
import TargetProgressCard from '../components/TargetProgressCard';
import { useActionStore } from '../store/actionStore';
import { formatMonth, previousMonth } from '../lib/usEstimates';

/** Today's date in the user's time zone, as YYYY-MM-DD. */
const localDateString = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

/** Emission factors are tiny in tonnes, so show the kg figure alongside. */
const formatFactor = (factor: number) => {
  const tonnes = `${Number(factor.toPrecision(3))} tCO₂e`;
  return factor < 0.1 ? `${tonnes} (${Number((factor * 1000).toPrecision(3))} kg CO₂e)` : tonnes;
};

const UNDO_WINDOW_MS = 8000;
const FACTORS_LOAD_ERROR = "Couldn't load activity types. Check your connection and try again.";
const ACTIVITY_PREVIEW_COUNT = 5;

/** "electricity-generation" -> "Electricity Generation" */
const humanize = (key: string) =>
  key.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

const activityKey = (activity: CarbonActivity) => activity.id ?? activity._id ?? '';

/** Newest first by activity date, then by when it was recorded. */
const newestFirst = (a: CarbonActivity, b: CarbonActivity) =>
  (b.activityDate ?? '').localeCompare(a.activityDate ?? '') ||
  (b.createdAt ?? '').localeCompare(a.createdAt ?? '');

/** "July 2026 to August 2026", or just "August 2026" for a single month */
const describePeriod = ({ start, end }: { start: string; end: string }) => {
  const [from, to] = [formatMonth(start.slice(0, 7)), formatMonth(end.slice(0, 7))];
  return from === to ? from : `${from} to ${to}`;
};

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);


const EmptyState = ({ onLogMonth, onAddActivity }: { onLogMonth: () => void; onAddActivity: () => void }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="text-center py-20"
  >
    <motion.div
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.5, type: 'spring' }}
      className="w-24 h-24 mx-auto mb-6 bg-emerald-500/20 rounded-full flex items-center justify-center"
    >
      <Leaf className="w-12 h-12 text-emerald-400" />
    </motion.div>
    <h2 className="font-space text-2xl font-bold text-white mb-4">
      Let's Calculate Your Carbon Impact
    </h2>
    <p className="font-mono text-emerald-100/70 max-w-md mx-auto mb-8">
      Start with last month: your electricity and gas bills, fuel, travel and trash. It takes a couple of minutes, and you can enter bill amounts if you don't have usage figures.
    </p>
    <div className="flex flex-wrap items-center justify-center gap-4">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onLogMonth}
        className="bg-emerald-700 text-white px-6 py-3 rounded-lg inline-flex items-center justify-center gap-3 group font-mono hover:bg-emerald-800 transition-colors"
      >
        <CalendarPlus className="w-5 h-5" />
        <span>Log Last Month</span>
      </motion.button>
      <button onClick={onAddActivity} className="font-mono text-sm text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-2">
        <Plus className="w-4 h-4" />
        Add a single activity
      </button>
    </div>
    <p className="font-mono text-sm text-emerald-100/70 mt-8">
      New to CarbonCTRL?{' '}
      <Link to="/how-it-works" className="text-emerald-300 underline hover:text-emerald-200">See how it works</Link>
    </p>
  </motion.div>
);

/** Explains what the grade is based on, so it isn't a bare letter. */
const GradeBasis = ({ intensity }: { intensity: EmissionsIntensity }) => (
  <div className="font-mono text-xs text-emerald-100/70 space-y-1 bg-gray-800/30 p-4 rounded-lg border border-emerald-500/10">
    <p>
      {gradedMeasure(intensity)}: <span className="text-white">{intensity.per_employee.toFixed(2)} tCO₂e</span> per employee per year,
      against {benchmarkDescription(intensity)}. The grade compares the two.
      {intensity.benchmark_is_default && ' Your industry has no specific benchmark, so a typical office is used.'}
    </p>
    {intensity.basis === 'building_energy' && intensity.total_per_employee > intensity.per_employee && (
      <p>Your whole footprint, including travel and other categories, is {intensity.total_per_employee.toFixed(2)} tCO₂e per employee per year.</p>
    )}
    <p>
      {intensity.months_covered
        ? `Annualized from ${intensity.months_covered} month${intensity.months_covered === 1 ? '' : 's'} of activity`
        : 'Activities have no dates, so totals are treated as a full year'}
      {`, for ${intensity.employees} employees`}
      {intensity.employees_estimated && ' (estimated from your employee range; add an exact headcount in Company Profile)'}.
    </p>
    {intensity.provisional && (
      <p className="text-amber-300/80">
        Provisional: record activities across at least 3 months for a reliable grade.
      </p>
    )}
    <p>
      <Link to="/methodology" className="text-emerald-300 underline hover:text-emerald-200">How this is calculated</Link>
    </p>
  </div>
);

interface ActivityLogProps {
  activities: CarbonActivity[];
  /** Readable name of an activity's type, e.g. "Natural gas" */
  itemLabel: (activity: CarbonActivity) => string;
  showAll: boolean;
  onToggleShowAll: () => void;
  onEdit: (activity: CarbonActivity) => void;
  onDelete: (activity: CarbonActivity) => void;
  onDeleteAll: () => void;
}

/** Recorded activities, newest first, with edit and delete per row. */
const ActivityLog = ({ activities, itemLabel, showAll, onToggleShowAll, onEdit, onDelete, onDeleteAll }: ActivityLogProps) => {
  const sorted = [...activities].sort(newestFirst);
  const visible = showAll ? sorted : sorted.slice(0, ACTIVITY_PREVIEW_COUNT);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="feature-card p-6"
    >
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-emerald-500/20 p-4 rounded-lg">
          <ListChecks className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h2 className="font-space text-xl font-semibold text-white">Activity Log</h2>
          <p className="font-mono text-sm text-emerald-100/70">
            {activities.length} recorded {activities.length === 1 ? 'activity' : 'activities'}, newest first
          </p>
        </div>
      </div>

      <ul className="space-y-3">
        {visible.map((activity) => (
          <li
            key={activityKey(activity)}
            className="flex items-center justify-between gap-4 p-4 bg-gray-800/50 rounded-lg border border-emerald-500/20"
          >
            <div className="min-w-0">
              <p className="font-mono text-white">
                {itemLabel(activity)} <span className="text-emerald-100/50">· {sectorLabel(activity.sector)}</span>
              </p>
              <p className="font-mono text-sm text-emerald-100/70">
                {activity.activityAmount} {activity.activityUnit}
                {activity.activityDate && <span className="text-emerald-100/50"> · {activity.activityDate}</span>}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => onEdit(activity)}
                aria-label={`Edit ${itemLabel(activity)} activity`}
                className="p-2 text-emerald-300/80 hover:text-emerald-200 transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(activity)}
                aria-label={`Delete ${itemLabel(activity)} activity`}
                className="p-2 text-red-400/80 hover:text-red-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-4 mt-6">
        {sorted.length > ACTIVITY_PREVIEW_COUNT ? (
          <button onClick={onToggleShowAll} className="font-mono text-sm text-emerald-300 hover:text-emerald-200">
            {showAll ? 'Show fewer' : `Show all ${sorted.length} activities`}
          </button>
        ) : <span />}
        <button
          onClick={onDeleteAll}
          className="inline-flex items-center gap-2 font-mono text-xs text-red-300/70 hover:text-red-300 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete all data
        </button>
      </div>
    </motion.div>
  );
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Id of the activity being edited; null when the modal adds a new one
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [recentlyDeleted, setRecentlyDeleted] = useState<CarbonActivity | null>(null);
  const [pageError, setPageError] = useState('');
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedSector, setSelectedSector] = useState('');
  const [selectedSubsector, setSelectedSubsector] = useState('');
  const [activityAmount, setActivityAmount] = useState('');
  const [activityDate, setActivityDate] = useState(localDateString);
  const [error, setError] = useState('');
  const [isIntroAnimation, setIsIntroAnimation] = useState(true);
  const [emissionFactorsData, setEmissionFactorsData] = useState<EmissionCatalog>({});
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>({});
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [factorsError, setFactorsError] = useState('');
  const [isLogMonthOpen, setIsLogMonthOpen] = useState(false);
  const [reminderDismissed, setReminderDismissed] = useState(false);
  const { progress, load: loadActionPlan } = useActionStore();
  const { profile } = useCompanyStore();
  const { user } = useAuthStore();

  const {
    activities,
    carbonScore,
    loading,
    initialized,
    addActivity,
    updateActivity,
    logMonth,
    removeActivity,
    deleteAllData,
    loadSavedData
  } = useCarbonStore();

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  // Target progress depends on the logged months, so reload it when they change
  useEffect(() => {
    loadActionPlan();
  }, [activities, loadActionPlan]);

  const lastMonth = previousMonth();
  const lastMonthMissing = activities.length > 0 && !activities.some((a) => a.activityDate?.startsWith(lastMonth));

  useEffect(() => {
    // Set intro animation to false after 500ms
    const timer = setTimeout(() => {
      setIsIntroAnimation(false);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  /** Loads the activity types; resolves to whether it succeeded. */
  const loadEmissionFactors = async () => {
    setLoadingFactors(true);
    setFactorsError('');
    try {
      const data = await apiClient.getEmissionFactors();
      setEmissionFactorsData(data.emission_factors);
      setCategoryLabels(data.categories ?? {});
      return true;
    } catch (err) {
      console.error('Error loading emission factors:', err);
      setFactorsError(FACTORS_LOAD_ERROR);
      return false;
    } finally {
      setLoadingFactors(false);
    }
  };

  // Load emission factors on component mount
  useEffect(() => {
    loadEmissionFactors();
  }, []);

  // Load saved data when component mounts
  useEffect(() => {
    if (user) {
      console.log('Loading saved carbon data for user:', user.id);
      loadSavedData(user.id).catch(err => {
        console.error('Error loading saved data:', err);
      });
    } else {
      console.warn('No user found, cannot load saved data');
    }
  }, [user, loadSavedData]);

  const getUnitDescription = (sector: string, subsector: string) =>
    emissionFactorsData[sector]?.[subsector]?.description ?? 'units';

  const itemLabel = (activity: CarbonActivity) =>
    emissionFactorsData[activity.sector]?.[activity.subsector]?.label ?? humanize(activity.subsector);

  // The form lists the activity types, so if they failed to load (e.g. a brief
  // outage), load them again first rather than leaving the button dead
  const openLogMonth = async () => {
    setPageError('');
    if (Object.keys(emissionFactorsData).length === 0 && !(await loadEmissionFactors())) {
      setPageError(FACTORS_LOAD_ERROR);
      return;
    }
    setIsLogMonthOpen(true);
  };

  const openAddModal = () => {
    setEditingId(null);
    setSelectedSector('');
    setSelectedSubsector('');
    setActivityAmount('');
    setActivityDate(localDateString());
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (activity: CarbonActivity) => {
    setEditingId(activityKey(activity));
    setSelectedSector(activity.sector);
    setSelectedSubsector(activity.subsector);
    setActivityAmount(String(activity.activityAmount));
    setActivityDate(activity.activityDate ?? localDateString());
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (!saving) setIsModalOpen(false);
  };
  const activityDialogRef = useRef<HTMLDivElement>(null);
  useDialog(activityDialogRef, isModalOpen, closeModal);
  const deleteAllDialogRef = useRef<HTMLDivElement>(null);
  useDialog(deleteAllDialogRef, confirmingDeleteAll, () => !deletingAll && setConfirmingDeleteAll(false));

  const handleSaveActivity = async () => {
    if (!user) {
      setError('You must be logged in to save activities');
      return;
    }

    const amount = Number(activityAmount);
    if (!selectedSector || !selectedSubsector || activityAmount.trim() === '' || !activityDate) {
      setError('Please fill in all fields');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Amount must be a number of zero or more');
      return;
    }
    if (activityDate > localDateString()) {
      setError('Activity date cannot be in the future');
      return;
    }

    const input: ActivityInput = {
      sector: selectedSector,
      subsector: selectedSubsector,
      activityAmount: amount,
      activityUnit: getUnitDescription(selectedSector, selectedSubsector),
      activityDate
    };

    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await updateActivity(editingId, input);
      } else {
        await addActivity(input);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving activity:', err);
      setError(errorMessage(err, 'Failed to save activity'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteActivity = async (activity: CarbonActivity) => {
    setPageError('');
    try {
      const removed = await removeActivity(activityKey(activity));
      if (undoTimer.current) clearTimeout(undoTimer.current);
      setRecentlyDeleted(removed);
      undoTimer.current = setTimeout(() => setRecentlyDeleted(null), UNDO_WINDOW_MS);
    } catch (err) {
      console.error('Error deleting activity:', err);
      setPageError(errorMessage(err, 'Failed to delete activity'));
    }
  };

  // Undo re-creates the activity with the same details (it gets a new id)
  const handleUndoDelete = async () => {
    if (!recentlyDeleted) return;
    const activity = recentlyDeleted;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setRecentlyDeleted(null);
    try {
      await addActivity({
        sector: activity.sector,
        subsector: activity.subsector,
        activityAmount: activity.activityAmount,
        activityUnit: activity.activityUnit,
        activityDate: activity.activityDate
      });
    } catch (err) {
      console.error('Error restoring activity:', err);
      setPageError(errorMessage(err, 'Could not restore the activity'));
    }
  };

  const handleDeleteAll = async () => {
    setDeletingAll(true);
    setPageError('');
    try {
      await deleteAllData();
      setConfirmingDeleteAll(false);
      setRecentlyDeleted(null);
    } catch (err) {
      console.error('Error deleting all carbon data:', err);
      setPageError(errorMessage(err, 'Failed to delete your carbon data'));
    } finally {
      setDeletingAll(false);
    }
  };

  const handleViewRecommendations = () => {
    navigate('/recommendations');
  };

  return (
    <div className="space-y-8">
      {loading && !initialized ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="font-mono text-emerald-100/70">Loading your carbon data...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center">
            <div>
              <h1 className="font-space text-3xl sm:text-4xl font-bold text-white mb-2">Carbon Intelligence</h1>
              <p className="font-mono text-emerald-100/80">
                Track and analyze {profile?.name ? profile.name + "'s" : "your organization's"} carbon footprint
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={openLogMonth}
              className="glass-button px-6 py-3 rounded-lg flex items-center justify-center gap-3 group bg-emerald-500/20 hover:bg-emerald-500/30 transition-all duration-300"
            >
              <CalendarPlus className="w-5 h-5 text-emerald-300 group-hover:text-emerald-200" />
              <span className="font-mono text-emerald-300 group-hover:text-emerald-200">Log a Month</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={openAddModal}
              className="glass-button px-6 py-3 rounded-lg flex items-center justify-center gap-3 group bg-emerald-500/20 hover:bg-emerald-500/30 transition-all duration-300"
            >
              <Plus className="w-5 h-5 text-emerald-300 group-hover:text-emerald-200" />
              <span className="font-mono text-emerald-300 group-hover:text-emerald-200">Add Activity</span>
            </motion.button>
            </div>
          </div>

          {lastMonthMissing && !reminderDismissed && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border border-blue-500/30 bg-blue-500/10">
              <span className="font-mono text-sm text-blue-100/90">
                {formatMonth(lastMonth)} isn't logged yet. Adding it keeps your score, trend and recommendations current.
              </span>
              <div className="flex items-center gap-3">
                <button onClick={openLogMonth} className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-mono text-sm">
                  Log {formatMonth(lastMonth).split(' ')[0]}
                </button>
                <button onClick={() => setReminderDismissed(true)} aria-label="Dismiss reminder" className="text-blue-100/60 hover:text-blue-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {activities.length === 0 ? (
            <EmptyState onLogMonth={openLogMonth} onAddActivity={openAddModal} />
          ) : (
            <>
              {carbonScore && (
                <AnimatePresence>
                  <motion.div
                    key="carbon-score"
                    initial={isIntroAnimation ? { opacity: 0, y: 20 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid gap-6 xl:grid-cols-2"
                  >
                    <div className="feature-card p-6">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="bg-emerald-500/20 p-4 rounded-lg">
                          <BarChart3 className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                          <h2 className="font-space text-xl font-semibold text-white">Carbon Score</h2>
                          <p className="font-mono text-sm text-emerald-100/70">Your organization's emissions summary</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                        <div className="bg-gray-800/50 p-4 rounded-lg border border-emerald-500/20">
                          <p className="font-mono text-sm text-emerald-100/70 mb-2">Total Emissions</p>
                          <div className="flex items-baseline flex-wrap">
                            <span className="font-space text-3xl font-bold text-white mr-2">
                              {carbonScore.total_emissions_tons_co2e.toFixed(1)}
                            </span>
                            <span className="font-mono text-emerald-400 text-sm">tCO₂e</span>
                          </div>
                        </div>

                        <div className="bg-gray-800/50 p-4 rounded-lg border border-emerald-500/20">
                          <p className="font-mono text-sm text-emerald-100/70 mb-2">Carbon Rating</p>
                          <div className="flex items-baseline">
                            <span className="font-space text-3xl font-bold text-white">
                              {carbonScore.carbon_rating}
                            </span>
                          </div>
                          {carbonScore.intensity?.provisional && (
                            <p className="font-mono text-xs text-amber-300/80 mt-1">Provisional</p>
                          )}
                        </div>

                        <div className="bg-gray-800/50 p-4 rounded-lg border border-emerald-500/20">
                          <p className="font-mono text-sm text-emerald-100/70 mb-2">Performance</p>
                          <div className="flex items-baseline">
                            <span className="font-space text-xl font-bold text-white">
                              {carbonScore.benchmark_comparison}
                            </span>
                          </div>
                        </div>
                      </div>

                      {carbonScore.intensity && (
                        <GradeBasis intensity={carbonScore.intensity} />
                      )}

                      <div className="flex justify-center mt-6">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleViewRecommendations}
                          className="glass-button px-6 py-3 rounded-lg inline-flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors font-mono w-full md:w-auto"
                        >
                          <span>View Recommendations</span>
                          <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                        </motion.button>
                      </div>
                    </div>

                    <div className="feature-card p-6 flex flex-col">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="bg-emerald-500/20 p-4 rounded-lg">
                          <PieChart className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                          <h2 className="font-space text-xl font-semibold text-white">Emissions by Category</h2>
                          <p className="font-mono text-sm text-emerald-100/70">
                            Where your footprint comes from
                            {carbonScore.period && ` · ${describePeriod(carbonScore.period)}`}
                          </p>
                        </div>
                      </div>

                      <EmissionsBreakdownChart
                        breakdown={carbonScore.emissions_breakdown}
                        total={carbonScore.total_emissions_tons_co2e}
                        onLogMonth={openLogMonth}
                      />
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}

              <TargetProgressCard progress={progress} />

              {carbonScore && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="feature-card p-6"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-emerald-500/20 p-4 rounded-lg">
                      <BarChart3 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="font-space text-xl font-semibold text-white">Emissions Over Time</h2>
                      <p className="font-mono text-sm text-emerald-100/70">Monthly emissions by category, based on activity dates</p>
                    </div>
                  </div>

                  <EmissionsTrendChart months={carbonScore.emissions_by_month ?? []} />
                </motion.div>
              )}

              <ActivityLog
                activities={activities}
                itemLabel={itemLabel}
                showAll={showAllActivities}
                onToggleShowAll={() => setShowAllActivities((value) => !value)}
                onEdit={openEditModal}
                onDelete={handleDeleteActivity}
                onDeleteAll={() => setConfirmingDeleteAll(true)}
              />
            </>
          )}
        </>
      )}

      {/* Add Activity Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
            onClick={closeModal}
          >
            <motion.div
              ref={activityDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="activity-dialog-title"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 id="activity-dialog-title" className="font-space text-xl font-semibold text-white">
                  {editingId ? 'Edit Carbon Activity' : 'Add Carbon Activity'}
                </h2>
                <button
                  onClick={closeModal}
                  aria-label="Close"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {factorsError && (
                <div role="alert" className="bg-red-900/20 text-red-400 p-3 rounded-lg mb-6 flex items-center justify-between gap-3">
                  <p className="font-mono text-sm">{factorsError}</p>
                  <button onClick={loadEmissionFactors} className="font-mono text-sm underline">Retry</button>
                </div>
              )}

              {error && (
                <div className="bg-red-900/20 text-red-400 p-3 rounded-lg mb-6 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <p className="font-mono text-sm">{error}</p>
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label htmlFor="activitySector" className="block font-mono text-sm text-emerald-100/70 mb-2">
                    Category
                  </label>
                  <select
                    id="activitySector"
                    data-autofocus
                    value={selectedSector}
                    onChange={(e) => {
                      setSelectedSector(e.target.value);
                      setSelectedSubsector('');
                    }}
                    className="w-full bg-gray-700/50 border border-emerald-500/30 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                  >
                    <option value="">-- Select category --</option>
                    {loadingFactors ? (
                      <option disabled>Loading categories...</option>
                    ) : (
                      Object.keys(emissionFactorsData).map((sector) => (
                        <option key={sector} value={sector}>
                          {categoryLabels[sector] ?? sectorLabel(sector)}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {selectedSector && (
                  <div>
                    <label htmlFor="activitySubsector" className="block font-mono text-sm text-emerald-100/70 mb-2">
                      Activity Type
                    </label>
                    <select
                      id="activitySubsector"
                      value={selectedSubsector}
                      onChange={(e) => setSelectedSubsector(e.target.value)}
                      className="w-full bg-gray-700/50 border border-emerald-500/30 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                    >
                      <option value="">-- Select activity type --</option>
                      {Object.entries(emissionFactorsData[selectedSector] ?? {}).map(([subsector, item]) => (
                        <option key={subsector} value={subsector}>
                          {item.label ?? humanize(subsector)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedSubsector && (
                  <div>
                    <label htmlFor="activityAmount" className="block font-mono text-sm text-emerald-100/70 mb-2">
                      Amount ({getUnitDescription(selectedSector, selectedSubsector)})
                    </label>
                    <input
                      id="activityAmount"
                      type="number"
                      value={activityAmount}
                      onChange={(e) => setActivityAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full bg-gray-700/50 border border-emerald-500/30 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                    />
                    {emissionFactorsData[selectedSector] && emissionFactorsData[selectedSector][selectedSubsector] && (
                      <p className="mt-2 text-xs text-emerald-300 font-mono">
                        ✓ Emission factor: {formatFactor(emissionFactorsData[selectedSector][selectedSubsector].factor)} per unit
                      </p>
                    )}
                  </div>
                )}

                {selectedSubsector && (
                  <div>
                    <label htmlFor="activityDate" className="block font-mono text-sm text-emerald-100/70 mb-2">
                      Date of activity
                    </label>
                    <input
                      id="activityDate"
                      type="date"
                      value={activityDate}
                      max={localDateString()}
                      onChange={(e) => setActivityDate(e.target.value)}
                      className="w-full bg-gray-700/50 border border-emerald-500/30 rounded-lg py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono [color-scheme:dark]"
                    />
                    <p className="mt-2 text-xs text-emerald-100/50 font-mono">
                      For a bill or meter reading, use the date at the end of the period it covers.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleSaveActivity}
                  disabled={saving}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-mono text-sm py-3 rounded-lg transition-colors mt-6 flex items-center justify-center gap-2"
                >
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Activity'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isLogMonthOpen && (
          <LogMonthModal
            catalog={emissionFactorsData}
            activities={activities}
            onSave={logMonth}
            onClose={() => setIsLogMonthOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Confirm before deleting everything */}
      <AnimatePresence>
        {confirmingDeleteAll && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
            onClick={() => !deletingAll && setConfirmingDeleteAll(false)}
          >
            <motion.div
              ref={deleteAllDialogRef}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-all-title"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-red-500/30"
            >
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-400" />
                <h2 id="delete-all-title" className="font-space text-xl font-semibold text-white">Delete all carbon data?</h2>
              </div>
              <p className="font-mono text-sm text-emerald-100/80 mb-6">
                This permanently deletes all {activities.length} {activities.length === 1 ? 'activity' : 'activities'},
                your score and your saved recommendations. Your company profile and account are kept. This can't be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmingDeleteAll(false)}
                  disabled={deletingAll}
                  className="px-4 py-2 font-mono text-sm text-emerald-100/80 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAll}
                  disabled={deletingAll}
                  className="px-4 py-2 rounded-lg font-mono text-sm bg-red-500/80 hover:bg-red-500 text-white disabled:opacity-60"
                >
                  {deletingAll ? 'Deleting...' : 'Delete everything'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Undo and error notices */}
      <div className="fixed bottom-6 right-6 z-40 space-y-3" aria-live="polite">
        {recentlyDeleted && (
          <div role="status" className="flex items-center gap-4 bg-gray-900 border border-emerald-500/30 rounded-lg px-4 py-3 shadow-lg">
            <span className="font-mono text-sm text-emerald-100/90">
              Deleted {itemLabel(recentlyDeleted)} ({recentlyDeleted.activityAmount})
            </span>
            <button onClick={handleUndoDelete} className="font-mono text-sm font-semibold text-emerald-300 hover:text-emerald-200">
              Undo
            </button>
          </div>
        )}
        {pageError && (
          <div role="alert" className="flex items-center gap-3 bg-gray-900 border border-red-500/40 rounded-lg px-4 py-3 shadow-lg">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="font-mono text-sm text-red-200">{pageError}</span>
            <button onClick={() => setPageError('')} aria-label="Dismiss" className="text-red-200/70 hover:text-red-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;