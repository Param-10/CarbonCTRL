import { create } from 'zustand';
import { apiClient } from '../lib/api';

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

// When 2FA is enabled, sign-in returns a short-lived token instead of a session
export interface LoginResult {
  twoFactorToken?: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<LoginResult>;
  signInWithGoogle: (credential: string) => Promise<LoginResult>;
  completeTwoFactor: (twoFactorToken: string, code: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
  initializeAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const toSessionState = (response: AuthResponse) => {
  const user = { ...response.user, id: response.user._id }; // Add id for compatibility
  return { user, session: { access_token: response.token, user } };
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,

  signIn: async (email, password) => {
    try {
      const response = await apiClient.signIn(email, password);
      if (response.twoFactorRequired) {
        return { twoFactorToken: response.twoFactorToken };
      }
      set(toSessionState(response));
      return {};
    } finally {
      set({ loading: false });
    }
  },

  signInWithGoogle: async (credential) => {
    try {
      const response = await apiClient.googleAuth(credential);
      if (response.twoFactorRequired) {
        return { twoFactorToken: response.twoFactorToken };
      }
      set(toSessionState(response));
      return {};
    } finally {
      set({ loading: false });
    }
  },

  completeTwoFactor: async (twoFactorToken, code) => {
    try {
      const response = await apiClient.completeTwoFactorLogin(twoFactorToken, code);
      set(toSessionState(response));
    } finally {
      set({ loading: false });
    }
  },

  signUp: async (email, password) => {
    try {
      const response = await apiClient.signUp(email, password);
      set(toSessionState(response));
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    try {
      await apiClient.signOut();
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
      await get().refreshUser();
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

// Note: With JWT tokens, we don't need real-time auth state changes
// Auth state is managed through the store and API calls
