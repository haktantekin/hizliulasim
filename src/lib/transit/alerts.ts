export type TransitAlertMode = 'bus' | 'metro';
export type TransitAlertSource = 'iett' | 'metro';

export interface TransitAlert {
  id: string;
  source: TransitAlertSource;
  mode: TransitAlertMode;
  lineCode: string | null;
  title: string;
  message: string;
  updatedAt: string;
  href?: string;
  external?: boolean;
}

export interface TransitAlertFilter {
  mode: 'all' | TransitAlertMode;
  query: string;
}

interface TransitAlertPayloads {
  iett?: unknown;
  metro?: unknown;
  iettLines?: unknown;
  metroLines?: unknown;
}

const iettLineCodePattern = /^[0-9A-ZÇĞİÖŞÜ-]{1,32}$/u;
const iettTimeOnlyPattern = /^(?:Kayit|Kayıt) Saati:\s*([01]\d|2[0-3]):([0-5]\d)$/u;
const htmlNamedEntities: Readonly<Record<string, string>> = {
  amp: '&',
  apos: "'",
  bull: '•',
  Ccedil: 'Ç',
  ccedil: 'ç',
  gt: '>',
  hellip: '…',
  ldquo: '“',
  lsquo: '‘',
  lt: '<',
  mdash: '—',
  nbsp: ' ',
  ndash: '–',
  Ouml: 'Ö',
  ouml: 'ö',
  quot: '"',
  rdquo: '”',
  rsquo: '’',
  Uuml: 'Ü',
  uuml: 'ü',
};

const alertDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Istanbul',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function normalizeIettAlertLineCode(value: string): string | null {
  const normalized = value.trim().toLocaleUpperCase('tr-TR');
  return iettLineCodePattern.test(normalized) ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z][a-z0-9]+);/giu, (entity, token: string) => {
    if (token.startsWith('#')) {
      const hexadecimal = token[1]?.toLocaleLowerCase('en-US') === 'x';
      const codePoint = Number.parseInt(token.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff
        || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return entity;
      return String.fromCodePoint(codePoint);
    }
    return htmlNamedEntities[token] ?? entity;
  });
}

function cleanText(value: unknown, maximum: number, { html = false } = {}): string | null {
  if (typeof value !== 'string' || value.length > maximum * 4 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
    return null;
  }
  const withoutMarkup = html ? value.replace(/<[^>]*>/gu, ' ') : value;
  const text = decodeHtmlEntities(withoutMarkup)
    .replace(/\s+/gu, ' ')
    .trim();
  return text.length > 0 && text.length <= maximum ? text : null;
}

function officialIettSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 160) return null;
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

