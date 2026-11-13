import { normalizeIettStaticCode } from '../../../../lib/iett-static/contracts.ts';
import { getIettAlerts, type IettAlertsResult } from '../../../../services/iett-alerts.ts';

type AlertLoader = (query: { lineCode?: string; limit?: number }) => Promise<IettAlertsResult>;

export function createIettAlertsGet(loadAlerts: AlertLoader = getIettAlerts) {
  return async function GET(request: Request): Promise<Response> {
    const { searchParams } = new URL(request.url);
    const lineParam = searchParams.get('hatKodu');
    const limitParam = searchParams.get('limit');
    const lineCode = lineParam === null ? null : normalizeIettStaticCode(lineParam);
    const limit = limitParam === null || !/^[1-9][0-9]?$/.test(limitParam) ? null : Number(limitParam);
    if ((lineParam !== null && lineCode === null) || (limitParam !== null && (limit === null || limit > 20))) {
      return Response.json({ error: 'Geçersiz duyuru sorgusu' }, { status: 400 });
    }
    try {
      const result = await loadAlerts({
        ...(lineCode === null ? {} : { lineCode }),
        ...(limit === null ? {} : { limit }),
      });
      return Response.json(result.data, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
          'X-Hizliulasim-Alert-Source': result.metadata.source,
          'X-Hizliulasim-Alert-Fetched-At': result.metadata.fetchedAt,
          'X-Hizliulasim-Alert-Total': String(result.metadata.total),
        },
      });
    } catch {
      return Response.json({ error: 'İETT uyarıları şu anda kullanılamıyor' }, { status: 503 });
    }
  };
}
