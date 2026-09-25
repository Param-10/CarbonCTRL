import { create } from 'zustand';
import { apiClient } from '../lib/api';

export interface CompanyProfile {
  _id?: string;
  name: string;
  industry: string;
  employees: string;
  location: string;
  phone: string;
  email: string;
  founded: string;
  description: string;
}

interface CompanyState {
  profile: CompanyProfile | null;
  // True once the profile has been fetched, even if the user has none yet
  loaded: boolean;
  loading: boolean;
  error: Error | null;
  fetchProfile: () => Promise<void>;
  updateProfile: (profile: CompanyProfile) => Promise<void>;
  reset: () => void;
}

const initialState = {
  profile: null,
  loaded: false,
  loading: false,
  error: null,
};

export const useCompanyStore = create<CompanyState>((set, get) => ({
  ...initialState,

  fetchProfile: async () => {
    const { loaded, loading, error } = get();
    // Skip if a fetch is in flight or already succeeded; after an error (e.g. a failed save), refetch
    if (loading || (loaded && !error)) return;

    set({ loading: true, error: null });

    try {
      const data = await apiClient.getCompanyProfile();
      set({ profile: data, loaded: true, loading: false, error: null });
    } catch (error) {
      // Leave loaded false so a retry fetches again
      console.error('Error fetching company profile:', error);
      const errorMessage = error instanceof Error ? error : new Error('Unknown error');
      set({ loading: false, error: errorMessage });
    }
  },

  updateProfile: async (profileData: CompanyProfile) => {
    set({ loading: true, error: null });

    try {
      const result = await apiClient.updateCompanyProfile(profileData);
      set({ profile: result, loaded: true, loading: false, error: null });
    } catch (error) {
      console.error('Error saving company profile:', error);
      const errorMessage = error instanceof Error ? error : new Error('Unknown error');
      set({ loading: false, error: errorMessage });
    }
  },

  // Clears the signed-in user's profile, e.g. on sign-out
  reset: () => set(initialState),
}));
