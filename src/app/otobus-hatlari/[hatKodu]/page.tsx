import type { Metadata } from 'next';
import { getHat } from '@/services/iett';
import { fetchPostBySlug } from '@/services/wordpress';
import Breadcrumb from '@/components/ui/Breadcrumb';
import BusRouteDetailClient from '@/components/bus/BusRouteDetailClient';
import PostComments from '@/components/blog/PostComments';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';
const DEFAULT_IMAGE = 'https://cms.hizliulasim.com/wp-content/uploads/2026/02/otobus-hatlari.jpeg';

export const revalidate = 300; // Revalidate every 5 minutes

// Pre-render all bus routes at build time → no API delay for users
export async function generateStaticParams() {
  try {
    const hatlar = await getHat();
    return hatlar.map((h) => ({ hatKodu: h.SHATKODU }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ hatKodu: string }>;
}): Promise<Metadata> {
  const { hatKodu } = await params;
  const upperCode = hatKodu.toUpperCase();

  const title = `${upperCode} Otobüs Hattı - Güzergah, Sefer Saatleri`;
  const description = `İETT ${upperCode} otobüs hattı güzergahı, hareket saatleri, canlı araç konumları ve duyuruları.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/otobus-hatlari/${upperCode}` },
    openGraph: {
      title: `${upperCode} Otobüs Hattı | Hızlı Ulaşım`,
      description,
      url: `${SITE_URL}/otobus-hatlari/${upperCode}`,
      type: 'article',
      siteName: 'Hızlı Ulaşım',
      locale: 'tr_TR',
      images: [{ url: DEFAULT_IMAGE, width: 1200, height: 630, alt: `${upperCode} Otobüs Hattı` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${upperCode} - Otobüs Güzergahı | Hızlı Ulaşım`,
      description,
      images: [DEFAULT_IMAGE],
    },
  };
}

export default async function BusRouteDetailPage({
  params,
}: {
  params: Promise<{ hatKodu: string }>;
}) {
  const { hatKodu } = await params;
  const upperCode = hatKodu.toUpperCase();

  const wpPost = await fetchPostBySlug(upperCode.toLowerCase()).catch(() => null);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="bg-brand-soft-blue text-white text-lg font-bold px-3 py-1 rounded-lg">
            {upperCode}
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            {upperCode} Otobüs Hattı
          </h1>
        </div>
        <p className="text-sm text-gray-500">
          İETT otobüs hattı güzergah bilgileri, sefer saatleri ve canlı araç konumları
        </p>
      </div>

      <Breadcrumb
        className="mb-4"
        items={[
          { label: 'Otobüs Hatları', href: '/otobus-hatlari' },
          { label: upperCode },
        ]}
      />

      <BusRouteDetailClient
        hatKodu={upperCode}
        wpContent={wpPost?.content || null}
      />

      <p className="text-xs text-gray-500 text-center mt-6 mb-4">
        Bu sayfadaki bilgiler anlık olarak{' '}
        <a href="https://iett.istanbul/" target="_blank" rel="noopener">
          İETT resmi kurumu
        </a>{' '}
        tarafından sağlanmaktadır.
      </p>

      {wpPost && <PostComments postId={wpPost.id} />}
    </div>
  );
}
