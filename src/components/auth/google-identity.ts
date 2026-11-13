export const DEFAULT_GOOGLE_CLIENT_ID = '208603820160-hbs70saa6umg9gbut6gs3g596vs8fjhh.apps.googleusercontent.com';

export interface GoogleCredentialResponse {
  credential?: string;
}

export interface GoogleButtonOptions {
  type: 'standard';
  theme: 'outline';
  size: 'large';
  text: 'continue_with';
  shape: 'rectangular';
  logo_alignment: 'left';
  locale: 'tr';
  width: number;
}

export interface GoogleIdentityApi {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode: 'popup';
    auto_select: false;
    cancel_on_tap_outside: true;
  }): void;
  renderButton(parent: HTMLElement, options: GoogleButtonOptions): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdentityApi } };
  }
}

export function getGoogleClientId(value = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID): string {
  return value?.trim() || DEFAULT_GOOGLE_CLIENT_ID;
}

export function buildGoogleButtonOptions(containerWidth: number): GoogleButtonOptions {
  const width = Math.max(200, Math.min(400, Math.floor(containerWidth || 200)));
  return {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'left',
    locale: 'tr',
    width,
  };
}

export function extractGoogleCredential(response: GoogleCredentialResponse): string {
  const credential = typeof response.credential === 'string' ? response.credential.trim() : '';
  if (!credential || credential.length > 8192 || credential.split('.').length !== 3) {
    throw new Error('Google kimliği alınamadı.');
  }
  return credential;
}
