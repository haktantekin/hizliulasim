/// <reference types="google.maps" />

interface GoogleMapsLibraries {
  maps: google.maps.MapsLibrary;
  marker: google.maps.MarkerLibrary;
}

declare global {
  interface Window {
    gm_authFailure?: () => void;
    hizliUlasimGoogleMapsReady?: () => void;
  }
}

const LOAD_TIMEOUT_MS = 20_000;
const AUTH_ERROR = 'Google Maps doğrulaması başarısız oldu.';
const authFailureListeners = new Set<() => void>();
let googleMapsPromise: Promise<GoogleMapsLibraries> | undefined;
let authHandlerInstalled = false;
let authFailed = false;

export function subscribeToGoogleMapsAuthFailure(listener: () => void) {
  authFailureListeners.add(listener);
  return () => {
    authFailureListeners.delete(listener);
  };
}

function installAuthHandler() {
  if (authHandlerInstalled) return;

  const previousAuthHandler = window.gm_authFailure;
  window.gm_authFailure = () => {
    authFailed = true;
    authFailureListeners.forEach((listener) => listener());
    previousAuthHandler?.();
  };
  authHandlerInstalled = true;
}

async function importMapLibraries(): Promise<GoogleMapsLibraries> {
  const [maps, marker] = await Promise.all([
    google.maps.importLibrary('maps') as Promise<google.maps.MapsLibrary>,
    google.maps.importLibrary('marker') as Promise<google.maps.MarkerLibrary>,
  ]);
  return { maps, marker };
}

function startGoogleMapsLoad(key: string) {
  return new Promise<GoogleMapsLibraries>((resolve, reject) => {
    const script = typeof globalThis.google?.maps?.importLibrary === 'function'
      ? null
      : document.createElement('script');
    let settled = false;

    const cleanUp = () => {
      settled = true;
      window.clearTimeout(timeout);
      unsubscribe();
      if (script) {
        script.onerror = null;
        delete window.hizliUlasimGoogleMapsReady;
      }
    };

    const fail = (message: string) => {
      if (settled) return;
      cleanUp();
      script?.remove();
      reject(new Error(message));
    };

    const timeout = window.setTimeout(() => {
      fail('Google Maps yüklemesi zaman aşımına uğradı.');
    }, LOAD_TIMEOUT_MS);
    const unsubscribe = subscribeToGoogleMapsAuthFailure(() => fail(AUTH_ERROR));

    const onReady = () => {
      void importMapLibraries().then((libraries) => {
        if (settled) return;
        cleanUp();
        resolve(libraries);
      }, () => fail('Google Maps harita bileşenleri yüklenemedi.'));
    };

    if (!script) {
      onReady();
      return;
    }

    const params = new URLSearchParams({
      key,
      v: 'weekly',
      language: 'tr',
      region: 'TR',
      loading: 'async',
      callback: 'hizliUlasimGoogleMapsReady',
    });
    window.hizliUlasimGoogleMapsReady = onReady;
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => fail('Google Maps yüklenemedi.');
    document.head.appendChild(script);
  });
}

export function loadGoogleMaps(key: string): Promise<GoogleMapsLibraries> {
  if (!key.trim()) return Promise.reject(new Error('Google Maps anahtarı yapılandırılmamış.'));
  if (authFailed) return Promise.reject(new Error(AUTH_ERROR));

  installAuthHandler();
  googleMapsPromise ??= startGoogleMapsLoad(key.trim()).catch((error: unknown) => {
    googleMapsPromise = undefined;
    throw error;
  });
  return googleMapsPromise;
}
