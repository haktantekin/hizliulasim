import type { Metadata } from 'next';
import { canonicalMetadata } from '@/lib/seoMetadata';

export const metadata: Metadata = {
  ...canonicalMetadata('/engelsiz-erisim/engelsiz-otoparklar'),
  title: 'Engelsiz Otoparklar',
  description: 'Engelli araçlarına uygun otoparkları, konumlarını ve güncel doluluk bilgilerini görüntüleyin.',
};

export default function EngelsizOtoparklarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
