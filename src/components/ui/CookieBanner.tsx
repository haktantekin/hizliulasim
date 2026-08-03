'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const COOKIE_CONSENT_KEY = 'cookie_consent';

type ConsentValue = 'accepted' | 'rejected';

function updateGoogleConsent(consent: ConsentValue) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;

  const granted = consent === 'accepted' ? 'granted' : 'denied';
  window.gtag('consent', 'update', {
    ad_storage: granted,
    ad_user_data: granted,
    ad_personalization: granted,
    analytics_storage: granted,
    functionality_storage: granted,
    personalization_storage: granted,
  });
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!stored) {
      setVisible(true);
    }
  }, []);

  const handleConsent = (value: ConsentValue) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, value);
    updateGoogleConsent(value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-16 sm:bottom-0 left-0 right-0 z-[9999] p-3 sm:p-4">
      <div className="mx-auto max-w-4xl rounded-2xl bg-gray-900/95 backdrop-blur-sm p-4 sm:p-5 shadow-2xl border border-gray-700/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <p className="text-sm text-gray-200 flex-1">
            Deneyiminizi iyileştirmek için çerezler kullanıyoruz.{' '}
            <Link
              href="/cerez-politikasi"
              className="underline text-blue-400 hover:text-blue-300"
            >
              Çerez Politikası
            </Link>
          </p>
          <div className="flex gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={() => handleConsent('rejected')}
              className="flex-1 sm:flex-none px-4 py-2 text-sm rounded-lg border border-gray-500 text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Reddet
            </button>
            <button
              onClick={() => handleConsent('accepted')}
              className="flex-1 sm:flex-none px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors font-medium"
            >
              Kabul Et
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
