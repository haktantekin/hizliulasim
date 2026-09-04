import type { Metadata } from 'next';
import { canonicalMetadata } from '@/lib/seoMetadata';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';

export const metadata: Metadata = {
  ...canonicalMetadata('/engelsiz-erisim'),
  title: {
    default: 'Engelsiz Erişim - Erişilebilir Ulaşım Rehberi',
    template: '%s | Engelsiz Erişim | Hızlı Ulaşım',
  },
  description:
    'Engelli bireylere özel erişilebilir ulaşım bilgileri. Tekerlekli sandalye dostu duraklar, mekanlar, otoparklar ve rota planlama.',
  openGraph: {
    title: 'Engelsiz Erişim | Hızlı Ulaşım',
    description:
      'Engelli bireylere özel erişilebilir ulaşım bilgileri. Tekerlekli sandalye dostu duraklar, mekanlar, otoparklar ve rota planlama.',
    url: `${SITE_URL}/engelsiz-erisim`,
    type: 'website',
    siteName: 'Hızlı Ulaşım',
    locale: 'tr_TR',
  },
};

export default function EngelsizErisimLayout({ children }: { children: React.ReactNode }) {
  return children;
}
