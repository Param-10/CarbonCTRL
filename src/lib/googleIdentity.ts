// Minimal typings for Google Identity Services (https://developers.google.com/identity/gsi/web)
interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleButtonOptions {
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  width?: number;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }) => void;
  renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleAccountsId;
      };
    };
  }
}

const GOOGLE_IDENTITY_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

let scriptPromise: Promise<void> | null = null;
let initializedClientId: string | null = null;
let credentialHandler: ((credential: string) => void) | null = null;

/**
 * Google warns if initialize() runs more than once per page, so initialize once and
 * route credentials to whichever handler the currently mounted page registered.
 */
export function initializeGoogleSignIn(clientId: string, onCredential: (credential: string) => void) {
  credentialHandler = onCredential;

  if (initializedClientId === clientId || !window.google) return;

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: ({ credential }) => credentialHandler?.(credential),
  });
  initializedClientId = clientId;
}

export function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GOOGLE_IDENTITY_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        // Allow a later attempt to retry instead of caching the failure
        scriptPromise = null;
        script.remove();
        reject(new Error('Failed to load Google sign-in'));
      };
      document.head.appendChild(script);
    });
  }

  return scriptPromise;
}
