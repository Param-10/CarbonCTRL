import { create } from 'zustand';
import { apiClient } from '../lib/api';

export type ActionStatus = 'planned' | 'in_progress' | 'done' | 'dismissed';

export interface ActionItem {
  id?: number;
  _id: string;
  title: string;
  description: string | null;
  sector: string | null;
  /** tCO2e per year */
  annualImpact: number;
  cost: string | null;
  timeline: string | null;
  priority: string | null;
  status: ActionStatus;
  createdAt: string;
  completedAt: string | null;
}

export interface TargetProgress {
  target: { percent: number; year: number | null } | null;
  baseline: { annual_emissions: number; months: number; from: string; to: string } | null;
  required_reduction: number | null;
  measured: { current_annual_emissions: number; reduction: number; percent: number } | null;
  estimated: { done_reduction: number; planned_reduction: number; coverage_percent: number | null };
  counts: Record<ActionStatus, number>;
}

/** What the API needs to add an action; `impact` is over the recorded period. */
export interface NewAction {
  title: string;
  description?: string;
  sector?: string | null;
  impact?: number;
  annualImpact?: number;
  cost?: string;
  timeline?: string;
  priority?: string;
}

interface ActionState {
  actions: ActionItem[];
  progress: TargetProgress | null;
  loaded: boolean;
  load: () => Promise<void>;
  /** Changes below throw on failure so the page can show the error. */
  add: (action: NewAction) => Promise<void>;
  setStatus: (id: string, status: ActionStatus) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reset: () => void;
}

const initialState = { actions: [], progress: null, loaded: false };

export const useActionStore = create<ActionState>((set) => {
  // Pages and cards load on mount; concurrent loads share one request
  let loadRequest: Promise<void> | null = null;

  // Actions and progress change together, so they are always reloaded together
  const refresh = async () => {
    const [actions, progress] = await Promise.all([apiClient.getActions(), apiClient.getActionProgress()]);
    set({ actions, progress, loaded: true });
  };

  return {
    ...initialState,
    reset: () => set(initialState),

    load: () => {
      loadRequest ??= refresh()
        .catch((error) => {
          console.error('Error loading the action plan:', error);
          set({ loaded: true });
        })
        .finally(() => {
          loadRequest = null;
        });
      return loadRequest;
    },

    add: async (action) => {
      await apiClient.addAction(action as unknown as Record<string, unknown>);
      await refresh();
    },

    setStatus: async (id, status) => {
      await apiClient.updateActionStatus(id, status);
      await refresh();
    },

    remove: async (id) => {
      await apiClient.deleteAction(id);
      await refresh();
    },
  };
});
