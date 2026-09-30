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

/** A readable message for a failed response that didn't include one. */
function messageForStatus(status: number) {
  if (status === 429) return 'Too many requests right now. Please wait a minute and try again.';
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 404) return 'That was not found on the server.';
  if (status >= 500) return 'The server ran into a problem. Please try again in a moment.';
  return `Request failed (HTTP ${status})`;
}

const SERVER_UNREACHABLE = "Can't reach the CarbonCTRL server. Check your internet connection, or that the server is running.";

/** Turn a failed response into an ApiError with the server's message, or a clear default. */
async function errorFromResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  const message = typeof payload.error === 'string' ? payload.error : messageForStatus(response.status);
  return new ApiError(message, response.status, payload);
}

/** fetch that reports an unreachable server as a readable ApiError (status 0). */
async function fetchOrExplain(url: string, init?: RequestInit) {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(SERVER_UNREACHABLE, 0);
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
      const response = await fetchOrExplain(url, config);

      if (!response.ok) {
        if (response.status === 401 && sentToken && sentToken === this.token) {
          this.setToken(null);
          this.unauthorizedHandler?.();
        }
        throw await errorFromResponse(response);
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
  async getActivities() {
    return this.request('/carbon/activities');
  }

  async addActivity(activity: Record<string, unknown>) {
    return this.request('/carbon/activity', {
      method: 'POST',
      body: JSON.stringify(activity),
    });
  }

  /** Set one month's totals for several activity types (YYYY-MM month) */
  async logMonth(month: string, entries: { sector: string; subsector: string; activityAmount: number }[]) {
    return this.request('/carbon/activities/month', {
      method: 'POST',
      body: JSON.stringify({ month, entries }),
    });
  }

  async updateActivity(id: string, activity: Record<string, unknown>) {
    return this.request(`/carbon/activity/${id}`, {
      method: 'PUT',
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

  // Action plan
  async getActions() {
    return this.request('/actions');
  }

  async getActionProgress() {
    return this.request('/actions/progress');
  }

  async addAction(action: Record<string, unknown>) {
    return this.request('/actions', { method: 'POST', body: JSON.stringify(action) });
  }

  async updateActionStatus(id: string, status: string) {
    return this.request(`/actions/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  }

  async deleteAction(id: string) {
    return this.request(`/actions/${id}`, { method: 'DELETE' });
  }

  // Reminders
  async getReminderSettings() {
    return this.request('/reminders/settings');
  }

  async updateReminderSettings(monthlyReminders: boolean) {
    return this.request('/reminders/settings', { method: 'PUT', body: JSON.stringify({ monthlyReminders }) });
  }

  // Methodology (public reference data; state tailors grid factors and benchmarks)
  async getMethodology(state?: string | null) {
    return this.request(`/methodology${state ? `?state=${encodeURIComponent(state)}` : ''}`);
  }

  // Report
  async getReport(from: string, to: string) {
    return this.request(`/carbon/report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  }

  /** The report as a CSV file (not JSON, so fetched directly). */
  async downloadReportCsv(from: string, to: string): Promise<Blob> {
    const response = await fetchOrExplain(
      `${this.baseURL}/carbon/report.csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { headers: this.token ? { Authorization: `Bearer ${this.token}` } : {} }
    );
    if (!response.ok) throw await errorFromResponse(response);
    return response.blob();
  }

  /** Last saved recommendations ({ saved: null } when none have been generated) */
  async getLatestRecommendations() {
    return this.request('/gemini/carbon-recommendations/latest');
  }

  async getRecommendations(data: Record<string, unknown>) {
    return this.request('/gemini/carbon-recommendations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const apiClient = new ApiClient();
