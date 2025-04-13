import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { PostgrestError } from '@supabase/supabase-js';

export interface CompanyProfile {
  id?: string;
  user_id?: string;
  name: string;
  employees: string;
  location: string;
  phone: string;
  email: string;
  founded: string;
  industry: string;
  description: string;
  created_at?: string;
  updated_at?: string;
}

interface CompanyState {
  profile: CompanyProfile | null;
  loading: boolean;
  error: string | null;
  profileComplete: boolean;
  fetchProfile: () => Promise<void>;
  updateProfile: (profile: CompanyProfile) => Promise<void>;
  setProfile: (profile: CompanyProfile) => void;
  resetProfile: () => void;
  checkProfileComplete: () => boolean;
}

// Removed defaultProfile object

export const useCompanyStore = create<CompanyState>((set, get) => ({
  profile: null,
  loading: false,
  error: null,
  profileComplete: false,

  fetchProfile: async () => {
    const { profile } = get();
    // If profile already loaded, don't fetch again
    if (profile) return;
    
    set({ loading: true, error: null });
    
    try {
      // Get current user from auth store
      const user = useAuthStore.getState().user;
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      console.log('Fetching company profile for user:', user.id);
      
      const { data, error } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        if ((error as PostgrestError).code === 'PGRST116') {
          // No profile exists yet - don't set a default profile
          set({ profile: null, loading: false, profileComplete: false });
          return;
        }
        throw error;
      }
      
      console.log('Company profile loaded:', data);
      set({ 
        profile: data, 
        loading: false,
        profileComplete: get().checkProfileComplete()
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch company profile';
      console.error('Error fetching company profile:', err);
      set({ 
        profile: null, 
        loading: false, 
        error: errorMessage,
        profileComplete: false
      });
    }
  },

  updateProfile: async (profile) => {
    set({ loading: true, error: null });
    
    try {
      const user = useAuthStore.getState().user;
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Ensure user_id is set
      profile.user_id = user.id;
      profile.updated_at = new Date().toISOString();
      
      console.log('Updating company profile:', profile);
      
      // Check if profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('company_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      
      let result;
      
      if (existingProfile) {
        // Update existing profile
        result = await supabase
          .from('company_profiles')
          .update({
            ...profile,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingProfile.id)
          .select()
          .single();
      } else {
        // Insert new profile
        result = await supabase
          .from('company_profiles')
          .insert({
            ...profile,
            user_id: user.id,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();
      }
      
      if (result.error) throw result.error;
      
      console.log('Company profile updated:', result.data);
      set({ 
        profile: result.data, 
        loading: false,
        profileComplete: get().checkProfileComplete()
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update company profile';
      console.error('Error updating company profile:', err);
      set({ 
        loading: false, 
        error: errorMessage
      });
    }
  },

  setProfile: (profile) => {
    set({ 
      profile,
      profileComplete: !!profile && get().checkProfileComplete()
    });
  },
  
  resetProfile: () => {
    set({ profile: null, error: null, profileComplete: false });
  },

  checkProfileComplete: () => {
    const { profile } = get();
    if (!profile) return false;
    
    // Check if all required fields are filled
    const requiredFields: (keyof CompanyProfile)[] = [
      'name', 'employees', 'location', 'industry', 'description'
    ];
    
    return requiredFields.every(field => 
      !!profile[field] && profile[field].trim() !== ''
    );
  }
}));

// Listen for auth changes to reset profile when user logs out
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    useCompanyStore.getState().resetProfile();
  }
});