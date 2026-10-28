import {
  MinibusDataError,
  parseMinibusDetailsPayload,
  parseMinibusLinesPayload,
  type MinibusLine,
  type MinibusLineDetails,
  type MinibusRoutePoint,
  type MinibusSchedule,
  type MinibusStop,
} from '@/lib/minibusData';
import {
  fetchOfficialMinibusRouteDirection,
  fetchOfficialMinibusSchedule,
  fetchVerifiedOfficialMinibusStops,
  type MinibusOfficialCarStatus,
} from '@/lib/minibusOfficialClient';
import {
  mergeMinibusDistrictCatalogs,
  parseMinibusDirectoryPayload,
  type MinibusDistrict,
} from '@/lib/minibusDirectory';
import {
  findMinibusFareTariffByCode,
  type MinibusFareTariff,
} from '@/lib/minibusFare';
import minibusDistrictSnapshot from '@/data/minibus-districts.snapshot.json';
import minibusFareSnapshot from '@/data/minibus-fares.snapshot.json';

const MINIBUS_SOURCE_URL = 'https://application2.ibb.gov.tr/tulasim/MinibusumNerede.aspx';
const MINIBUS_FARE_SOURCE_URL = 'https://application2.ibb.gov.tr/tulasim/ucrettarife.aspx';
const MINIBUS_DISTRICT_SOURCE_URL = 'https://sehirharitasiapi.ibb.gov.tr/';
const MINIBUS_DIRECTORY_VERIFIED_AT = minibusDistrictSnapshot.generatedAt;
const REVALIDATE_SECONDS = 3600;
const WORDPRESS_API_BASE_URL = process.env.NEXT_PUBLIC_WP_API_URL || 'https://cms.hizliulasim.com/wp-json/wp/v2';
const MINIBUS_DIRECTORY_URL = `${WORDPRESS_API_BASE_URL.replace(/\/wp\/v2\/?$/, '')}/hizliulasim/v1/minibus-directory`;

type MinibusFetch = (
  input: string | URL,
  init?: RequestInit & { next?: { revalidate: number } },
) => Promise<Response>;

async function postOfficialEndpoint(
  method: string,
  body: Record<string, string>,
  fetchImpl: MinibusFetch,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(`${MINIBUS_SOURCE_URL}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      next: { revalidate: REVALIDATE_SECONDS },
    });
  } catch (error) {
    throw new MinibusDataError('Resmî minibüs kaynağına ulaşılamadı.', { cause: error });
  }

  if (!response.ok) {
    throw new MinibusDataError(`Resmî minibüs kaynağı HTTP ${response.status} döndürdü.`);
  }

  try {
    return await response.json() as unknown;
  } catch (error) {
    throw new MinibusDataError('Resmî minibüs kaynağı geçersiz JSON döndürdü.', { cause: error });
  }
}

export async function fetchMinibusLines(fetchImpl: MinibusFetch = fetch): Promise<MinibusLine[]> {
  const payload = await postOfficialEndpoint('FillDropdown', {}, fetchImpl);
  return parseMinibusLinesPayload(payload);
}

export async function fetchMinibusLineDetails(
  sourceId: string,
  fetchImpl: MinibusFetch = fetch,
): Promise<MinibusLineDetails> {
  const payload = await postOfficialEndpoint(
    'FindTheMinibusDetails',
    { Global_ID: sourceId },
    fetchImpl,
  );
  return parseMinibusDetailsPayload(payload);
}

export async function fetchMinibusRouteDirection(
  sourceId: string,
  turningPoint: 1 | 2,
  carStatus: MinibusOfficialCarStatus,
  fetchImpl: MinibusFetch = fetch,
): Promise<MinibusRoutePoint[]> {
  return fetchOfficialMinibusRouteDirection(
    MINIBUS_SOURCE_URL,
    sourceId,
    turningPoint,
    carStatus,
    fetchImpl,
  );
}

export async function fetchMinibusSchedule(
  sourceId: string,
  fetchImpl: MinibusFetch = fetch,
): Promise<MinibusSchedule> {
  return fetchOfficialMinibusSchedule(MINIBUS_SOURCE_URL, sourceId, fetchImpl);
}

export async function fetchVerifiedMinibusStops(
  sourceId: string,
  carStatus: MinibusOfficialCarStatus,
  fetchImpl: MinibusFetch = fetch,
): Promise<{ verified: boolean; stops: MinibusStop[] }> {
  return fetchVerifiedOfficialMinibusStops(
    MINIBUS_SOURCE_URL,
    sourceId,
    carStatus,
    fetchImpl,
  );
}

export async function fetchMinibusDistricts(
  fetchImpl: MinibusFetch = fetch,
): Promise<MinibusDistrict[]> {
  const snapshot = parseMinibusDirectoryPayload(minibusDistrictSnapshot);
  try {
    const response = await fetchImpl(MINIBUS_DIRECTORY_URL, {
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

export async function fetchMinibusFareTariff(code: string): Promise<MinibusFareTariff | null> {
  const tariff = findMinibusFareTariffByCode(
    minibusFareSnapshot.tariffs as MinibusFareTariff[],
    code,
  );
  return tariff ? { ...tariff, verifiedAt: minibusFareSnapshot.generatedAt } : null;
}

export {
  MINIBUS_DIRECTORY_URL,
  MINIBUS_DIRECTORY_VERIFIED_AT,
  MINIBUS_DISTRICT_SOURCE_URL,
  MINIBUS_FARE_SOURCE_URL,
  MINIBUS_SOURCE_URL,
};

