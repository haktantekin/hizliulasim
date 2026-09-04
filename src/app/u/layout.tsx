import { noIndexMetadata } from '@/lib/seoMetadata';

export const metadata = noIndexMetadata;

export default function UserProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
