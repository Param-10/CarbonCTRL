import { create } from 'zustand';
import { apiClient } from '../lib/api';

export interface CarbonActivity {
  id?: string;
  _id?: string;
  sector: string;
  subsector: string;
  activityAmount: number;
  activityUnit: string;
  /** YYYY-MM-DD; defaults to today on the server when omitted */
  activityDate?: string | null;
  createdAt?: string;
}

/** One activity type's total for a month */
export interface MonthEntry {
  sector: string;
  subsector: string;
  activityAmount: number;
}

/** The fields a user enters for an activity */
export type ActivityInput = Pick<CarbonActivity, 'sector' | 'subsector' | 'activityAmount' | 'activityUnit' | 'activityDate'>;

export interface MonthlyEmissions {
  month: string; // YYYY-MM
  total: number;
  breakdown: Record<string, number>;
}

/** Annualized emissions per employee compared with the industry's typical figure */
export interface EmissionsIntensity {
  annualized_emissions: number;
  months_covered: number | null;
  employees: number;
  employees_estimated: boolean;
  /** What is graded: building energy (building-based industries) or the whole footprint */
  basis: 'building_energy' | 'total_indicative';
  /** The graded emissions per employee per year */
  per_employee: number;
  /** All emissions per employee per year, whatever the basis */
  total_per_employee: number;
  industry: string | null;
  industry_benchmark: number;
  benchmark_label: string;
  benchmark_source: string;
  benchmark_is_default: boolean;
  state: string | null;
  ratio: number;
  provisional: boolean;
}

interface CarbonScore {
  total_emissions_tons_co2e: number;
  carbon_rating: string;
  emissions_breakdown: Record<string, number>;
  improvement_potential: number;
  benchmark_comparison: string;
  emissions_by_month?: MonthlyEmissions[];
  period?: { start: string; end: string } | null;
  intensity?: EmissionsIntensity | null;
}

interface CarbonState {
  activities: CarbonActivity[];
  carbonScore: CarbonScore | null;
  loading: boolean;
  initialized: boolean;
  /** Changes below throw on failure so the page can show the error. */
  addActivity: (activity: ActivityInput) => Promise<void>;
  updateActivity: (id: string, activity: ActivityInput) => Promise<void>;
  /** Set one month's total for each given activity type (see "Log a month"). */
  logMonth: (month: string, entries: MonthEntry[]) => Promise<void>;
  /** Deletes an activity and returns it, so the page can offer undo. */
  removeActivity: (id: string) => Promise<CarbonActivity | null>;
  deleteAllData: () => Promise<void>;
  loadSavedData: (userId: string) => Promise<void>;
  reset: () => void;
}

const initialState = {
  activities: [],
  carbonScore: null,
  loading: false,
  initialized: false,
};

const activityId = (activity: CarbonActivity) => activity.id ?? activity._id ?? '';

const toActivityInput = ({ sector, subsector, activityAmount, activityUnit, activityDate }: ActivityInput): ActivityInput => ({
  sector,
  subsector,
  activityAmount,
  activityUnit,
  activityDate,
});

export const useCarbonStore = create<CarbonState>((set, get) => {
  // Several components load on mount; they share one request instead of each sending their own
  let loadRequest: { userId: string; promise: Promise<void> } | null = null;

  /**
   * Reload activities and the score from the server. The server recalculates
   * the score from the stored activities on every request, so after any
   * change this is the single source of truth.
   */
  const refresh = async () => {
    const savedData = await apiClient.getSavedData();
    const activities: CarbonActivity[] = (savedData.activities ?? []).map((activity: CarbonActivity) => ({
      ...activity,
      id: activity._id,
    }));
    set({ activities, carbonScore: savedData.score ?? null, initialized: true });
  };

  return {
    ...initialState,

    // Clears the signed-in user's carbon data, e.g. on sign-out
    reset: () => set(initialState),

    addActivity: async (activity) => {
      await apiClient.addActivity(toActivityInput(activity));
      await refresh();
    },

    updateActivity: async (id, activity) => {
      await apiClient.updateActivity(id, toActivityInput(activity));
      await refresh();
    },

    logMonth: async (month, entries) => {
      await apiClient.logMonth(month, entries);
      await refresh();
    },

    removeActivity: async (id) => {
      const removed = get().activities.find((activity) => activityId(activity) === id) ?? null;
      await apiClient.deleteActivity(id);
      await refresh();
      return removed;
    },

    deleteAllData: async () => {
      await apiClient.resetCarbonData();
      set({ activities: [], carbonScore: null, initialized: true });
    },

    loadSavedData: async (userId: string) => {
      if (!userId) {
        console.error('Cannot load saved data: No user ID provided');
        return;
      }

      if (loadRequest?.userId === userId) return loadRequest.promise;

      set({ loading: true });
      const promise = refresh()
        .catch((error) => console.error('Error loading carbon data:', error))
        .finally(() => {
          set({ loading: false });
          if (loadRequest?.promise === promise) loadRequest = null;
        });
      loadRequest = { userId, promise };
      return promise;
    },
  };
});
