import { create } from 'zustand';
import { apiClient } from '../lib/api';
import { useCompanyStore } from './companyStore';
import { useCarbonStore } from './carbonStore';
import { useOffsetStore } from './offsetStore';
import { useActionStore } from './actionStore';

interface User {
  _id: string;
  id: string; // Keep for compatibility
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  updatedAt: string;
  googleId?: string;
}

interface Session {
  access_token: string;
  user: User;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  // A saved session could not be checked (server unreachable), as opposed to rejected
  sessionCheckFailed: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
  initializeAuth: () => Promise<void>;
}

const resetUserData = () => {
  useCompanyStore.getState().reset();
  useCarbonStore.getState().reset();
  useOffsetStore.getState().reset();
  useActionStore.getState().reset();
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  sessionCheckFailed: false,
  
  signIn: async (email, password) => {
    try {
      const response = await apiClient.signIn(email, password);
      const user = { ...response.user, id: response.user._id }; // Add id for compatibility
      const session = { access_token: response.token, user };
      resetUserData();
      set({ user, session, sessionCheckFailed: false });
    } finally {
      set({ loading: false });
    }
  },
  
  signUp: async (name, email, password) => {
    try {
      const response = await apiClient.signUp(name, email, password);
      const user = { ...response.user, id: response.user._id }; // Add id for compatibility
      const session = { access_token: response.token, user };
      resetUserData();
      set({ user, session, sessionCheckFailed: false });
    } finally {
      set({ loading: false });
    }
  },
  
  signOut: async () => {
    try {
      await apiClient.signOut();
    } finally {
      // Tear down user-scoped caches so another account's data never renders
      // in this session (stores cache the last fetched profiles/scores).
      resetUserData();
      set({ user: null, session: null, sessionCheckFailed: false });
      set({ loading: false });
    }
  },
  
  setSession: (session) => {
    if (session) {
      const user = { ...session.user, id: session.user._id }; // Add id for compatibility
      if (get().user?._id !== user._id) resetUserData();
      set({ session: { ...session, user }, user, loading: false, sessionCheckFailed: false });
    } else {
      resetUserData();
      set({ session: null, user: null, loading: false, sessionCheckFailed: false });
    }
  },
  
  initializeAuth: async () => {
    const tokenAtStart = apiClient.getToken();
    try {
      const response = await apiClient.getSession();
      if (apiClient.getToken() !== tokenAtStart) return;
      if (response.session) {
        const user = { ...response.session.user, id: response.session.user._id }; // Add id for compatibility
        const session = { ...response.session, user };
        if (get().user?._id !== user._id) resetUserData();
        set({ session, user, sessionCheckFailed: false });
      } else {
        set({ session: null, user: null, sessionCheckFailed: false });
      }
    } catch (error) {
      // The token is kept (only a 401 clears it), so retrying can restore the session
      console.error('Could not check the stored session:', error);
      set({ sessionCheckFailed: true });
    } finally {
      set({ loading: false });
    }
  },
}));

// Note: With JWT tokens, we don't need real-time auth state changes
// Auth state is managed through the store and API calls
apiClient.setUnauthorizedHandler(() => {
  useAuthStore.getState().setSession(null);
});
