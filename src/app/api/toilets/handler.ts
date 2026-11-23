import type { ToiletEnvelope } from '../../../lib/toilets/contracts.ts';
import { encodeToiletEnvelope } from '../../../lib/toilets/wire.ts';

export function createToiletsHandler(load: () => Promise<ToiletEnvelope>) {
  return async function GET(): Promise<Response> {
    try {
      const data = await load();
      if (data.toilets.length === 0) {
        return Response.json({ error: 'Tuvalet bilgileri şu anda alınamıyor.' }, {
          status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '600' },
        });
      }
      return Response.json(encodeToiletEnvelope(data), {
        headers: {
          'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=60, must-revalidate',
        },
      });
    } catch {
      return Response.json({ error: 'Tuvalet bilgileri şu anda alınamıyor.' }, {
        status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '600' },
      });
    }
  };
}
