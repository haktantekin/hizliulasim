import { parseRouteRequest, type TransitItinerary } from '../../../../lib/transit/contracts.ts';
import { buildItinerary } from '../../../../lib/transit/itinerary.ts';
import { DEFAULT_ROUTER_LIMITS, getStartupConnectionPaths, routeTransitSnapshot,
  type RouterLimits, type StopWalk } from '../../../../lib/transit/router.ts';
import { loadActiveSnapshotWithPreflight, TransitSnapshotError } from '../../../../lib/transit/snapshot-source.ts';
import { estimateWalk, findNearbyStops, getNearbyStopGridPaths, loadNearbyStopGrid,
  type NearbyStop } from '../../../../lib/transit/spatial.ts';

const errors = {
  INVALID_REQUEST: { status: 400, message: 'Konum, kalkış zamanı veya rota tercihi geçersiz.' },
  NO_ROUTE: { status: 404, message: 'Bu yolculuk için toplu taşıma rotası bulunamadı.' },
  DATA_UNAVAILABLE: { status: 503, message: 'Toplu taşıma verileri şu anda kullanılamıyor.' },
  ROUTE_TIMEOUT: { status: 504, message: 'Rota araması zaman veya işlem sınırına ulaştı.' },
} as const;

const MAX_ROUTE_REQUEST_BYTES = 1024;

type RouteErrorCode = keyof typeof errors;
type RouteOutcome = 'ok' | RouteErrorCode;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

function errorResponse(code: RouteErrorCode): Response {
  const { status, message } = errors[code];
  return json({ error: { code, message } }, status);
}

function stopWalk({ stop, distanceMeters }: NearbyStop): StopWalk {
  return { stopId: stop.stopId, distanceMeters, walkingSeconds: estimateWalk(distanceMeters).walkingSeconds };
}

interface RouteHandlerOptions {
  now?: () => Date;
  clock?: () => number;
  limits?: Partial<RouterLimits>;
  log?: (entry: object) => void;
}

export function createTransitRouteHandler({
  now = () => new Date(),
  clock = () => performance.now(),
  limits = {},
  log = (entry) => { process.stdout.write(`${JSON.stringify(entry)}\n`); },
}: RouteHandlerOptions = {}) {
  const wallTimeMs = limits.wallTimeMs === undefined ? DEFAULT_ROUTER_LIMITS.wallTimeMs : limits.wallTimeMs;
  const maxAlternatives = limits.maxAlternatives ?? DEFAULT_ROUTER_LIMITS.maxAlternatives;

  return async (request: Request): Promise<Response> => {
    const started = clock();
    const abort = new AbortController();
    const deadlineError = new Error('Transit request deadline exceeded');
    const expired = () => abort.signal.aborted || (wallTimeMs !== null && clock() - started >= wallTimeMs);
    const checkTime = () => {
      if (expired()) throw deadlineError;
    };
    const diagnostics = { connectionBuckets: 0, connectionShards: 0, transferShards: 0 };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let outcome: RouteOutcome = 'ok';
    let errorCode: string | undefined;
    let fallbackReason: string | undefined;
    let version: string | null = null;
    let usedFallback = false;
    let originCandidates = 0;
    let destinationCandidates = 0;
    let alternatives = 0;

    function fail(code: RouteErrorCode, reason: string = code) {
      outcome = code;
      errorCode = reason;
      return errorResponse(code);
    }

    async function run() {
      const requestedAt = now();
      let query: ReturnType<typeof parseRouteRequest>;
      try {
        const url = new URL(request.url);
        const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
        const declaredLength = request.headers.get('content-length');
        if (request.method !== 'POST' || url.search.length > 0 || contentType !== 'application/json'
          || (declaredLength !== null && (!/^\d+$/u.test(declaredLength)
            || Number(declaredLength) > MAX_ROUTE_REQUEST_BYTES))) {
          return fail('INVALID_REQUEST');
        }
        const text = await request.text();
        if (new TextEncoder().encode(text).byteLength > MAX_ROUTE_REQUEST_BYTES) {
          return fail('INVALID_REQUEST');
        }
        query = parseRouteRequest(JSON.parse(text), requestedAt);
      } catch {
        return fail('INVALID_REQUEST');
      }

      checkTime();
      const points = [query.origin, query.destination];
      const snapshot = await loadActiveSnapshotWithPreflight((manifest) => [
        ...getNearbyStopGridPaths(manifest, points).values(),
        ...getStartupConnectionPaths(manifest, query.departureAt, limits, checkTime),
      ], { checkTime, signal: abort.signal, connectionPreflight: 'compressed',
        onFallback: (reason) => { fallbackReason = reason; } });
      version = snapshot.version;
      usedFallback = snapshot.usedFallback;

      checkTime();
      const grid = await loadNearbyStopGrid(snapshot, points, checkTime);
      checkTime();
      const access = findNearbyStops(query.origin, grid, {}).map(stopWalk);
      const egress = findNearbyStops(query.destination, grid, {}).map(stopWalk);
      originCandidates = access.length;
      destinationCandidates = egress.length;
      checkTime();
      if (!access.length || !egress.length) return fail('NO_ROUTE');

      const result = await routeTransitSnapshot(snapshot, { ...query, access, egress, limits },
        { clock, checkTime, diagnostics });
      checkTime();
      if (result.status === 'budget-exceeded') return fail('ROUTE_TIMEOUT', result.budget);
      if (result.status === 'no-route') return fail('NO_ROUTE');

      const itineraries: TransitItinerary[] = [];
      for (const journey of result.journeys.slice(0, maxAlternatives)) {
        checkTime();
        itineraries.push(await buildItinerary(journey, snapshot, { now }));
      }
      checkTime();
      const response = json({ itineraries, metadata: { dataVersion: version, usedFallback },
        diagnostics: { ...diagnostics, originCandidates, destinationCandidates } });
      checkTime();
      alternatives = itineraries.length;
      return response;
    }

    try {
      if (wallTimeMs === null) return await run();
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          abort.abort();
          reject(deadlineError);
        }, wallTimeMs);
      });
      return await Promise.race([run(), timeout]);
    } catch (error) {
      if (error === deadlineError || expired()) return fail('ROUTE_TIMEOUT', 'timeout');
      if (error instanceof TransitSnapshotError) return fail('DATA_UNAVAILABLE', error.code);
      return fail('DATA_UNAVAILABLE', 'INTERNAL_ERROR');
    } finally {
      clearTimeout(timer);
      abort.abort();
      log({ event: 'transit_route', outcome, elapsedMs: Math.round(clock() - started), version, usedFallback,
        connectionShards: diagnostics.connectionShards, transferShards: diagnostics.transferShards,
        originCandidates, destinationCandidates, alternatives,
        ...(errorCode && { errorCode }), ...(fallbackReason && { fallbackReason }) });
    }
  };
}
