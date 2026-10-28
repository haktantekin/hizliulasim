import {
  loadMinibusLinesWithFallback,
  MinibusDataError,
  type MinibusCachedData,
  type MinibusLine,
} from '@/lib/minibusData';
import { loadMinibusDetailWithFallback } from '@/lib/minibusDetailFallback';
import {
  mergeMinibusDistrictCatalogs,
  parseMinibusCategoryInfoPayload,
  parseMinibusCachedLinePayload,
  parseMinibusEditorialLinesPayload,
  parseMinibusDirectoryPayload,
  toMinibusLineCatalog,
  type MinibusDistrict,
  type MinibusEditorialLine,
} from '@/lib/minibusDirectory';
import {
  findMinibusFareTariffByCode,
  type MinibusFareTariff,
} from '@/lib/minibusFare';
import { loadOfficialMinibusLineData } from '@/lib/minibusOfficialFallback';
import {
  fetchOfficialMinibusDetails,
  fetchOfficialMinibusRouteDirection,
  fetchOfficialMinibusSchedule,
  fetchVerifiedOfficialMinibusStops,
  type MinibusOfficialCarStatus,
} from '@/lib/minibusOfficialClient';
import minibusDistrictSnapshot from '@/data/minibus-districts.snapshot.json';
import minibusFareSnapshot from '@/data/minibus-fares.snapshot.json';
import minibusLinesSnapshot from '@/data/minibus-lines.snapshot.json';

const MINIBUS_SOURCE_URL = 'https://application2.ibb.gov.tr/tulasim/MinibusumNerede.aspx';
const MINIBUS_FARE_SOURCE_URL = 'https://application2.ibb.gov.tr/tulasim/ucrettarife.aspx';
const MINIBUS_DISTRICT_SOURCE_URL = 'https://sehirharitasiapi.ibb.gov.tr/';
const MINIBUS_DIRECTORY_VERIFIED_AT = minibusDistrictSnapshot.generatedAt;
const REVALIDATE_SECONDS = 3600;
const WORDPRESS_API_BASE_URL = process.env.NEXT_PUBLIC_WP_API_URL || 'https://cms.hizliulasim.com/wp-json/wp/v2';
const MINIBUS_DIRECTORY_URL = `${WORDPRESS_API_BASE_URL.replace(/\/wp\/v2\/?$/, '')}/hizliulasim/v1/minibus-directory`;
const MINIBUS_LINE_URL = `${WORDPRESS_API_BASE_URL.replace(/\/wp\/v2\/?$/, '')}/hizliulasim/v1/minibus-line`;
const WORDPRESS_CATEGORY_URL = `${WORDPRESS_API_BASE_URL.replace(/\/$/, '')}/categories`;

type MinibusFetch = (
  input: string | URL,
  init?: RequestInit & { next?: { revalidate: number } },
) => Promise<Response>;

function withMinibusCacheVersion(url: string): string {
  const bucket = Math.floor(Date.now() / (REVALIDATE_SECONDS * 1000));
  return `${url}${url.includes('?') ? '&' : '?'}v=${bucket}`;
}

export async function fetchMinibusLines(fetchImpl: MinibusFetch = fetch): Promise<MinibusLine[]> {
  return loadMinibusLinesWithFallback(
    async () => {
      const response = await fetchImpl(withMinibusCacheVersion(MINIBUS_DIRECTORY_URL), {
        headers: { Accept: 'application/json' },
        next: { revalidate: REVALIDATE_SECONDS },
      });
      if (!response.ok) {
        throw new MinibusDataError(`WordPress minibüs kataloğu HTTP ${response.status} döndürdü.`);
      }
      const lines = toMinibusLineCatalog(
        parseMinibusEditorialLinesPayload(await response.json() as unknown),
      );
      if (lines.length === 0) {
        throw new MinibusDataError('WordPress minibüs kataloğunda hat bulunamadı.');
      }
      return lines;
    },
    minibusLinesSnapshot.payload,
    (error) => {
      console.warn('WordPress minibüs kataloğu kullanılamadı; doğrulanmış liste snapshot kullanılıyor.', error);
    },
  );
}

