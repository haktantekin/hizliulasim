'use client';

import Script from 'next/script';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildGoogleButtonOptions,
  extractGoogleCredential,
  getGoogleClientId,
  type GoogleCredentialResponse,
} from './google-identity';

interface GoogleSignInButtonProps {
  disabled?: boolean;
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
}

export default function GoogleSignInButton({ disabled = false, onCredential, onError }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);

  const handleCredential = useCallback((response: GoogleCredentialResponse) => {
    try {
      onCredential(extractGoogleCredential(response));
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Google kimliği alınamadı.');
    }
  }, [onCredential, onError]);

  useEffect(() => {
    const container = containerRef.current;
    const identityApi = window.google?.accounts?.id;
    if (!scriptReady || !container || !identityApi) return;

    identityApi.initialize({
      client_id: getGoogleClientId(),
      callback: handleCredential,
      ux_mode: 'popup',
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    const render = () => {
      container.replaceChildren();
      identityApi.renderButton(container, buildGoogleButtonOptions(container.clientWidth));
    };
    render();
    const observer = new ResizeObserver(render);
    observer.observe(container);
    return () => observer.disconnect();
  }, [handleCredential, scriptReady]);

  return (
    <div className="relative min-h-11 w-full">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => onError('Google ile giriş şu anda kullanılamıyor.')}
      />
      <div ref={containerRef} className="flex min-h-11 w-full justify-center" aria-label="Google ile devam et" />
      {disabled && (
        <div className="absolute inset-0 flex items-center justify-center rounded-sm bg-white/75" aria-live="polite">
          <Loader2 size={20} className="animate-spin text-brand-orange" />
          <span className="sr-only">Google ile giriş yapılıyor</span>
        </div>
      )}
    </div>
  );
}
