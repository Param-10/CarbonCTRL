import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: any | null;
  session: any | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setSession: (session: any) => void;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      set({ user: data.user, session: data.session });
    } finally {
      set({ loading: false });
    }
  },
  signUp: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      set({ user: data.user, session: data.session });
    } finally {
      set({ loading: false });
    }
  },
  signOut: async () => {
    try {
      await supabase.auth.signOut();
      set({ user: null, session: null });
    } finally {
      set({ loading: false });
    }
  },
  setSession: (session) => {
    set({ session, user: session?.user ?? null, loading: false });
  },
  initializeAuth: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({ session, user: session?.user ?? null });
    } finally {
      set({ loading: false });
    }
  },
}));

// Set up auth state listener
supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.getState().setSession(session);
});