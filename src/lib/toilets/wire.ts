import { isRecord, parseToiletEnvelope, type Toilet, type ToiletEnvelope } from './contracts.ts';

type CompactToilet = Pick<Toilet, 'id' | 'name' | 'lat' | 'lng' | 'kind' | 'source'>
  & Partial<Omit<Toilet, 'id' | 'name' | 'lat' | 'lng' | 'kind' | 'source'>>;

export interface ToiletWireEnvelope extends Omit<ToiletEnvelope, 'toilets'> {
  encoding: 'compact-v1';
  toilets: CompactToilet[];
}

const defaults = {
  city: null,
  district: null,
  fee: 'unknown',
  access: 'unknown',
  wheelchair: 'unknown',
  openingHours: null,
  changingTable: 'unknown',
  status: 'unknown',
} as const;

function sourceUrl(source: unknown, id: unknown): string | undefined {
  if (typeof id !== 'string') return undefined;
  if (source === 'ibb' && id.startsWith('ibb:')) return 'https://data.ibb.gov.tr/dataset/sehir-tuvaletleri-veri-seti';
  if (source === 'osm') {
    const match = /^osm:(node|way|relation):([1-9][0-9]*)$/u.exec(id);
    if (match) return `https://www.openstreetmap.org/${match[1]}/${match[2]}`;
  }
  return undefined;
}

/** Omit repeated unknown/null values and reproducible source links on the wire only. */
export function encodeToiletEnvelope(data: ToiletEnvelope): ToiletWireEnvelope {
  return {
    ...data,
    encoding: 'compact-v1',
    toilets: data.toilets.map((toilet) => {
      const point: CompactToilet = {
        id: toilet.id, name: toilet.name, lat: toilet.lat, lng: toilet.lng,
        kind: toilet.kind, source: toilet.source,
      };
      for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
        if (toilet[key] !== defaults[key]) Object.assign(point, { [key]: toilet[key] });
      }
      if (toilet.sourceUrl !== sourceUrl(toilet.source, toilet.id)) point.sourceUrl = toilet.sourceUrl;
      return point;
    }),
  };
}

/** Accept both the compact public API and the original full envelope, restoring every field. */
export function decodeToiletEnvelope(value: unknown): ToiletEnvelope {
  if (!isRecord(value)) throw new TypeError('Invalid toilet response');
  let expanded: unknown = value;
  if (value.encoding !== undefined) {
    if (value.encoding !== 'compact-v1' || !Array.isArray(value.toilets) || value.toilets.length > 50_000) {
      throw new TypeError('Invalid toilet response encoding');
    }
    expanded = {
      ...value,
      toilets: value.toilets.map((entry: unknown) => {
        if (!isRecord(entry)) throw new TypeError('Invalid compact toilet record');
        return { ...defaults, sourceUrl: sourceUrl(entry.source, entry.id), ...entry };
      }),
    };
  }
  const parsed = parseToiletEnvelope(expanded);
  if (value.metadata !== undefined) {
    if (!isRecord(value.metadata) || typeof value.metadata.storage !== 'string'
      || value.metadata.storage !== 'database'
      || typeof value.metadata.stale !== 'boolean') throw new TypeError('Invalid toilet response metadata');
    parsed.metadata = {
      storage: value.metadata.storage, stale: value.metadata.stale,
    };
  }
  return parsed;
}
