import { Metadata } from 'next';
import { canonicalMetadata } from '@/lib/seoMetadata';

export const metadata: Metadata = {
  ...canonicalMetadata('/gezi'),
  title: 'Gezilecek Yerler',
  description: 'İstanbul&apos;da gezilecek turistik yerler ve ilgi çekici noktaları keşfedin. İlçenize göre filtrelenmiş öneriler.',
};

export default function GeziLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
