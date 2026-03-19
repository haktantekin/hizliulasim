import type { Metadata } from 'next';
import DurakDetayClient from '@/components/bus/DurakDetayClient';
import { parseDurakSlug } from '@/lib/slugify';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';

export const revalidate = 3600; // 1 hour cache

export async function generateMetadata({
  params,
}: {
  params: Promise<{ durakSlug: string }>;
}): Promise<Metadata> {
  const { durakSlug } = await params;
  const durakKodu = parseDurakSlug(durakSlug);

  const title = `${durakKodu} Durağı - Geçen Otobüs Hatları`;
  const description = `İETT ${durakKodu} durağından geçen tüm otobüs hatları, güzergah bilgileri ve sefer saatleri.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/otobus-duraklari/${durakSlug}` },
    openGraph: {
      title: `${durakKodu} Durağı | Hızlı Ulaşım`,
      description,
      url: `${SITE_URL}/otobus-duraklari/${durakSlug}`,
      type: 'website',
    },
  };
}

export default async function DurakDetayPage({
  params,
}: {
  params: Promise<{ durakSlug: string }>;
}) {
  const { durakSlug } = await params;
  const durakKodu = parseDurakSlug(durakSlug);

  return (
    <div className="container mx-auto px-4 py-8">
      <DurakDetayClient durakKodu={durakKodu} />

      <p className="text-xs text-gray-500 text-center mt-6 mb-4">
        Bu sayfadaki bilgiler anlık olarak{' '}
        <a href="https://iett.istanbul/" target="_blank" rel="noopener">
          İETT resmi kurumu
        </a>{' '}
        tarafından sağlanmaktadır.
      </p>
    </div>
  );
}
