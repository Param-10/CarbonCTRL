export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

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

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new ApiError(errorData.error || `HTTP ${response.status}`, response.status);
      }

      return response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Auth methods
  async signUp(email: string, password: string, firstName?: string, lastName?: string) {
    const response = await this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, firstName, lastName }),
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

  async signOut() {
    try {
      await this.request('/auth/signout', { method: 'POST' });
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

  async updateUser(data: { firstName?: string; lastName?: string; password?: string; currentPassword?: string }) {
    return this.request('/auth/user', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAccount(confirmation: { password?: string; code?: string }) {
    const response = await this.request('/auth/user', {
      method: 'DELETE',
      body: JSON.stringify(confirmation),
    });
    this.setToken(null);
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

  async completeTwoFactorLogin(twoFactorToken: string, code: string) {
    const response = await this.request('/auth/2fa/login', {
      method: 'POST',
      body: JSON.stringify({ twoFactorToken, code }),
    });

    if (response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  async setup2FA() {
    return this.request('/auth/2fa/setup', {
      method: 'POST',
    });
  }

  async verify2FA(code: string) {
    return this.request('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async disable2FA(code: string) {
    return this.request('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
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