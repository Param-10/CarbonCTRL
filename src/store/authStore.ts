import { create } from 'zustand';
import { apiClient } from '../lib/api';
import { useCompanyStore } from './companyStore';

interface User {
  _id: string;
  id: string; // Keep for compatibility
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  updatedAt: string;
  twoFactorEnabled?: boolean;
  googleId?: string;
}

interface Session {
  access_token: string;
  user: User;
}

/** Returned by signIn when the account requires a 2FA code to complete login. */
interface TwoFactorRequired {
  twoFactorToken: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<TwoFactorRequired | null>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWith2FA: (twoFactorToken: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  
  signIn: async (email, password) => {
    try {
      const response = await apiClient.signIn(email, password);

      // 2FA-protected account: the API only returns a short-lived challenge
      // token, no session. Bubble it up so the UI can ask for the code.
      if (response.requiresTwoFactor) {
        return { twoFactorToken: response.twoFactorToken };
      }

      const user = { ...response.user, id: response.user._id }; // Add id for compatibility
      const session = { access_token: response.token, user };
      set({ user, session });
      return null;
    } finally {
      set({ loading: false });
    }
  },
  
  signInWith2FA: async (twoFactorToken, code) => {
    try {
      const response = await apiClient.signInWith2FA(twoFactorToken, code);
      const user = { ...response.user, id: response.user._id }; // Add id for compatibility
      const session = { access_token: response.token, user };
      set({ user, session });
    } finally {
      set({ loading: false });
    }
  },
  
  signUp: async (email, password) => {
    try {
      const response = await apiClient.signUp(email, password);
      const user = { ...response.user, id: response.user._id }; // Add id for compatibility
      const session = { access_token: response.token, user };
      set({ user, session });
    } finally {
      set({ loading: false });
    }
  },
  
  signOut: async () => {
    try {
      await apiClient.signOut();
      // Tear down user-scoped caches so another account's data never renders
      // in this session (the company store caches the last fetched profile).
      useCompanyStore.getState().reset();
      set({ user: null, session: null });
    } finally {
      set({ loading: false });
    }
  },
  
  setSession: (session) => {
    if (session) {
      const user = { ...session.user, id: session.user._id }; // Add id for compatibility
      set({ session: { ...session, user }, user, loading: false });
    } else {
      set({ session: null, user: null, loading: false });
    }
  },
  
  initializeAuth: async () => {
    try {
      const response = await apiClient.getSession();
      if (response.session) {
        const user = { ...response.session.user, id: response.session.user._id }; // Add id for compatibility
        const session = { ...response.session, user };
        set({ session, user });
      } else {
        set({ session: null, user: null });
      }
    } finally {
      set({ loading: false });
    }
  },
}));

// Note: With JWT tokens, we don't need real-time auth state changes
// Auth state is managed through the store and API calls