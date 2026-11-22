import type { Metadata } from 'next';
import { fetchPostBySlug } from '@/services/wordpress';
import Breadcrumb from '@/components/ui/Breadcrumb';
import BusRouteDetailClient from '@/components/bus/BusRouteDetailClient';
import PostComments from '@/components/blog/PostComments';
import DataSourceNotice from '@/components/ui/DataSourceNotice';

const SITE_URL = 'https://hizliulasim.com';
const DEFAULT_IMAGE = 'https://cms.hizliulasim.com/wp-content/uploads/2026/02/otobus-hatlari.jpeg';

export const revalidate = 3600; // Published route content changes infrequently.
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ hatKodu: string }>;
}): Promise<Metadata> {
  const { hatKodu } = await params;
  const upperCode = hatKodu.toUpperCase();
  const canonicalSlug = hatKodu.toLowerCase();

  const title = `${upperCode} Otobüs Hattı - Güzergah, Sefer Saatleri`;
  const description = `İETT ${upperCode} otobüs hattı güzergahı, hareket saatleri, canlı araç konumları ve duyuruları.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/otobus-hatlari/${canonicalSlug}` },
    openGraph: {
      title: `${upperCode} Otobüs Hattı | Hızlı Ulaşım`,
      description,
      url: `${SITE_URL}/otobus-hatlari/${canonicalSlug}`,
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

      <DataSourceNotice
        sources={['iett', 'ibbOpenData', 'iettLive', 'ibbOpenDataLicense']}
        note="Hat, durak ve sefer verileri ile canlı araç konumları İBB Açık Veri Lisansı kapsamında ilgili resmî kaynaklardan sağlanır; anlık koşullara göre değişebilir."
      />

      {wpPost && <PostComments postId={wpPost.id} />}
    </div>
  );
}
