import { NextResponse } from 'next/server';
import { getHat } from '@/services/iett';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hizliulasim.com';
const INDEX_NOW_KEY = process.env.INDEX_NOW_KEY || '';

/**
 * POST /api/index-now
 * Notify search engines (Bing, Yandex, etc.) about new/updated bus route pages.
 * Usage: POST /api/index-now?scope=all  → submit all bus routes
 *        POST /api/index-now?hat=500T   → submit single route
 */
export async function POST(request: Request) {
  if (!INDEX_NOW_KEY) {
    return NextResponse.json(
      { error: 'INDEX_NOW_KEY environment variable is not set' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope');
  const hatKodu = searchParams.get('hat');

  let urlList: string[] = [];

  try {
    if (scope === 'all') {
      const hatlar = await getHat();
      urlList = [
        `${SITE_URL}/otobus-hatlari`,
        ...hatlar.map((h) => `${SITE_URL}/otobus-hatlari/${h.SHATKODU}`),
      ];
    } else if (hatKodu) {
      urlList = [`${SITE_URL}/otobus-hatlari/${hatKodu.toUpperCase()}`];
    } else {
      return NextResponse.json(
        { error: 'scope=all veya hat={hatKodu} parametresi gerekli' },
        { status: 400 }
      );
    }

    // IndexNow batch API (max 10000 URLs per request)
    const batchSize = 10000;
    const results = [];

    for (let i = 0; i < urlList.length; i += batchSize) {
      const batch = urlList.slice(i, i + batchSize);
      const payload = {
        host: new URL(SITE_URL).hostname,
        key: INDEX_NOW_KEY,
        keyLocation: `${SITE_URL}/${INDEX_NOW_KEY}.txt`,
        urlList: batch,
      };

      const res = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      results.push({
        batch: Math.floor(i / batchSize) + 1,
        count: batch.length,
        status: res.status,
        ok: res.ok,
      });
    }

    return NextResponse.json({
      success: true,
      totalUrls: urlList.length,
      results,
    });
  } catch (error) {
    console.error('IndexNow error:', error);
    return NextResponse.json(
      { error: 'IndexNow bildirimi başarısız' },
      { status: 500 }
    );
  }
}
