import type { Metadata } from 'next';
import DurakDetayClient from '@/components/bus/DurakDetayClient';
import DataSourceNotice from '@/components/ui/DataSourceNotice';
import { parseDurakSlug, parseDurakName } from '@/lib/slugify';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';

export const revalidate = 3600; // 1 hour cache

export async function generateMetadata({
  params,
}: {
  params: Promise<{ durakSlug: string }>;
}): Promise<Metadata> {
  const { durakSlug } = await params;
  const durakKodu = parseDurakSlug(durakSlug);
  const durakAdi = parseDurakName(durakSlug);

  const title = `${durakAdi} Durağı - Geçen Otobüs Hatları`;
  const description = `İETT ${durakAdi} durağından geçen tüm otobüs hatları, güzergah bilgileri ve sefer saatleri.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/otobus-duraklari/${durakSlug}` },
    openGraph: {
      title: `${durakAdi} Durağı | Hızlı Ulaşım`,
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

      <DataSourceNotice
        sources={['iett', 'ibbOpenData']}
        note="Durak ve geçen hat bilgileri İETT ile İBB Açık Veri kaynaklarından sağlanır."
      />
    </div>
  );
}