function parseTransitAlertDateTime(value: string): Date | null {
  const iett = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/u.exec(value);
  const candidate = iett
    ? `${iett[3]}-${iett[2]}-${iett[1]}T${iett[4]}:${iett[5]}:00+03:00`
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/u.test(value)
      ? `${value}+03:00`
      : value;
  const parsed = new Date(candidate);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function formatTransitAlertDateTime(value: string): string {
  const sourceTime = iettTimeOnlyPattern.exec(value);
  if (sourceTime) return `${sourceTime[1]}:${sourceTime[2]}`;
  const date = parseTransitAlertDateTime(value);
  if (date === null) return '';
  const parts = Object.fromEntries(
    alertDateTimeFormatter.formatToParts(date).map(({ type, value: part }) => [type, part]),
  );
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

function knownIettLineCodes(value: unknown): ReadonlySet<string> {
  const codes = new Set<string>();
  if (!Array.isArray(value)) return codes;
  for (const item of value) {
    if (!isRecord(item) || typeof item.SHATKODU !== 'string') continue;
    const code = normalizeIettAlertLineCode(item.SHATKODU);
    if (code !== null && code !== 'GENEL') codes.add(code);
  }
  return codes;
}

function knownMetroLineCodes(value: unknown): ReadonlySet<string> {
  const codes = new Set<string>();
  if (!Array.isArray(value)) return codes;
  for (const item of value) {
    if (!isRecord(item)) continue;
    const code = metroLineCode(item.Name);
    if (code !== null) codes.add(code);
  }
  return codes;
}

function normalizeSearch(value: string): string {
  return value
    .toLocaleUpperCase('tr-TR')
    .replace(/[İI]/gu, 'I')
    .replace(/Ş/gu, 'S')
    .replace(/Ğ/gu, 'G')
    .replace(/Ü/gu, 'U')
    .replace(/Ö/gu, 'O')
    .replace(/Ç/gu, 'C')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function metroLineCode(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const normalized = value.toLocaleUpperCase('tr-TR').replace(/İ/gu, 'I');
    const match = /(?:^|[^A-Z0-9])(M\d{1,2}[A-Z]?|TF\d{1,2}|T\d{1,2}|F\d{1,2})(?=$|[^A-Z0-9])/u.exec(normalized);
    if (match) return match[1];
  }
  return null;
}

function normalizeIettAlert(value: unknown, knownLines: ReadonlySet<string>): TransitAlert | null {
  if (!isRecord(value)) return null;
  const sourceUrl = value.KAYNAK_URL === null || value.KAYNAK_URL === undefined || value.KAYNAK_URL === ''
    ? null
    : officialIettSourceUrl(value.KAYNAK_URL);
  if (value.KAYNAK_URL !== null && value.KAYNAK_URL !== undefined && value.KAYNAK_URL !== '' && sourceUrl === null) return null;
  const lineCode = typeof value.HATKODU === 'string' ? normalizeIettAlertLineCode(value.HATKODU) : null;
  const title = cleanText(value.HAT, 256);
  const type = cleanText(value.TIP, 64);
  const message = cleanText(value.MESAJ, 4096);
  const updatedAt = cleanText(value.GUNCELLEME_SAATI, 128);
  if (lineCode === null || title === null || type === null || message === null || updatedAt === null) return null;
  return {
    id: `iett:${lineCode}:${updatedAt}:${message}`,
    source: 'iett',
    mode: 'bus',
    lineCode,
    title,
    message,
    updatedAt,
    ...(knownLines.has(lineCode)
      ? { href: `/otobus-hatlari/${encodeURIComponent(lineCode.toLocaleLowerCase('tr-TR'))}` }
      : sourceUrl ? { href: sourceUrl, external: true } : {}),
  };
}

function normalizeMetroAlert(value: unknown, knownLines: ReadonlySet<string>): TransitAlert | null {
  if (!isRecord(value) || typeof value.Id !== 'number' || !Number.isSafeInteger(value.Id) || value.Id < 0) return null;
  const title = cleanText(value.Title, 256, { html: true });
  const message = cleanText(value.Content, 4096, { html: true });
  const updatedAt = cleanText(value.StartDate, 128);
  if (title === null || message === null || updatedAt === null || parseTransitAlertDateTime(updatedAt) === null) return null;
  const lineCode = metroLineCode(value.LineName, value.Title, value.Content);
  return {
    id: `metro:${value.Id}`,
    source: 'metro',
    mode: 'metro',
    lineCode,
    title,
    message,
    updatedAt,
    ...(lineCode && knownLines.has(lineCode)
      ? { href: `/rayli-sistemler/${lineCode.toLocaleLowerCase('tr-TR')}` }
      : {}),
  };
}

function timestamp(value: string, now: Date): number {
  const sourceTime = iettTimeOnlyPattern.exec(value);
  if (sourceTime) {
    const nowParts = Object.fromEntries(
      alertDateTimeFormatter.formatToParts(now).map(({ type, value: part }) => [type, part]),
    );
    const referenceMinutes = Number(nowParts.hour) * 60 + Number(nowParts.minute);
    const alertMinutes = Number(sourceTime[1]) * 60 + Number(sourceTime[2]);
    const ageMinutes = (referenceMinutes - alertMinutes + 1440) % 1440;
    return now.getTime() - ageMinutes * 60_000;
  }
  return parseTransitAlertDateTime(value)?.getTime() ?? 0;
}

export function normalizeTransitAlerts(payloads: TransitAlertPayloads, now = new Date()): TransitAlert[] {
  const normalized: TransitAlert[] = [];
  const iettLines = knownIettLineCodes(payloads.iettLines);
  const metroLines = knownMetroLineCodes(payloads.metroLines);
  if (Array.isArray(payloads.iett)) {
    for (const value of payloads.iett) {
      const alert = normalizeIettAlert(value, iettLines);
      if (alert) normalized.push(alert);
    }
  }
  if (Array.isArray(payloads.metro)) {
    for (const value of payloads.metro) {
      const alert = normalizeMetroAlert(value, metroLines);
      if (alert) normalized.push(alert);
    }
  }
  const seen = new Set<string>();
  return normalized
    .filter((alert) => !seen.has(alert.id) && Boolean(seen.add(alert.id)))
    .map((alert, index) => ({ alert, index, time: timestamp(alert.updatedAt, now) }))
    .sort((first, second) => second.time - first.time || first.index - second.index)
    .map(({ alert }) => alert);
}

export function getAlertsForLine(
  alerts: readonly TransitAlert[],
  lineCode: string,
  mode?: TransitAlertMode,
): TransitAlert[] {
  const normalized = mode === 'bus'
    ? normalizeIettAlertLineCode(lineCode)
    : metroLineCode(lineCode);
  if (normalized === null) return [];
  return alerts.filter((alert) => alert.lineCode === normalized && (mode === undefined || alert.mode === mode));
}

export function filterTransitAlerts(alerts: readonly TransitAlert[], filter: TransitAlertFilter): TransitAlert[] {
  const query = normalizeSearch(filter.query.trim());
  return alerts.filter((alert) => {
    if (filter.mode !== 'all' && alert.mode !== filter.mode) return false;
    if (!query) return true;
    return normalizeSearch([alert.lineCode, alert.title, alert.message].filter(Boolean).join(' ')).includes(query);
  });
}

export function getTransitAlertCounts(alerts: readonly TransitAlert[]) {
  let bus = 0;
  let metro = 0;
  for (const alert of alerts) {
    if (alert.mode === 'bus') bus += 1;
    else metro += 1;
  }
  return { all: alerts.length, bus, metro };
}
