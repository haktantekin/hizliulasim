import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hesap ve Verilerin Silinmesi | Hızlı Ulaşım',
  description: 'Hızlı Ulaşım hesabınızı ve hesabınızla ilişkili verileri kalıcı olarak silme adımları.',
  alternates: { canonical: '/hesap-silme' },
  robots: { index: true, follow: true },
};

export default function AccountDeletionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
