import type { Metadata } from 'next';
import { canonicalMetadata } from '@/lib/seoMetadata';

export const metadata: Metadata = {
  ...canonicalMetadata('/engelsiz-erisim/engelsiz-mekanlar'),
  title: 'Engelsiz Mekanlar',
  description: 'Tekerlekli sandalye erişimine uygun mekanları ve erişilebilirlik bilgilerini keşfedin.',
};

export default function EngelsizMekanlarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
