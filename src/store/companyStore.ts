import { create } from 'zustand';
import { apiClient } from '../lib/api';
import { useAuthStore } from './authStore';

export interface CompanyProfile {
  _id?: string;
  name: string;
  industry: string;
  employees: string;
  location: string;
  /** US state code; sets the grid electricity factor and benchmark */
  state: string | null;
  phone: string;
  email: string;
  founded: string;
  description: string;
  // Sustainability context for recommendations. null means "not provided";
  // for the lists, an empty array means "none".
  reductionBudget: string | null;
  reductionTargetPercent: number | null;
  reductionTargetYear: number | null;
  premisesOwnership: string | null;
  renewableElectricityShare: string | null;
  fleetSize: number | null;
  fleetType: string | null;
  workModel: string | null;
  siteCount: number | null;
  /** Exact headcount; refines the per-employee grade over the range */
  employeeCount: number | null;
  existingMeasures: string[] | null;
  reportingObligations: string[] | null;
}

interface CompanyState {
  profile: CompanyProfile | null;
  loading: boolean;
  /** True once a profile lookup has completed (found, not-found, or failed).
   *  Lets ProtectedRoute avoid a premature redirect before the first fetch
   *  finishes. */
  loaded: boolean;
  error: Error | null;
  /** id of the user the cached profile belongs to. When the signed-in user
   *  changes (or signs out), the cache is invalidated and refetched so one
   *  account's data never bleeds into another's session. */
  profileUserId: string | number | null;
  fetchProfile: () => Promise<void>;
  /** Saves the profile. Rejects with the API error so the form can show it. */
  updateProfile: (profile: CompanyProfile) => Promise<void>;
  reset: () => void;
}

// Several components fetch the profile on mount; they share one request per user
let profileRequest: { uid: string | number | null; promise: Promise<void> } | null = null;

export const useCompanyStore = create<CompanyState>((set, get) => ({
  profile: null,
  loading: false,
  loaded: false,
  error: null,
  profileUserId: null,

  fetchProfile: async () => {
    const user = useAuthStore.getState().user;
    const uid = user ? (user.id ?? (user as { _id?: string | number })._id ?? null) : null;
    const { profile, profileUserId } = get();

    // Fast path: the cached profile already belongs to the current user.
    if (profile && profileUserId !== null && profileUserId === uid) {
      set({ loaded: true });
      return;
    }
    if (profileRequest && profileRequest.uid === uid) return profileRequest.promise;

    // Cached profile belongs to a different user (or there is none): clear it
    // so the UI never renders another account's data while we refetch.
    set({ loading: true, error: null, profile: null });

    const promise = (async () => {
      try {
        // Get current user from auth store
        const user = useAuthStore.getState().user;
      
        if (!user) {
          console.error('Cannot fetch profile: No user logged in');
          set({ loading: false, loaded: true });
          return;
        }

        try {
          const data = await apiClient.getCompanyProfile();
        
          if (!data) {
            // No profile found, but not an error
            set({ profile: null, profileUserId: null, loading: false, error: null, loaded: true });
            return;
          }
        
          set({ profile: data, profileUserId: uid, loading: false, error: null, loaded: true });
        } catch (fetchError) {
          console.error('Network or API error in fetchProfile:', fetchError);
          // Treat as "checked" so the UI doesn't spin forever; redirect logic
          // will still show the company profile page when nothing is found.
          set({ loading: false, error: null, loaded: true });
        }
      } catch (error) {
        console.error('Unexpected error in fetchProfile:', error);
        set({ loading: false, loaded: true });
      }
    })().finally(() => {
      if (profileRequest?.promise === promise) profileRequest = null;
    });
    profileRequest = { uid, promise };
    return promise;
  },

  updateProfile: async (profileData: CompanyProfile) => {
    set({ loading: true, error: null });
    
    try {
      // Get current user from auth store
      const user = useAuthStore.getState().user;
      
      if (!user) {
        console.error('Cannot update profile: No user logged in');
        set({ loading: false });
        return;
      }

      const result = await apiClient.updateCompanyProfile(profileData);
      
      set({
        profile: result,
        profileUserId: user.id ?? (user as { _id?: string | number })._id ?? null,
        loading: false,
        error: null,
        loaded: true
      });
    } catch (error) {
      console.error('Unexpected error in updateProfile:', error);
      // `error` is the load-failure state that replaces the whole page; a
      // rejected save should keep the form and its edits on screen instead.
      set({ loading: false });
      throw error instanceof Error ? error : new Error('Unknown error');
    }
  },

  reset: () => {
    set({ profile: null, profileUserId: null, loading: false, loaded: false, error: null });
  }
}));