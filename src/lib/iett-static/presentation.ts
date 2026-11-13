export type IettFreshnessSource = 'current' | 'previous';

export interface IettFreshness {
  source: IettFreshnessSource;
  version: string | null;
  generatedAt: string | null;
}

export const scheduleDataLabel = 'Planlanan';

export function parseIettFreshnessHeaders(headers: Headers): IettFreshness | null {
  const rawSource = headers.get('X-Hizliulasim-Data-Source');
  const source = rawSource?.startsWith('iett-') ? rawSource.slice(5) : '';
  if (source !== 'current' && source !== 'previous') return null;
  const version = headers.get('X-Hizliulasim-Data-Version');
  const generatedAt = headers.get('X-Hizliulasim-Data-Generated-At');
  if (generatedAt !== null && !Number.isFinite(Date.parse(generatedAt))) return null;
  if (version === null || generatedAt === null) return null;
  return { source, version, generatedAt };
}

export function formatIettFreshness(freshness: IettFreshness | null): string | null {
  if (freshness === null) return null;
  if (freshness.generatedAt === null) return null;
  const date = new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Istanbul',
  }).format(new Date(freshness.generatedAt));
  return freshness.source === 'previous'
    ? `Önceki doğrulanmış veri paketi: ${date}`
    : `Veri güncellemesi: ${date}`;
}
