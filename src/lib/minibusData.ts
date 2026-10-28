import { slugify } from './slugify.ts';

export type MinibusVehicleType = 'minibus' | 'taksi-dolmus';

export type MinibusLine = {
  code: string;
  name: string;
  slug: string;
  vehicleType: MinibusVehicleType;
  vehicleTypeLabel: 'Minibüs' | 'Taksi dolmuş';
  sourceIds: string[];
};

export type MinibusOperatingWindow = {
  start: string;
  end: string;
  intervalMinutes: number;
};

export type MinibusLineDetails = {
  routeName: string;
  lengthKm?: number;
  durationMinutes?: number;
  sourceRouteId?: string;
  sourceObjectId?: string;
  weekday?: MinibusOperatingWindow;
  weekend?: MinibusOperatingWindow;
};

export type MinibusRoutePoint = {
  lat: number;
  lng: number;
};

export type MinibusSchedule = {
  weekdayOutbound: string[];
  weekdayReturn: string[];
  weekendOutbound: string[];
  weekendReturn: string[];
};

export type MinibusStop = {
  id: number;
  name: string;
};

export const SUPPORTED_MINIBUS_CITIES = [
  { slug: 'istanbul', name: 'İstanbul' },
] as const;

export type SupportedMinibusCity = (typeof SUPPORTED_MINIBUS_CITIES)[number];

export function getSupportedMinibusCity(slug: string): SupportedMinibusCity | null {
  return SUPPORTED_MINIBUS_CITIES.find((city) => city.slug === slug.toLocaleLowerCase('tr-TR')) ?? null;
}

export function findMinibusLineBySlug(lines: MinibusLine[], slug: string): MinibusLine | null {
  return lines.find((line) => line.slug === slug) ?? null;
}

export class MinibusDataError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MinibusDataError';
  }
}

type SourceLine = {
  Value: string;
  Text: string;
  Status: string;
};

function parseJsonBridge(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object' || !('d' in payload)) {
    throw new MinibusDataError('Resmî minibüs yanıtı beklenen biçimde değil.');
  }

  const bridgeValue = (payload as { d: unknown }).d;
  if (typeof bridgeValue !== 'string') return bridgeValue;

  try {
    return JSON.parse(bridgeValue) as unknown;
  } catch (error) {
    throw new MinibusDataError('Resmî minibüs yanıtı ayrıştırılamadı.', { cause: error });
  }
}

function parseJsonString(value: unknown, errorMessage: string): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    throw new MinibusDataError(errorMessage, { cause: error });
  }
}

function vehicleTypeFromStatus(status: string): Pick<MinibusLine, 'vehicleType' | 'vehicleTypeLabel'> | null {
  const normalized = status.trim().toLocaleUpperCase('tr-TR');
  if (normalized === 'MİNİBÜS') {
    return { vehicleType: 'minibus', vehicleTypeLabel: 'Minibüs' };
  }
  if (normalized === 'TAKSİ DOLMUŞ') {
    return { vehicleType: 'taksi-dolmus', vehicleTypeLabel: 'Taksi dolmuş' };
  }
  return null;
}

function sourceIdSuffix(sourceId: string): string {
  return sourceId.replace(/[{}]/g, '').split('-')[0].toLowerCase();
}

function normalizedSourceId(value: string): string | null {
  const match = value.trim().match(/^\{?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\}?$/i);
  return match ? `{${match[1].toUpperCase()}}` : null;
}

function officialLineSlug(value: string): string {
  return slugify(value.normalize('NFKD').replace(/\p{Mark}/gu, ''));
}

