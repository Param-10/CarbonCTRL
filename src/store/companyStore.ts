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
  error: Error | null;
  fetchProfile: () => Promise<void>;
  updateProfile: (profile: CompanyProfile) => Promise<void>;
}

export const useCompanyStore = create<CompanyState>((set, get) => ({
  profile: null,
  loading: false,
  error: null,

  fetchProfile: async () => {
    const { profile } = get();
    // If profile already loaded, don't fetch again
    if (profile) return;
    
    set({ loading: true, error: null });
    
    try {
      // Get current user from auth store
      const user = useAuthStore.getState().user;
      
      if (!user) {
        console.error('Cannot fetch profile: No user logged in');
        return;
      }
      
      console.log('Fetching company profile for user:', user.id);
      
      try {
        const data = await apiClient.getCompanyProfile();
        
        if (!data) {
          console.log('No company profile found for user');
          // No profile found, but not an error
          set({ profile: null, loading: false, error: null });
          return;
        }
        
        console.log('Successfully loaded company profile:', data);
        set({ profile: data, loading: false, error: null });
      } catch (fetchError) {
        console.error('Network or API error in fetchProfile:', fetchError);
        set({ loading: false, error: null });
      }
    } catch (error) {
      console.error('Unexpected error in fetchProfile:', error);
      set({ loading: false });
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
      set({ profile: result, loading: false, error: null });
    } catch (error) {
      console.error('Unexpected error in updateProfile:', error);
      const errorMessage = error instanceof Error ? error : new Error('Unknown error');
      set({ loading: false, error: errorMessage });
    }
  }
}));