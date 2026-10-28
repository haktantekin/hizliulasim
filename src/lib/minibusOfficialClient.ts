import {
  MinibusDataError,
  parseMinibusRoutePayload,
  parseMinibusSchedulePayload,
  parseMinibusStopsPayload,
  sameMinibusStops,
  type MinibusRoutePoint,
  type MinibusSchedule,
  type MinibusStop,
} from './minibusData.ts';

export type MinibusOfficialCarStatus = 'MİNİBÜS' | 'TAKSİ DOLMUŞ';

export type MinibusOfficialFetch = (
  input: string | URL,
  init?: RequestInit & { next?: { revalidate: number } },
) => Promise<Response>;

type OfficialResponse = {
  payload: unknown;
  cookieHeader: string | null;
};

const OFFICIAL_REQUEST_TIMEOUT_MS = 6000;
const STOP_VERIFICATION_TIMEOUT_MS = 6000;

function officialTimeoutError(): MinibusDataError {
  return new MinibusDataError('Resmî minibüs isteği zaman aşımına uğradı.');
}

function cookieHeaderFromResponse(headers: Headers): string | null {
  const raw = headers.get('set-cookie');
  if (!raw) return null;

  const cookies = raw
    .split(/,(?=\s*[^;\s,]+=)/)
    .map((cookie) => cookie.split(';', 1)[0]?.trim())
    .filter((cookie): cookie is string => Boolean(cookie));
  return cookies.length > 0 ? cookies.join('; ') : null;
}

async function postOfficial(
  baseUrl: string,
  method: string,
  body: Record<string, string>,
  fetchImpl: MinibusOfficialFetch,
  options: { stateful?: boolean; cookie?: string | null; timeoutMs?: number } = {},
): Promise<OfficialResponse> {
  let response: Response;
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? OFFICIAL_REQUEST_TIMEOUT_MS;
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    response = await Promise.race([
      fetchImpl(`${baseUrl}/${method}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          ...(options.cookie ? { Cookie: options.cookie } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        ...(options.stateful
          ? { cache: 'no-store' }
          : { next: { revalidate: 3600 } }),
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
          reject(officialTimeoutError());
        }, Math.max(1, timeoutMs));
      }),
    ]);
  } catch (error) {
    if (timedOut || (error instanceof MinibusDataError && /zaman aşımına uğradı/.test(error.message))) {
      throw officialTimeoutError();
    }
    throw new MinibusDataError('Resmî minibüs kaynağına ulaşılamadı.', { cause: error });
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!response.ok) {
    throw new MinibusDataError(`Resmî minibüs kaynağı HTTP ${response.status} döndürdü.`);
  }

  try {
    return {
      payload: await response.json() as unknown,
      cookieHeader: cookieHeaderFromResponse(response.headers),
    };
  } catch (error) {
    throw new MinibusDataError('Resmî minibüs kaynağı geçersiz JSON döndürdü.', { cause: error });
  }
}

export async function fetchOfficialMinibusRouteDirection(
  baseUrl: string,
  sourceId: string,
  turningPoint: 1 | 2,
  carStatus: MinibusOfficialCarStatus,
  fetchImpl: MinibusOfficialFetch = fetch,
  timeoutMs: number = OFFICIAL_REQUEST_TIMEOUT_MS,
): Promise<MinibusRoutePoint[]> {
  const { payload } = await postOfficial(
    baseUrl,
    'FindTheGuzergahAsync',
    {
      Global_ID: sourceId,
      Turning_Point: String(turningPoint),
      CarStatus: carStatus,
    },
    fetchImpl,
    { timeoutMs },
  );
  return parseMinibusRoutePayload(payload);
}

export async function fetchOfficialMinibusSchedule(
  baseUrl: string,
  sourceId: string,
  fetchImpl: MinibusOfficialFetch = fetch,
  timeoutMs: number = OFFICIAL_REQUEST_TIMEOUT_MS,
): Promise<MinibusSchedule> {
  const { payload } = await postOfficial(
    baseUrl,
    'FullListAsync',
    { Global_ID: sourceId },
    fetchImpl,
    { timeoutMs },
  );
  return parseMinibusSchedulePayload(payload);
}

async function readStatefulStops(
  baseUrl: string,
  sourceId: string,
  carStatus: MinibusOfficialCarStatus,
  fetchImpl: MinibusOfficialFetch,
  deadlineAt: number,
): Promise<MinibusStop[]> {
  const remainingMs = () => {
    const value = deadlineAt - Date.now();
    if (value <= 0) throw officialTimeoutError();
    return value;
  };
  const routeResponse = await postOfficial(
    baseUrl,
    'FindTheGuzergahAsync',
    {
      Global_ID: sourceId,
      Turning_Point: '1',
      CarStatus: carStatus,
    },
    fetchImpl,
    { stateful: true, timeoutMs: remainingMs() },
  );
  parseMinibusRoutePayload(routeResponse.payload);

  const stopsResponse = await postOfficial(
    baseUrl,
    'FindTheStops',
    {},
    fetchImpl,
    { stateful: true, cookie: routeResponse.cookieHeader, timeoutMs: remainingMs() },
  );
  return parseMinibusStopsPayload(stopsResponse.payload);
}

export async function fetchVerifiedOfficialMinibusStops(
  baseUrl: string,
  sourceId: string,
  carStatus: MinibusOfficialCarStatus,
  fetchImpl: MinibusOfficialFetch = fetch,
  timeoutMs: number = STOP_VERIFICATION_TIMEOUT_MS,
): Promise<{ verified: boolean; stops: MinibusStop[] }> {
  const deadlineAt = Date.now() + timeoutMs;
  const first = await readStatefulStops(baseUrl, sourceId, carStatus, fetchImpl, deadlineAt);
  const second = await readStatefulStops(baseUrl, sourceId, carStatus, fetchImpl, deadlineAt);
  return sameMinibusStops(first, second)
    ? { verified: true, stops: first }
    : { verified: false, stops: [] };
}
