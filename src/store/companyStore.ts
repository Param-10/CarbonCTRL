import { create } from 'zustand';
import { apiClient } from '../lib/api';
import { useAuthStore } from './authStore';

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
  updateProfile: (profile: CompanyProfile) => Promise<void>;
  reset: () => void;
}

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

    // Cached profile belongs to a different user (or there is none): clear it
    // so the UI never renders another account's data while we refetch.
    set({ loading: true, error: null, profile: null });
    
    try {
      // Get current user from auth store
      const user = useAuthStore.getState().user;
      
      if (!user) {
        console.error('Cannot fetch profile: No user logged in');
        set({ loading: false, loaded: true });
        return;
      }
      
      console.log('Fetching company profile for user:', user.id);
      
      try {
        const data = await apiClient.getCompanyProfile();
        
        if (!data) {
          console.log('No company profile found for user');
          // No profile found, but not an error
          set({ profile: null, profileUserId: null, loading: false, error: null, loaded: true });
          return;
        }
        
        console.log('Successfully loaded company profile:', data);
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
  },

  updateProfile: async (profileData: CompanyProfile) => {
    set({ loading: true, error: null });
    
    try {
      // Get current user from auth store
      const user = useAuthStore.getState().user;
      
      if (!user) {
        console.error('Cannot update profile: No user logged in');
        return;
      }
      
      console.log('Updating company profile for user:', user.id);
      
      const result = await apiClient.updateCompanyProfile(profileData);
      
      console.log('Successfully saved company profile:', result);
      set({
        profile: result,
        profileUserId: user.id ?? (user as { _id?: string | number })._id ?? null,
        loading: false,
        error: null,
        loaded: true
      });
    } catch (error) {
      console.error('Unexpected error in updateProfile:', error);
      const errorMessage = error instanceof Error ? error : new Error('Unknown error');
      set({ loading: false, error: errorMessage });
    }
  },

  reset: () => {
    set({ profile: null, profileUserId: null, loading: false, loaded: false, error: null });
  }
}));