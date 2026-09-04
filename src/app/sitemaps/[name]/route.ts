import { getHat } from '@/services/iett';
import { loadSitemapGroups } from '@/lib/sitemapData';
import { serializeUrlSet } from '@/lib/sitemapEngine';

export const revalidate = 3600;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!name.endsWith('.xml')) {
    return new Response('Not found', { status: 404 });
  }

  const groupName = name.slice(0, -4);
  const groups = await loadSitemapGroups({
    getBusCodes: async () => (await getHat()).map((line) => line.SHATKODU),
  });
  const group = groups.find((item) => item.name === groupName);
  if (!group) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(serializeUrlSet(group.entries), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
