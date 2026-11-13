import type { IETTDuyuru } from '@/types/iett';

const alertKeys = ['GUNCELLEME_SAATI', 'HAT', 'HATKODU', 'MESAJ', 'TIP'] as const;
const lineCodePattern = /^[0-9A-ZÇĞİÖŞÜ-]{1,32}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedLineCode(value: string): string | null {
  const code = value.trim().toLocaleUpperCase('tr-TR');
  return lineCodePattern.test(code) ? code : null;
}

function isAlert(value: unknown): value is IETTDuyuru {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  if (keys.length !== alertKeys.length || keys.some((key, index) => key !== alertKeys[index])) return false;
  return alertKeys.every((key) => typeof value[key] === 'string' && (value[key] as string).trim().length > 0)
    && normalizedLineCode(value.HATKODU as string) !== null;
}

export function parseIettAlertList(value: unknown): IETTDuyuru[] | null {
  return Array.isArray(value) && value.length <= 20 && value.every(isAlert) ? value : null;
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

export function summarizeIettAlertMessage(message: string, maximum = 140): string {
  const compact = message.trim().replace(/\s+/gu, ' ');
  if (compact.length <= maximum) return compact;
  if (maximum <= 1) return '…'.slice(0, maximum);
  return `${compact.slice(0, maximum - 1).trimEnd()}…`;
}
