import type { Metadata } from 'next';

const DEFAULT_SITE_URL = 'https://hizliulasim.com';

export function canonicalMetadata(
  pathname: string,
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL,
): Metadata {
  const origin = siteUrl.replace(/\/+$/, '');
  const path = (`/${pathname}`).replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';

  return {
    alternates: {
      canonical: path === '/' ? origin : `${origin}${path}`,
    },
  };
}

export const noIndexMetadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};
