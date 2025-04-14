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
  error: PostgrestError | null;
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
        const { data, error } = await supabase
          .from('company_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (error) {
          if (error.code === 'PGRST116') {
            console.log('No company profile found for user');
            // No profile found, but not an error
            set({ profile: null, loading: false, error: null });
            return;
          }
          
          console.error('Error fetching company profile:', error);
          set({ error, loading: false });
          return;
        }
        
        console.log('Successfully loaded company profile:', data);
        set({ profile: data, loading: false, error: null });
      } catch (fetchError) {
        console.error('Network or API error in fetchProfile:', fetchError);
        set({ loading: false, error: null });
      }
      
      console.log('Successfully loaded company profile:', data);
      set({ profile: data, loading: false, error: null });
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
      
      // Check if profile exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('company_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking for existing profile:', fetchError);
        set({ error: fetchError, loading: false });
        return;
      }
      
      let result;
      
      if (existingProfile) {
        // Update existing profile
        console.log('Updating existing profile with ID:', existingProfile.id);
        result = await supabase
          .from('company_profiles')
          .update({
            ...profileData,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProfile.id)
          .select()
          .single();
      } else {
        // Create new profile
        console.log('Creating new company profile');
        result = await supabase
          .from('company_profiles')
          .insert({
            ...profileData,
            user_id: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
      }
      
      if (result.error) {
        console.error('Error saving company profile:', result.error);
        set({ error: result.error, loading: false });
        return;
      }
      
      console.log('Successfully saved company profile:', result.data);
      set({ profile: result.data, loading: false, error: null });
    } catch (error) {
      console.error('Unexpected error in updateProfile:', error);
      set({ loading: false });
    }
  }
}));