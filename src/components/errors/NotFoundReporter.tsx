'use client';

import { useEffect, useRef } from 'react';

export default function NotFoundReporter() {
  const hasReported = useRef(false);

  useEffect(() => {
    if (hasReported.current) return;
    hasReported.current = true;

    void fetch('/api/404-urls', {
      method: 'POST',
      cache: 'no-store',
      keepalive: true,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: window.location.pathname,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
      }),
    }).catch((error) => {
      console.error('404 URL could not be reported:', error);
    });
  }, []);

  return null;
}
