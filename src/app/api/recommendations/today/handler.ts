import { getTurkishCalendarContext } from '../../../../lib/recommendations/calendar.ts';
import type {
  DailyRecommendationsResponse,
  RecommendationLocation,
  RecommendationSource,
  WeatherContext,
} from '../../../../lib/recommendations/contracts.ts';
import { rankRecommendations } from '../../../../lib/recommendations/rank.ts';
import { canonicalizeRouteCoordinates } from '../../../../lib/transit/route-search-area.ts';

const ISTANBUL_CENTER: RecommendationLocation = { latitude: 41.0082, longitude: 28.9784 };

export interface DailyRecommendationsHandlerDeps {
  loadSource(): Promise<RecommendationSource | null>;
  loadWeather(location: RecommendationLocation): Promise<WeatherContext | null>;
  now?: () => Date;
}

function requestLocation(request: Request): RecommendationLocation | undefined {
  const params = new URL(request.url).searchParams;
  const latitudeValues = params.getAll('lat');
  const longitudeValues = params.getAll('lng');
  if (latitudeValues.length !== 1 || longitudeValues.length !== 1) return undefined;
  const latitude = Number(latitudeValues[0]);
  const longitude = Number(longitudeValues[0]);
  const pair = canonicalizeRouteCoordinates(latitude, longitude);
  return pair ? { latitude: pair[0], longitude: pair[1] } : undefined;
}

export function createDailyRecommendationsHandler(deps: DailyRecommendationsHandlerDeps) {
  return async function dailyRecommendationsHandler(request: Request): Promise<Response> {
    const location = requestLocation(request);
    const weatherLocation = location ?? ISTANBUL_CENTER;
    const now = deps.now?.() ?? new Date();
    const [sourceResult, weatherResult] = await Promise.allSettled([
      deps.loadSource(),
      deps.loadWeather(weatherLocation),
    ]);
    const source = sourceResult.status === 'fulfilled' ? sourceResult.value : null;
    const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : null;
    const calendar = getTurkishCalendarContext(now);
    const cards = source ? rankRecommendations({
      candidates: source.candidates,
      overrides: source.overrides,
      weather,
      calendar,
      ...(location ? { location } : {}),
      now,
    }) : [];
    const degradedSources: DailyRecommendationsResponse['degradedSources'] = [];
    if (!source) degradedSources.push('cms');
    if (!weather) degradedSources.push('weather');

    const payload: DailyRecommendationsResponse = {
      cards,
      context: {
        weather,
        calendarTags: calendar.calendarTags,
        locationApplied: Boolean(location),
      },
      freshness: {
        cms: source?.generatedAt ?? null,
        weather: weather?.observedAt ?? null,
      },
      degradedSources,
    };

    return Response.json(payload, {
      headers: {
        'Cache-Control': location
          ? 'private, max-age=60'
          : 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  };
}
