import type { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';

export const metadata: Metadata = {
  alternates: {
    canonical: `${SITE_URL}/kategoriler`,
  },
};