export async function fetchMinibusDistricts(
  fetchImpl: MinibusFetch = fetch,
): Promise<MinibusDistrict[]> {
  const snapshot = parseMinibusDirectoryPayload(minibusDistrictSnapshot);
  try {
    const response = await fetchImpl(withMinibusCacheVersion(MINIBUS_DIRECTORY_URL), {
      headers: { Accept: 'application/json' },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      throw new MinibusDataError(`Minibüs ilçe kataloğu HTTP ${response.status} döndürdü.`);
    }
    const cms = parseMinibusDirectoryPayload(await response.json() as unknown);
    return mergeMinibusDistrictCatalogs(snapshot, cms);
  } catch (error) {
    console.warn('WordPress minibüs ilçe kataloğu kullanılamadı; doğrulanmış snapshot kullanılıyor.', error);
    return snapshot;
  }
}

export async function fetchMinibusEditorialLines(
  fetchImpl: MinibusFetch = fetch,
): Promise<MinibusEditorialLine[]> {
  try {
    const response = await fetchImpl(withMinibusCacheVersion(MINIBUS_DIRECTORY_URL), {
      headers: { Accept: 'application/json' },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      throw new MinibusDataError(`Minibüs editoryal hat kataloğu HTTP ${response.status} döndürdü.`);
    }
    return parseMinibusEditorialLinesPayload(await response.json() as unknown);
  } catch (error) {
    console.warn('WordPress minibüs editoryal hat kataloğu kullanılamadı; Bilgi sekmesi gizlenecek.', error);
    return [];
  }
}

export async function fetchMinibusCachedLine(
  slug: string,
  fetchImpl: MinibusFetch = fetch,
): Promise<MinibusEditorialLine | null> {
  try {
    const response = await fetchImpl(`${MINIBUS_LINE_URL}/${encodeURIComponent(slug)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new MinibusDataError(`Minibüs hat detayı HTTP ${response.status} döndürdü.`);
    }
    return parseMinibusCachedLinePayload(await response.json() as unknown);
  } catch (error) {
    console.warn(`${slug} WordPress minibüs hat detayı kullanılamadı.`, error);
    return null;
  }
}

export async function fetchOfficialMinibusLineData(
  line: MinibusLine,
  fetchImpl: MinibusFetch = fetch,
): Promise<MinibusCachedData> {
  const carStatus: MinibusOfficialCarStatus = line.vehicleType === 'minibus'
    ? 'MİNİBÜS'
    : 'TAKSİ DOLMUŞ';
  return loadOfficialMinibusLineData(line, {
    details: (sourceId) => fetchOfficialMinibusDetails(
      MINIBUS_SOURCE_URL,
      sourceId,
      fetchImpl,
    ),
    route: (sourceId, turningPoint) => fetchOfficialMinibusRouteDirection(
      MINIBUS_SOURCE_URL,
      sourceId,
      turningPoint,
      carStatus,
      fetchImpl,
    ),
    schedule: (sourceId) => fetchOfficialMinibusSchedule(
      MINIBUS_SOURCE_URL,
      sourceId,
      fetchImpl,
    ),
    stops: (sourceId) => fetchVerifiedOfficialMinibusStops(
      MINIBUS_SOURCE_URL,
      sourceId,
      carStatus,
      fetchImpl,
    ),
  });
}

export async function fetchMinibusLineDetail(
  line: MinibusLine,
  fetchImpl: MinibusFetch = fetch,
): Promise<{ cachedLine: MinibusEditorialLine | null; data: MinibusCachedData | null }> {
  const cachedLine = await fetchMinibusCachedLine(line.slug, fetchImpl);
  const cmsData = cachedLine?.data ?? line.cachedData ?? null;
  const data = await loadMinibusDetailWithFallback(
    cmsData,
    () => fetchOfficialMinibusLineData(line, fetchImpl),
    (error) => {
      console.warn(`${line.code} minibüs detayı CMS ve resmî API'den alınamadı.`, error);
    },
  );

  return { cachedLine, data };
}

export async function fetchMinibusCategoryInfoHtml(
  slug: string,
  fetchImpl: MinibusFetch = fetch,
): Promise<string> {
  try {
    const url = new URL(WORDPRESS_CATEGORY_URL);
    url.searchParams.set('slug', slug);
    url.searchParams.set('_fields', 'slug,description');
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      throw new MinibusDataError(`Minibüs kategori bilgisi HTTP ${response.status} döndürdü.`);
    }
    return parseMinibusCategoryInfoPayload(await response.json() as unknown, slug);
  } catch (error) {
    console.warn('WordPress minibüs kategori bilgisi kullanılamadı; Bilgi sekmesi gizlenecek.', error);
    return '';
  }
}

export async function fetchMinibusFareTariff(code: string): Promise<MinibusFareTariff | null> {
  const tariff = findMinibusFareTariffByCode(
    minibusFareSnapshot.tariffs as MinibusFareTariff[],
    code,
  );
  return tariff ? { ...tariff, verifiedAt: minibusFareSnapshot.generatedAt } : null;
}

export {
  MINIBUS_DIRECTORY_URL,
  MINIBUS_LINE_URL,
  MINIBUS_DIRECTORY_VERIFIED_AT,
  MINIBUS_DISTRICT_SOURCE_URL,
  MINIBUS_FARE_SOURCE_URL,
  MINIBUS_SOURCE_URL,
};

