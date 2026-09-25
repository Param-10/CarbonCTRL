import { create } from 'zustand';
import { apiClient, type GoogleLinkOptions } from '../lib/api';
import { useCompanyStore } from './companyStore';
import { useCarbonStore } from './carbonStore';
import { useOffsetStore } from './offsetStore';

interface User {
  _id: string;
  id: string; // Keep for compatibility
  email: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  hasPassword?: boolean;
}

interface Session {
  access_token: string;
  user: User;
}

interface AuthResponse {
  user: Omit<User, 'id'>;
  token: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  // The stored session could not be checked (server unreachable), as opposed to being rejected
  sessionCheckFailed: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (credential: string, link?: GoogleLinkOptions) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearSession: () => void;
  initializeAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const toSessionState = (response: AuthResponse) => {
  const user = { ...response.user, id: response.user._id }; // Add id for compatibility
  return { user, session: { access_token: response.token, user } };
};

// Drop everything cached for the previous user so the next sign-in starts clean
const resetUserData = () => {
  useCompanyStore.getState().reset();
  useCarbonStore.getState().reset();
  useOffsetStore.getState().reset();
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  sessionCheckFailed: false,

  signIn: async (email, password) => {
    try {
      const response = await apiClient.signIn(email, password);
      resetUserData();
      set(toSessionState(response));
    } finally {
      set({ loading: false });
    }
  },

  signInWithGoogle: async (credential, link) => {
    try {
      const response = await apiClient.googleAuth(credential, link);
      resetUserData();
      set(toSessionState(response));
    } finally {
      set({ loading: false });
    }
  },

  signUp: async (name, email, password) => {
    try {
      const response = await apiClient.signUp(name, email, password);
      resetUserData();
      set(toSessionState(response));
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    await apiClient.signOut();
    get().clearSession();
  },

  // Clear the local session without calling the server (sign-out, expired or revoked token)
  clearSession: () => {
    apiClient.setToken(null);
    resetUserData();
    set({ user: null, session: null, loading: false, sessionCheckFailed: false });
  },

  initializeAuth: async () => {
    try {
      await get().refreshUser();
      set({ sessionCheckFailed: false });
    } catch (error) {
      // The token is kept (only a 401 clears it), so retrying can restore the session
      console.error('Could not check the stored session:', error);
      set({ sessionCheckFailed: true });
    } finally {
      set({ loading: false });
    }
  },

  // Re-read the current user from the server, e.g. after changing account settings
  refreshUser: async () => {
    const response = await apiClient.getSession();
    if (response.session) {
      const user = { ...response.session.user, id: response.session.user._id }; // Add id for compatibility
      set({ session: { ...response.session, user }, user });
    } else {
      set({ session: null, user: null });
    }
  },
}));

// A rejected session token anywhere in the app signs the user out locally
apiClient.setUnauthorizedHandler(() => {
  if (useAuthStore.getState().user) {
    useAuthStore.getState().clearSession();
  }
});

// Note: With JWT tokens, we don't need real-time auth state changes
// Auth state is managed through the store and API calls
