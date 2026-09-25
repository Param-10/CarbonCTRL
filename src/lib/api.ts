export class ApiError extends Error {
  status: number;
  // Machine-readable reason sent by the server for errors the client handles specially
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// Confirms linking Google to an existing email/password account: its password, or consent to remove it
export interface GoogleLinkOptions {
  password?: string;
  discardPassword?: boolean;
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;
  private unauthorizedHandler: (() => void) | null = null;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'https://carbonctrl.onrender.com/api';
    // Check for existing token in localStorage
    this.token = localStorage.getItem('carbonctrl_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('carbonctrl_token', token);
    } else {
      localStorage.removeItem('carbonctrl_token');
    }
  }

  getToken() {
    return this.token;
  }

  // Called when a request made with a session token is rejected (expired, revoked or deleted user)
  setUnauthorizedHandler(handler: (() => void) | null) {
    this.unauthorizedHandler = handler;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const sentToken = this.token;

    // Spread options first so the merged headers below are not overwritten by options.headers
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(sentToken && { Authorization: `Bearer ${sentToken}` }),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));

        // Only react if the rejected token is still the current one (not replaced meanwhile)
        if (response.status === 401 && sentToken && sentToken === this.token) {
          this.setToken(null);
          this.unauthorizedHandler?.();
        }

        throw new ApiError(errorData.error || `HTTP ${response.status}`, response.status, errorData.code);
      }

      return response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Auth methods
  async signUp(name: string, email: string, password: string) {
    const response = await this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    
    if (response.token) {
      this.setToken(response.token);
    }
    
    return response;
  }

  async signIn(email: string, password: string) {
    const response = await this.request('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.token) {
      this.setToken(response.token);
    }
    
    return response;
  }

  // Best effort: the session is cleared locally even if the server call fails (e.g. expired token)
  async signOut() {
    try {
      await this.request('/auth/signout', { method: 'POST' });
    } catch (error) {
      console.warn('Sign-out request failed; clearing the local session anyway:', error);
    } finally {
      this.setToken(null);
    }
  }

  async getSession() {
    if (!this.token) {
      return { session: null };
    }
    
    try {
      return await this.request('/auth/session');
    } catch (error) {
      // Only an auth failure means the token is bad; keep it through network errors
      if (error instanceof ApiError && error.status === 401) {
        this.setToken(null);
        return { session: null };
      }
      throw error;
    }
  }

  async updateUser(data: { name?: string; password?: string; currentPassword?: string }) {
    const response = await this.request('/auth/user', {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    // A password change signs out other sessions and returns a fresh token for this one
    if (response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  async deleteAccount(confirmation: { password?: string }) {
    const response = await this.request('/auth/user', {
      method: 'DELETE',
      body: JSON.stringify(confirmation),
    });
    this.setToken(null);
    return response;
  }

  async googleAuth(credential: string, link: GoogleLinkOptions = {}) {
    const response = await this.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential, ...link }),
    });

    if (response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  // Company Profile methods
  // Resolves to null when the user has not created a profile yet
  async getCompanyProfile() {
    return this.request('/company/profile');
  }

  async updateCompanyProfile(profileData: unknown) {
    return this.request('/company/profile', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
  }

  // Carbon data methods
  async getAssessment() {
    return this.request('/carbon/assessment');
  }

  async getActivities() {
    return this.request('/carbon/activities');
  }

  async addActivity(activity: Record<string, unknown>) {
    return this.request('/carbon/activity', {
      method: 'POST',
      body: JSON.stringify(activity),
    });
  }

  async deleteActivity(id: string) {
    return this.request(`/carbon/activity/${id}`, {
      method: 'DELETE',
    });
  }

  async getEmissions() {
    return this.request('/carbon/emissions');
  }

  async updateAssessment(id: string, data: Record<string, unknown>) {
    return this.request(`/carbon/assessment/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async resetCarbonData() {
    return this.request('/carbon/reset', {
      method: 'DELETE',
    });
  }

  async getSavedData() {
    return this.request('/carbon/saved-data');
  }

  // Gemini AI methods
  async calculateCarbonScore(data: Record<string, unknown>) {
    return this.request('/gemini/carbon-calculator', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getRecommendations(data: Record<string, unknown>) {
    return this.request('/gemini/carbon-recommendations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTaxBenefits(data: Record<string, unknown>) {
    return this.request('/gemini/tax-benefits', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const apiClient = new ApiClient(); 