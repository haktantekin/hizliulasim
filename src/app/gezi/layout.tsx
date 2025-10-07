import { Metadata } from 'next';

export const metadata: Metadata = {
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