export function parseMinibusLinesPayload(payload: unknown): MinibusLine[] {
  const raw = parseJsonBridge(payload);
  if (!Array.isArray(raw)) {
    throw new MinibusDataError('Resmî minibüs listesi bir dizi değil.');
  }

  const grouped = new Map<string, Omit<MinibusLine, 'slug'>>();
  let invalidRecordCount = 0;

  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      invalidRecordCount += 1;
      continue;
    }
    const candidate = item as Partial<SourceLine>;
    if (
      typeof candidate.Value !== 'string'
      || typeof candidate.Text !== 'string'
      || typeof candidate.Status !== 'string'
    ) {
      invalidRecordCount += 1;
      continue;
    }

    const match = candidate.Text.trim().match(/^([0-9A-Za-zÇĞİÖŞÜçğıöşü]+)\s*-\s*(.+)$/u);
    const vehicle = vehicleTypeFromStatus(candidate.Status);
    const sourceId = normalizedSourceId(candidate.Value);
    if (!match || !vehicle || !sourceId) {
      invalidRecordCount += 1;
      continue;
    }

    const code = match[1].toLocaleUpperCase('tr-TR');
    const name = match[2].trim();
    if (!code || !name) {
      invalidRecordCount += 1;
      continue;
    }

    const key = `${vehicle.vehicleType}\u0000${code}\u0000${name}`;
    const existing = grouped.get(key);
    if (existing) {
      if (!existing.sourceIds.includes(sourceId)) {
        existing.sourceIds.push(sourceId);
      }
      continue;
    }

    grouped.set(key, {
      code,
      name,
      ...vehicle,
      sourceIds: [sourceId],
    });
  }

  if (invalidRecordCount > 0) {
    throw new MinibusDataError(`Resmî minibüs listesinde ${invalidRecordCount} geçersiz kayıt bulundu.`);
  }

  if (raw.length > 0 && grouped.size === 0) {
    throw new MinibusDataError('Resmî minibüs listesindeki kayıt biçimi tanınmadı.');
  }

  const preparedLines = [...grouped.values()].map((line) => {
    line.sourceIds.sort((left, right) => left.localeCompare(right));
    return { line, baseSlug: officialLineSlug(`${line.code}-${line.name}`) };
  });
  const baseSlugCounts = new Map<string, number>();
  for (const { baseSlug } of preparedLines) {
    baseSlugCounts.set(baseSlug, (baseSlugCounts.get(baseSlug) ?? 0) + 1);
  }

  const lines = preparedLines.map(({ line, baseSlug }): MinibusLine => ({
    ...line,
    slug: (baseSlugCounts.get(baseSlug) ?? 0) > 1
      ? `${baseSlug}-${sourceIdSuffix(line.sourceIds[0]) || line.vehicleType}`
      : baseSlug,
  }));

  return lines.sort((left, right) => (
    left.code.localeCompare(right.code, 'tr', { numeric: true })
    || left.slug.localeCompare(right.slug, 'tr')
  ));
}

export async function loadMinibusLinesWithFallback(
  loadLive: () => Promise<MinibusLine[]>,
  snapshotPayload: unknown,
  onLiveError?: (error: unknown) => void,
): Promise<MinibusLine[]> {
  try {
    return await loadLive();
  } catch (error) {
    onLiveError?.(error);
    return parseMinibusLinesPayload(snapshotPayload);
  }
}

function finiteNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function textValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function clockValue(value: unknown): string | undefined {
  const text = textValue(value);
  const match = text?.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : undefined;
}

function intervalMinutes(value: unknown): number | undefined {
  const text = textValue(value);
  const match = text?.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return undefined;
  return Number(match[1]) * 60 + Number(match[2]) + Math.round(Number(match[3] ?? 0) / 60);
}

function operatingWindow(start: unknown, end: unknown, interval: unknown): MinibusOperatingWindow | undefined {
  const parsedStart = clockValue(start);
  const parsedEnd = clockValue(end);
  const parsedInterval = intervalMinutes(interval);
  if (!parsedStart || !parsedEnd || parsedInterval === undefined) return undefined;
  return { start: parsedStart, end: parsedEnd, intervalMinutes: parsedInterval };
}

export function parseMinibusDetailsPayload(payload: unknown): MinibusLineDetails {
  const raw = parseJsonBridge(payload);
  if (!raw || typeof raw !== 'object' || !('Result' in raw)) {
    throw new MinibusDataError('Resmî minibüs detay yanıtı beklenen biçimde değil.');
  }

  const result = (raw as { Result: unknown }).Result;
  if (!result || typeof result !== 'object') {
    throw new MinibusDataError('Resmî minibüs detay kaydı bulunamadı.');
  }

  const detail = result as Record<string, unknown>;
  const routeName = textValue(detail.Guzergah_Adi);
  if (!routeName) {
    throw new MinibusDataError('Resmî minibüs detayında güzergâh adı bulunamadı.');
  }

  return {
    routeName,
    lengthKm: finiteNumber(detail.Total_Length),
    durationMinutes: finiteNumber(detail.Total_Duration),
    sourceRouteId: textValue(detail.TUBS_ID),
    sourceObjectId: textValue(detail.Object_ID),
    weekday: operatingWindow(detail.WD_Start, detail.WD_End, detail.WD_Seq),
    weekend: operatingWindow(detail.WE_Start, detail.WE_End, detail.WE_Seq),
  };
}

