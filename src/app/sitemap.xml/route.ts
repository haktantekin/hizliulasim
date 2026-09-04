import { getHat } from '@/services/iett';
import { loadSitemapGroups } from '@/lib/sitemapData';
import { serializeSitemapIndex } from '@/lib/sitemapEngine';

const SITE_URL = 'https://hizliulasim.com';

export const revalidate = 3600;

export async function GET() {
  const groups = await loadSitemapGroups({
    getBusCodes: async () => (await getHat()).map((line) => line.SHATKODU),
  });

  return new Response(serializeSitemapIndex(groups, SITE_URL), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
