import { normalizeIettStaticCode } from '../lib/iett-static/contracts.ts';
import { repairTurkishMojibake } from '../lib/textEncoding.ts';
import type { IETTDuyuru } from '../types/iett.ts';

const defaultEndpoint = 'https://cms.hizliulasim.com/wp-json/hizliulasim/v1/iett-alerts?consumer=web-v2';
const maxAlerts = 500;
const maxBodyBytes = 2 * 1024 * 1024;
const requestTimeoutMs = 10_000;

export type IettAlertSource = 'current' | 'stale';

export interface IettAlertsResult {
  data: IETTDuyuru[];
  metadata: { source: IettAlertSource; fetchedAt: string };
}

interface IettAlertsQuery {
  lineCode?: string;
  limit?: number;
}

interface IettAlertsDependencies {
  endpoint?: string;
  fetcher?: typeof fetch;
  now?: () => Date;
}

export class IettAlertsUnavailableError extends Error {
  constructor() {
    super('İETT alerts are temporarily unavailable');
    this.name = 'IettAlertsUnavailableError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

function normalizedText(value: unknown, maximum: number): string | null {
  if (typeof value !== 'string') return null;
  const text = repairTurkishMojibake(value).trim().replace(/\s+/gu, ' ');
  if (text.length === 0 || text.length > maximum || /[\u0000-\u001f\u007f]/u.test(text)) return null;
  return text;
}

function normalizedSourceUrl(value: unknown): string | null | false {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > 160) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'www.iett.istanbul' || url.port
      || url.username || url.password || url.search || url.hash
      || !/^\/Announcement\/Detail\/[0-9]{1,10}$/u.test(url.pathname)) return false;
    return url.href;
  } catch {
    return false;
  }
}

function parseAlert(value: unknown): IETTDuyuru | null {
  if (!isRecord(value)
    || (!hasExactKeys(value, ['HATKODU', 'HAT', 'TIP', 'GUNCELLEME_SAATI', 'MESAJ'])
      && !hasExactKeys(value, ['HATKODU', 'HAT', 'TIP', 'GUNCELLEME_SAATI', 'MESAJ', 'KAYNAK_URL']))) return null;
  const lineCode = typeof value.HATKODU === 'string' ? normalizeIettStaticCode(value.HATKODU) : null;
  const lineName = normalizedText(value.HAT, 256);
  const type = normalizedText(value.TIP, 64);
  const updatedAt = normalizedText(value.GUNCELLEME_SAATI, 128);
  const message = normalizedText(value.MESAJ, 4096);
  const sourceUrl = normalizedSourceUrl(value.KAYNAK_URL);
  if (lineCode === null || lineName === null || type === null || updatedAt === null || message === null
    || sourceUrl === false) return null;
  return {
    HATKODU: lineCode,
    HAT: lineName,
    TIP: type,
    GUNCELLEME_SAATI: updatedAt,
    MESAJ: message,
    KAYNAK_URL: sourceUrl,
  };
}

function parseEnvelope(value: unknown): IettAlertsResult {
  if (!isRecord(value) || !hasExactKeys(value, ['data', 'status', 'fetchedAt'])
    || (value.status !== 'current' && value.status !== 'stale')
    || typeof value.fetchedAt !== 'string' || Number.isNaN(Date.parse(value.fetchedAt))
    || !Array.isArray(value.data) || value.data.length > maxAlerts) {
    throw new IettAlertsUnavailableError();
  }
  const data = value.data.map(parseAlert);
  if (data.some((entry) => entry === null)) throw new IettAlertsUnavailableError();
  return {
    data: data as IETTDuyuru[],
    metadata: { source: value.status, fetchedAt: value.fetchedAt },
  };
}

function alertMinutes(value: string): number | null {
  const match = value.match(/(?:^|\s)([01][0-9]|2[0-3]):([0-5][0-9])(?:\s|$)/u);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function sortIettAlertsByRecency(alerts: readonly IETTDuyuru[], referenceMinutes: number): IETTDuyuru[] {
  const minute = ((referenceMinutes % 1440) + 1440) % 1440;
  return alerts.map((alert, index) => ({ alert, index, time: alertMinutes(alert.GUNCELLEME_SAATI) }))
    .sort((first, second) => {
      if (first.time === null && second.time === null) return first.index - second.index;
      if (first.time === null) return 1;
      if (second.time === null) return -1;
      const firstAge = (minute - first.time + 1440) % 1440;
      const secondAge = (minute - second.time + 1440) % 1440;
      return firstAge - secondAge || first.index - second.index;
    })
    .map(({ alert }) => alert);
}

function deduplicateAnnouncements(alerts: readonly IETTDuyuru[]): IETTDuyuru[] {
  const seen = new Set<string>();
  return alerts.filter((alert) => {
    const identity = `${alert.GUNCELLEME_SAATI}\u0000${alert.MESAJ}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function istanbulMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0') % 24;
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

function alertsEndpoint(configured?: string, lineCode?: string): string {
  try {
    const url = new URL(configured?.trim() || process.env.IETT_ALERTS_CMS_URL?.trim() || defaultEndpoint);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('unsafe');
    if (lineCode !== undefined) url.searchParams.set('hatKodu', lineCode);
    return url.href;
  } catch {
    throw new IettAlertsUnavailableError();
  }
}

export async function getIettAlerts(
  query: IettAlertsQuery = {},
  dependencies: IettAlertsDependencies = {},
): Promise<IettAlertsResult> {
  const fetcher = dependencies.fetcher ?? fetch;
  const normalizedLine = query.lineCode === undefined ? null : normalizeIettStaticCode(query.lineCode);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), requestTimeoutMs);
  try {
    const response = await fetcher(alertsEndpoint(
      dependencies.endpoint,
      normalizedLine ?? undefined,
    ), {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: abort.signal,
    });
    if (!response.ok) throw new IettAlertsUnavailableError();
    const contentLength = response.headers.get('content-length');
    if (contentLength !== null && Number(contentLength) > maxBodyBytes) throw new IettAlertsUnavailableError();
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBodyBytes) throw new IettAlertsUnavailableError();
    const parsed = parseEnvelope(JSON.parse(text) as unknown);
    if (query.lineCode !== undefined && normalizedLine === null) {
      return { data: [], metadata: parsed.metadata };
    }
    const filtered = normalizedLine === null
      ? parsed.data
      : parsed.data.filter((alert) => alert.HATKODU === normalizedLine);
    const sorted = sortIettAlertsByRecency(filtered, istanbulMinutes((dependencies.now ?? (() => new Date()))()));
    const visible = query.lineCode === undefined ? deduplicateAnnouncements(sorted) : sorted;
    const limit = query.limit === undefined ? visible.length : Math.max(0, Math.min(20, Math.trunc(query.limit)));
    return { data: visible.slice(0, limit), metadata: parsed.metadata };
  } catch (error) {
    if (error instanceof IettAlertsUnavailableError) throw error;
    throw new IettAlertsUnavailableError();
  } finally {
    clearTimeout(timer);
    abort.abort();
  }
}