export function parseMinibusRoutePayload(payload: unknown): MinibusRoutePoint[] {
  const raw = parseJsonBridge(payload);
  if (!raw || typeof raw !== 'object' || !('Result' in raw)) {
    throw new MinibusDataError('Resmî minibüs güzergâh yanıtı beklenen biçimde değil.');
  }

  const result = parseJsonString(
    (raw as { Result: unknown }).Result,
    'Resmî minibüs güzergâhı ayrıştırılamadı.',
  );
  if (!Array.isArray(result)) {
    throw new MinibusDataError('Resmî minibüs güzergâhı bir koordinat dizisi değil.');
  }

  return result.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new MinibusDataError('Resmî minibüs güzergâhında geçersiz koordinat bulundu.');
    }
    const candidate = item as { lat?: unknown; lng?: unknown };
    const lat = typeof candidate.lat === 'number' ? candidate.lat : Number.NaN;
    const lng = typeof candidate.lng === 'number' ? candidate.lng : Number.NaN;
    if (
      !Number.isFinite(lat)
      || !Number.isFinite(lng)
      || lat < -90
      || lat > 90
      || lng < -180
      || lng > 180
    ) {
      throw new MinibusDataError('Resmî minibüs güzergâhında geçersiz koordinat bulundu.');
    }
    return { lat, lng };
  });
}

function parseClockList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new MinibusDataError('Resmî minibüs sefer saatleri bir dizi değil.');
  }

  return value.map((item) => {
    if (typeof item !== 'string') {
      throw new MinibusDataError('Resmî minibüs çizelgesinde geçersiz sefer saati bulundu.');
    }
    const match = item.trim().match(/^(\d{1,2}):(\d{2})$/);
    const hour = match ? Number(match[1]) : Number.NaN;
    const minute = match ? Number(match[2]) : Number.NaN;
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) {
      throw new MinibusDataError('Resmî minibüs çizelgesinde geçersiz sefer saati bulundu.');
    }
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  });
}

export function parseMinibusSchedulePayload(payload: unknown): MinibusSchedule {
  const raw = parseJsonBridge(payload);
  if (!raw || typeof raw !== 'object') {
    throw new MinibusDataError('Resmî minibüs sefer çizelgesi beklenen biçimde değil.');
  }
  const schedule = raw as Record<string, unknown>;
  return {
    weekdayOutbound: parseClockList(schedule.WD_Gidis),
    weekdayReturn: parseClockList(schedule.WD_Donus),
    weekendOutbound: parseClockList(schedule.WE_Gidis),
    weekendReturn: parseClockList(schedule.WE_Donus),
  };
}

export function parseMinibusStopsPayload(payload: unknown): MinibusStop[] {
  const raw = parseJsonBridge(payload);
  if (!Array.isArray(raw)) {
    throw new MinibusDataError('Resmî minibüs durak listesi bir dizi değil.');
  }

  const seenIds = new Set<number>();
  const stops = raw.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new MinibusDataError('Resmî minibüs durak listesinde geçersiz durak bulundu.');
    }
    const candidate = item as { ID?: unknown; StopsName?: unknown };
    const id = typeof candidate.ID === 'number' ? candidate.ID : Number.NaN;
    const name = textValue(candidate.StopsName);
    if (!Number.isInteger(id) || id <= 0 || !name || seenIds.has(id)) {
      throw new MinibusDataError('Resmî minibüs durak listesinde geçersiz durak bulundu.');
    }
    seenIds.add(id);
    return { id, name };
  });

  return stops.sort((left, right) => left.id - right.id);
}

export function sameMinibusStops(left: MinibusStop[], right: MinibusStop[]): boolean {
  return left.length === right.length && left.every((stop, index) => (
    stop.id === right[index]?.id && stop.name === right[index]?.name
  ));
}

