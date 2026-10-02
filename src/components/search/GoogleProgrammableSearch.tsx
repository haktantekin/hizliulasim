import Script from 'next/script';

import { buildGoogleProgrammableSearchScriptUrl } from '@/lib/searchPage';

type GoogleProgrammableSearchProps = {
  engineId: string;
  fallbackHref: string;
};

export default function GoogleProgrammableSearch({
  engineId,
  fallbackHref,
}: GoogleProgrammableSearchProps) {
  if (!engineId) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="font-medium text-gray-700">Google arama sonuçları yüklenemedi.</p>
        <a
          href={fallbackHref}
          className="mt-3 inline-flex rounded-full bg-brand-soft-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Google&apos;da aramaya devam et
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-48 rounded-xl border border-gray-200 bg-white p-3 sm:p-5">
      <Script
        id="google-programmable-search"
        src={buildGoogleProgrammableSearchScriptUrl(engineId)}
        strategy="afterInteractive"
      />
      <div className="gcse-searchresults-only" />
      <noscript>
        <a href={fallbackHref} className="text-sm font-medium text-brand-soft-blue underline">
          Google&apos;da aramaya devam et
        </a>
      </noscript>
    </div>
  );
}
