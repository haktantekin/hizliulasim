export type MinibusFareEntry = {
  boarding: string;
  alighting: string;
  fareTry: number;
  distanceKm: number;
};

export type MinibusFareTariff = {
  lineCode: string;
  lineName: string;
  verifiedAt?: string;
  studentFareTry?: number;
  decisionDate?: string;
  effectiveDate?: string;
  flatFares: Array<{ label: string; fareTry: number }>;
  entries: MinibusFareEntry[];
};

export class MinibusFareError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MinibusFareError';
  }
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
};

function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&([a-z]+);/gi, (entity, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? entity);
}

function textFromHtml(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function selectedOption(html: string, selectId: string): { value: string; text: string } {
  const select = html.match(new RegExp(`<select\\b[^>]*\\bid=["']${selectId}["'][^>]*>([\\s\\S]*?)<\\/select>`, 'i'));
  if (!select) throw new MinibusFareError(`${selectId} alanı bulunamadı.`);
  for (const match of select[1].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)) {
    const attributes = match[1];
    if (!/\bselected(?:\s*=\s*["'][^"']*["'])?/i.test(attributes)) continue;
    const value = attributes.match(/\bvalue\s*=\s*["']([^"']*)["']/i)?.[1];
    if (value === undefined) throw new MinibusFareError(`${selectId} seçimi değersiz.`);
    return { value: decodeHtml(value).trim(), text: textFromHtml(match[2]) };
  }
  throw new MinibusFareError(`${selectId} seçili değeri bulunamadı.`);
}

function normalizedCode(value: string): string {
  return value.trim().toLocaleUpperCase('tr-TR').replace(/\s+/g, '');
}

function localizedNumber(value: string, label: string): number {
  const match = value.match(/\d[\d.,]*/);
  if (!match) throw new MinibusFareError(`${label} sayısal değil: ${value}`);
  const normalized = match[0].includes(',')
    ? match[0].replace(/\./g, '').replace(',', '.')
    : match[0];
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) throw new MinibusFareError(`${label} ayrıştırılamadı: ${value}`);
  return parsed;
}

function isoDate(value: string): string {
  const match = value.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) throw new MinibusFareError(`Tarife tarihi ayrıştırılamadı: ${value}`);
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function optionalDate(htmlText: string, pattern: RegExp): string | undefined {
  const match = htmlText.match(pattern);
  return match ? isoDate(match[1]) : undefined;
}

export function parseMinibusFareTariffHtml(html: string, expectedCode: string): MinibusFareTariff {
  const vehicle = selectedOption(html, 'CarTypeSelect');
  if (vehicle.value.toLocaleUpperCase('tr-TR') !== 'MİNİBÜS') {
    throw new MinibusFareError(`Beklenen MİNİBÜS tarifesi yerine ${vehicle.value} seçildi.`);
  }
  const line = selectedOption(html, 'UcretSelect');
  if (normalizedCode(line.value) !== normalizedCode(expectedCode)) {
    throw new MinibusFareError(`İstenen ${expectedCode} yerine ${line.value} tarifesi seçildi.`);
  }

  const table = html.match(/<table\b[^>]*\bid=["']GridView1["'][^>]*>([\s\S]*?)<\/table>/i);
  if (!table) throw new MinibusFareError(`${line.value} için resmî ücret tablosu bulunamadı.`);
  const rows = [...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => (
    [...row[1].matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map((cell) => textFromHtml(cell[1]))
  ));
  const header = rows.shift()?.map((value) => value.toLocaleUpperCase('tr-TR'));
  if (!header || header.length < 4 || header[0] !== 'BİNİŞ YERİ' || header[1] !== 'İNİŞ YERİ') {
    throw new MinibusFareError(`${line.value} ücret tablosunun başlıkları tanınmadı.`);
  }

  const entries: MinibusFareEntry[] = [];
  const flatFares: Array<{ label: string; fareTry: number }> = [];
  for (const row of rows.filter((candidate) => candidate.some(Boolean))) {
    if (row.length < 4) {
      throw new MinibusFareError(`${line.value} ücret tablosunda eksik satır bulundu.`);
    }
    const fareTry = localizedNumber(row[2], 'Ücret');
    const distanceKm = localizedNumber(row[3], 'Mesafe');
    if (!row[0] && !row[1] && distanceKm === 0) continue;
    if (!row[0]) throw new MinibusFareError(`${line.value} ücret tablosunda eksik biniş yeri bulundu.`);
    if (!row[1] && distanceKm === 0) {
      flatFares.push({ label: row[0], fareTry });
      continue;
    }
    if (!row[1]) throw new MinibusFareError(`${line.value} ücret tablosunda eksik iniş yeri bulundu.`);
    entries.push({
      boarding: row[0],
      alighting: row[1],
      fareTry,
      distanceKm,
    });
  }
  if (entries.length === 0 && flatFares.length === 0) {
    throw new MinibusFareError(`${line.value} ücret tablosu boş.`);
  }

  const allText = textFromHtml(html);
  const studentFare = allText.match(/MİNİBÜS ÖĞRENCİ ÜCRETİ\s+([\d.,]+)\s*TL/i)?.[1];
  return {
    lineCode: line.value,
    lineName: line.text.replace(new RegExp(`^${line.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\/\\s*`, 'i'), ''),
    studentFareTry: studentFare ? localizedNumber(studentFare, 'Öğrenci ücreti') : undefined,
    decisionDate: optionalDate(allText, /ÜCRET TARİFESİ\s+(\d{2}\.\d{2}\.\d{4})\s+tarih/i),
    effectiveDate: optionalDate(allText, /FİYATLAR\s+(\d{2}\.\d{2}\.\d{4})\s+TARİHİNDEN/i),
    flatFares,
    entries,
  };
}

function normalizedStop(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}

export function findMinibusFarePair(
  entries: MinibusFareEntry[],
  boarding: string,
  alighting: string,
): MinibusFareEntry | null {
  const first = normalizedStop(boarding);
  const second = normalizedStop(alighting);

  const uniqueMatch = (matches: MinibusFareEntry[]): MinibusFareEntry | null => {
    if (matches.length === 0) return null;
    const candidate = matches[0];
    return matches.every((entry) => (
      entry.fareTry === candidate.fareTry && entry.distanceKm === candidate.distanceKm
    )) ? candidate : null;
  };
  const exact = entries.filter((entry) => (
    normalizedStop(entry.boarding) === first
    && normalizedStop(entry.alighting) === second
  ));
  if (exact.length > 0) return uniqueMatch(exact);

  const reverse = entries.filter((entry) => (
    normalizedStop(entry.boarding) === second
    && normalizedStop(entry.alighting) === first
  ));
  return uniqueMatch(reverse);
}

export function findMinibusFareTariffByCode(
  tariffs: MinibusFareTariff[],
  code: string,
): MinibusFareTariff | null {
  const expected = normalizedCode(code);
  return tariffs.find((tariff) => normalizedCode(tariff.lineCode) === expected) ?? null;
}

export function defaultMinibusFareSelection(tariff: MinibusFareTariff): {
  boarding: string;
  alighting: string;
  entry: MinibusFareEntry;
} | null {
  const unambiguousEntries = tariff.entries.filter((entry) => (
    findMinibusFarePair(tariff.entries, entry.boarding, entry.alighting) === entry
  ));
  if (unambiguousEntries.length === 0) return null;
  const entry = unambiguousEntries.reduce((longest, candidate) => (
    candidate.distanceKm > longest.distanceKm ? candidate : longest
  ));
  return { boarding: entry.boarding, alighting: entry.alighting, entry };
}
