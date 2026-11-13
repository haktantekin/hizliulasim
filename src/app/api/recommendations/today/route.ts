import { fetchRecommendationSource } from '../../../../lib/recommendations/source.ts';
import { fetchWeatherContext } from '../../../../lib/recommendations/weather.ts';
import { createDailyRecommendationsHandler } from './handler.ts';

export const runtime = 'nodejs';

export const GET = createDailyRecommendationsHandler({
  loadSource: () => fetchRecommendationSource(),
  loadWeather: (location) => fetchWeatherContext(location),
});
