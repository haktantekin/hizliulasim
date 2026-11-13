import type { WeatherContext, WeatherTag } from './contracts.ts';

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const CURRENT_FIELDS = 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m';
const HOURLY_FIELDS = 'precipitation_probability';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function normalizeProviderTime(value: unknown, utcOffsetSeconds: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u.test(value)
    || !finiteNumber(utcOffsetSeconds, -43_200, 50_400)) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const utc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
    - utcOffsetSeconds * 1_000;
  const date = new Date(utc);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function isRainCode(code: number): boolean {
  return (code >= 51 && code <= 67)
    || (code >= 71 && code <= 77)
    || (code >= 80 && code <= 86)
    || (code >= 95 && code <= 99);
}

function classifyWeather(input: {
  temperatureC: number;
  apparentTemperatureC: number;
  precipitation: number;
  precipitationProbability: number;
  weatherCode: number;
  windSpeedKmh: number;
}): WeatherTag[] {
  const tags: WeatherTag[] = [];
  const rain = input.precipitation >= 0.1
    || input.precipitationProbability >= 50
    || isRainCode(input.weatherCode);
  if (rain) tags.push('rain');
  else if (input.weatherCode >= 0 && input.weatherCode <= 3) tags.push('clear');

  if (input.temperatureC >= 28 || input.apparentTemperatureC >= 30) tags.push('hot');
  else if (input.temperatureC <= 10 || input.apparentTemperatureC <= 8) tags.push('cold');

  if (input.windSpeedKmh >= 35) tags.push('windy');
  else if (input.windSpeedKmh <= 20) tags.push('wind_safe');
  return tags;
}

function weatherSummary(tags: WeatherTag[], weatherCode: number): string {
  if (weatherCode >= 71 && weatherCode <= 77) return 'Karlı';
  if (tags.includes('rain')) return 'Yağışlı';
  if (tags.includes('clear')) return 'Açık';
  if (tags.includes('windy')) return 'Rüzgârlı';
  return 'Bulutlu';
}

function parseWeatherPayload(value: unknown): WeatherContext | null {
  if (!isRecord(value) || !isRecord(value.current) || !isRecord(value.hourly)) return null;
  const current = value.current;
  const hourly = value.hourly;
  if (!finiteNumber(current.temperature_2m, -80, 70)
    || !finiteNumber(current.apparent_temperature, -100, 80)
    || !finiteNumber(current.precipitation, 0, 500)
    || !finiteNumber(current.weather_code, 0, 99)
    || !Number.isInteger(current.weather_code)
    || !finiteNumber(current.wind_speed_10m, 0, 400)
    || typeof current.time !== 'string'
    || !Array.isArray(hourly.time)
    || !Array.isArray(hourly.precipitation_probability)
    || hourly.time.length === 0
    || hourly.time.length !== hourly.precipitation_probability.length
    || !hourly.time.every((item) => typeof item === 'string')
    || !hourly.precipitation_probability.every((item) => finiteNumber(item, 0, 100))) return null;

  const currentHour = `${current.time.slice(0, 13)}:00`;
  const hourIndex = hourly.time.indexOf(currentHour);
  if (hourIndex < 0) return null;
  const observedAt = normalizeProviderTime(current.time, value.utc_offset_seconds);
  if (!observedAt) return null;
  const precipitationProbability = hourly.precipitation_probability[hourIndex] as number;
  const tags = classifyWeather({
    temperatureC: current.temperature_2m,
    apparentTemperatureC: current.apparent_temperature,
    precipitation: current.precipitation,
    precipitationProbability,
    weatherCode: current.weather_code,
    windSpeedKmh: current.wind_speed_10m,
  });

  return {
    tags,
    temperatureC: current.temperature_2m,
    apparentTemperatureC: current.apparent_temperature,
    precipitationProbability,
    windSpeedKmh: current.wind_speed_10m,
    summary: weatherSummary(tags, current.weather_code),
    observedAt,
  };
}

export async function fetchWeatherContext(input: {
  latitude: number;
  longitude: number;
  fetchImpl?: typeof fetch;
}): Promise<WeatherContext | null> {
  if (!finiteNumber(input.latitude, -90, 90) || !finiteNumber(input.longitude, -180, 180)) return null;
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = new URL(OPEN_METEO_FORECAST_URL);
  url.searchParams.set('latitude', String(input.latitude));
  url.searchParams.set('longitude', String(input.longitude));
  url.searchParams.set('current', CURRENT_FIELDS);
  url.searchParams.set('hourly', HOURLY_FIELDS);
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', 'Europe/Istanbul');

  try {
    const response = await fetchImpl(url, { next: { revalidate: 900 } });
    if (!response.ok) return null;
    return parseWeatherPayload(await response.json());
  } catch {
    return null;
  }
}
