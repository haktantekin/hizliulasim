import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchWeatherContext } from './weather.ts';

const providerPayload = {
  utc_offset_seconds: 10800,
  current: {
    time: '2026-11-13T14:00',
    temperature_2m: 18.4,
    apparent_temperature: 17.2,
    precipitation: 0,
    weather_code: 1,
    wind_speed_10m: 12,
  },
  hourly: {
    time: ['2026-11-13T13:00', '2026-11-13T14:00', '2026-11-13T15:00'],
    precipitation_probability: [10, 20, 30],
  },
};

test('Open-Meteo yanıtını doğrular ve yalnız gerekli alanları ister', async (t) => {
  const fetchImpl = t.mock.fn<typeof fetch>(async () => Response.json(providerPayload));

  const weather = await fetchWeatherContext({ latitude: 41.0082, longitude: 28.9784, fetchImpl });

  assert.deepEqual(weather, {
    tags: ['clear', 'wind_safe'],
    temperatureC: 18.4,
    apparentTemperatureC: 17.2,
    precipitationProbability: 20,
    windSpeedKmh: 12,
    summary: 'Açık',
    observedAt: '2026-11-13T11:00:00.000Z',
  });
  const [requestedUrl, init] = fetchImpl.mock.calls[0].arguments;
  const url = new URL(String(requestedUrl));
  assert.equal(url.searchParams.get('timezone'), 'Europe/Istanbul');
  assert.equal(url.searchParams.get('current'), 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m');
  assert.equal(url.searchParams.get('hourly'), 'precipitation_probability');
  assert.deepEqual(init?.next, { revalidate: 900 });
});

test('yağış olasılığı, sıcaklık ve rüzgâr sınırlarını etiketler', async () => {
  const fetchImpl: typeof fetch = async () => Response.json({
    ...providerPayload,
    current: {
      ...providerPayload.current,
      temperature_2m: 30,
      apparent_temperature: 33,
      precipitation: 0.2,
      weather_code: 61,
      wind_speed_10m: 36,
    },
    hourly: {
      ...providerPayload.hourly,
      precipitation_probability: [30, 70, 60],
    },
  });

  const weather = await fetchWeatherContext({ latitude: 41, longitude: 29, fetchImpl });

  assert.deepEqual(weather?.tags, ['rain', 'hot', 'windy']);
  assert.equal(weather?.summary, 'Yağışlı');
});

test('15 dakikalık güncel zamanı aynı saat içindeki saatlik yağış olasılığıyla eşler', async () => {
  const fetchImpl: typeof fetch = async () => Response.json({
    ...providerPayload,
    current: { ...providerPayload.current, time: '2026-11-13T21:45' },
    hourly: {
      time: ['2026-11-13T20:00', '2026-11-13T21:00', '2026-11-13T22:00'],
      precipitation_probability: [10, 65, 20],
    },
  });

  const weather = await fetchWeatherContext({ latitude: 41, longitude: 29, fetchImpl });

  assert.equal(weather?.precipitationProbability, 65);
  assert.ok(weather?.tags.includes('rain'));
});

test('soğuk hava sınırını hissedilen sıcaklıkla da algılar', async () => {
  const fetchImpl: typeof fetch = async () => Response.json({
    ...providerPayload,
    current: { ...providerPayload.current, temperature_2m: 11, apparent_temperature: 7 },
  });

  const weather = await fetchWeatherContext({ latitude: 41, longitude: 29, fetchImpl });

  assert.ok(weather?.tags.includes('cold'));
});

test('saatlik diziler eşleşmiyorsa veya sayılar geçersizse hava puanını atlar', async () => {
  const mismatched: typeof fetch = async () => Response.json({
    ...providerPayload,
    hourly: { time: providerPayload.hourly.time, precipitation_probability: [10] },
  });
  const invalidNumber: typeof fetch = async () => Response.json({
    ...providerPayload,
    current: { ...providerPayload.current, temperature_2m: '18' },
  });

  assert.equal(await fetchWeatherContext({ latitude: 41, longitude: 29, fetchImpl: mismatched }), null);
  assert.equal(await fetchWeatherContext({ latitude: 41, longitude: 29, fetchImpl: invalidNumber }), null);
});

test('sağlayıcı hatası ve bozuk JSON ana yanıtı düşürmez', async () => {
  const providerError: typeof fetch = async () => Response.json({ reason: 'rate limited' }, { status: 429 });
  const malformed: typeof fetch = async () => new Response('{', { status: 200 });

  assert.equal(await fetchWeatherContext({ latitude: 41, longitude: 29, fetchImpl: providerError }), null);
  assert.equal(await fetchWeatherContext({ latitude: 41, longitude: 29, fetchImpl: malformed }), null);
});
