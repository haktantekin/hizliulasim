import type { IETTDuyuru } from '@/types/iett';

const alertKeys = ['GUNCELLEME_SAATI', 'HAT', 'HATKODU', 'KAYNAK_URL', 'MESAJ', 'TIP'] as const;
const legacyAlertKeys = ['GUNCELLEME_SAATI', 'HAT', 'HATKODU', 'MESAJ', 'TIP'] as const;
const lineCodePattern = /^[0-9A-ZÇĞİÖŞÜ-]{1,32}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedLineCode(value: string): string | null {
  const code = value.trim().toLocaleUpperCase('tr-TR');
  return lineCodePattern.test(code) ? code : null;
}

function officialDetailUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'www.iett.istanbul' && !url.port
      && !url.username && !url.password && !url.search && !url.hash
      && /^\/Announcement\/Detail\/[0-9]{1,10}$/u.test(url.pathname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function parseAlert(value: unknown): IETTDuyuru | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value).sort();
  const isCurrent = keys.length === alertKeys.length && keys.every((key, index) => key === alertKeys[index]);
  const isLegacy = keys.length === legacyAlertKeys.length && keys.every((key, index) => key === legacyAlertKeys[index]);
  if (!isCurrent && !isLegacy) return null;
  if (!legacyAlertKeys.every((key) => typeof value[key] === 'string' && (value[key] as string).trim().length > 0)
    || normalizedLineCode(value.HATKODU as string) === null) return null;
  const sourceUrl = value.KAYNAK_URL === null || value.KAYNAK_URL === undefined
    ? null
    : officialDetailUrl(value.KAYNAK_URL);
  if (value.KAYNAK_URL !== null && value.KAYNAK_URL !== undefined && sourceUrl === null) return null;
  return { ...value, KAYNAK_URL: sourceUrl } as IETTDuyuru;
}

export function parseIettAlertList(value: unknown): IETTDuyuru[] | null {
  if (!Array.isArray(value) || value.length > 20) return null;
  const alerts = value.map(parseAlert);
  return alerts.every((alert) => alert !== null) ? alerts as IETTDuyuru[] : null;
}

export function extractIettAlertTime(value: string): string | null {
  return value.match(/(?:^|\s)([01][0-9]|2[0-3]):[0-5][0-9](?:\s|$)/u)?.[0].trim() ?? null;
}

export function buildIettLineHref(lineCode: string): string | null {
  const code = normalizedLineCode(lineCode);
  return code === null || code === 'GENEL'
    ? null
    : `/otobus-hatlari/${encodeURIComponent(code.toLocaleLowerCase('tr-TR'))}`;
}

export function buildIettLineAlertsEndpoint(lineCode: string): string | null {
  const code = normalizedLineCode(lineCode);
  return code === null ? null : `/api/iett/duyurular?hatKodu=${encodeURIComponent(code)}&limit=20`;
}

export function buildIettAlertDestination(alert: IETTDuyuru): { href: string; external: boolean } | null {
  const localHref = buildIettLineHref(alert.HATKODU);
  if (localHref !== null) return { href: localHref, external: false };
  const externalHref = officialDetailUrl(alert.KAYNAK_URL);
  return externalHref === null ? null : { href: externalHref, external: true };
}

export function summarizeIettAlertMessage(message: string, maximum = 140): string {
  const compact = message.trim().replace(/\s+/gu, ' ');
  if (compact.length <= maximum) return compact;
  if (maximum <= 1) return '…'.slice(0, maximum);
  return `${compact.slice(0, maximum - 1).trimEnd()}…`;
}

export function getIettAlertDetail(alert: IETTDuyuru): string | null {
  const title = alert.HAT.trim().replace(/\s+/gu, ' ');
  const detail = alert.MESAJ.trim().replace(/\s+/gu, ' ');
  return detail === title ? null : alert.MESAJ;
}
