/**
 * API error that carries the server's machine-readable `code` and full error
 * payload, so callers can branch on structured failures (e.g. the
 * LINK_PASSWORD_REQUIRED Google-account-linking challenge).
 */
export class ApiError extends Error {
  status: number;
  code?: string;
  payload: Record<string, unknown>;

  constructor(message: string, status: number, payload: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = typeof payload.code === 'string' ? payload.code : undefined;
    this.payload = payload;
  }
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

  setUnauthorizedHandler(handler: (() => void) | null) {
    this.unauthorizedHandler = handler;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const sentToken = this.token;
    
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
        if (response.status === 401 && sentToken && sentToken === this.token) {
          this.setToken(null);
          this.unauthorizedHandler?.();
        }
        throw new ApiError(
          typeof errorData.error === 'string' ? errorData.error : `HTTP ${response.status}`,
          response.status,
          errorData
        );
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

  async signInWith2FA(twoFactorToken: string, code: string) {
    const response = await this.request('/auth/signin/2fa', {
      method: 'POST',
      body: JSON.stringify({ twoFactorToken, code }),
    });
    
    if (response.token) {
      this.setToken(response.token);
    }
    
    return response;
  }

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

    // A password change bumps tokenVersion server-side and returns a fresh
    // token — adopt it so the current session survives.
    if (response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  async googleAuth(credential: string) {
    const response = await this.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
    
    if (response.token) {
      this.setToken(response.token);
    }
    
    return response;
  }

  /**
   * Complete a Google account link that requires proving (or discarding) the
   * existing account's password. Carries the reusable Google ID token returned
   * in the LINK_PASSWORD_REQUIRED error rather than a single-use auth code.
   */
  async googleLink(idToken: string, options: { password?: string; discardPassword?: boolean }) {
    const response = await this.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken, ...options }),
    });

    if (response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  async forgotPassword(email: string) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  async deleteAccount(password?: string) {
    return this.request('/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
  }

  async setup2FA() {
    return this.request('/auth/2fa/setup', {
      method: 'POST',
    });
  }

  async verify2FA(token: string, secret: string) {
    return this.request('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ token, secret }),
    });
  }

  async disable2FA(code?: string) {
    return this.request('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ token: code }),
    });
  }

  // Company Profile methods
  async getCompanyProfile() {
    try {
      return await this.request('/company/profile');
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
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
  async getEmissionFactors() {
    return this.request('/gemini/emission-factors');
  }

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
