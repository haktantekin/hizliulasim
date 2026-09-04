import { noIndexMetadata } from '@/lib/seoMetadata';

export const metadata = noIndexMetadata;

export default function FavorilerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
