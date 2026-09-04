import type { Metadata } from 'next';
import { canonicalMetadata } from '@/lib/seoMetadata';

export const metadata: Metadata = {
  ...canonicalMetadata('/engelsiz-erisim/engelsiz-rota'),
  title: 'Engelsiz Rota',
  description: 'Tekerlekli sandalye kullanımına uygun ulaşım seçenekleriyle erişilebilir rota oluşturun.',
};

export default function EngelsizRotaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
