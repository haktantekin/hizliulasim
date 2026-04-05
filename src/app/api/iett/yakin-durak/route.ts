import { NextResponse } from 'next/server';
import { getDurakDetay } from '@/services/iett';

export const revalidate = 300;

type StopPoint = {
  DURAKKODU: string;
  DURAKADI: string;
  ILCEADI: string;
  YKOORDINATI: number;
  XKOORDINATI: number;
};

let cachedStopPoints: StopPoint[] | null = null;
let cachedAt = 0;
let pendingLoad: Promise<StopPoint[]> | null = null;
const STOPS_CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function loadAllStopPoints(): Promise<StopPoint[]> {
  const now = Date.now();
  if (cachedStopPoints && now - cachedAt < STOPS_CACHE_TTL_MS) {
    return cachedStopPoints;
  }

  if (pendingLoad) {
    return pendingLoad;
  }

  pendingLoad = (async () => {
    // Full-stop dataset can be large; allow longer timeout once, then cache in memory.
    const rawStops = await getDurakDetay('', 90000);

    const stopMap = new Map<string, StopPoint>();
    for (const stop of rawStops) {
      const code = (stop.DURAKKODU || '').trim();
      if (!code || stopMap.has(code)) continue;

      const lat = Number(stop.YKOORDINATI);
      const lng = Number(stop.XKOORDINATI);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      stopMap.set(code, {
        DURAKKODU: code,
        DURAKADI: stop.DURAKADI || 'Bilinmeyen Durak',
        ILCEADI: stop.ILCEADI || '',
        YKOORDINATI: lat,
        XKOORDINATI: lng,
      });
    }

    const deduped = Array.from(stopMap.values());
    cachedStopPoints = deduped;
    cachedAt = Date.now();
    return deduped;
  })();

  try {
    return await pendingLoad;
  } finally {
    pendingLoad = null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');

    if (!latStr || !lngStr) {
      return NextResponse.json(
        { error: 'lat ve lng parametreleri gerekli' },
        { status: 400 }
      );
    }

    const lat = Number(latStr);
    const lng = Number(lngStr);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { error: 'lat/lng gecersiz' },
        { status: 400 }
      );
    }

    const stops = await loadAllStopPoints();

    let nearest: {
      durakKodu: string;
      durakAdi: string;
      ilceAdi: string;
      lat: number;
      lng: number;
      distanceMeters: number;
    } | null = null;

    for (const stop of stops) {
      const stopLat = Number(stop.YKOORDINATI);
      const stopLng = Number(stop.XKOORDINATI);
      if (!Number.isFinite(stopLat) || !Number.isFinite(stopLng)) continue;

      const dist = haversineDistance(lat, lng, stopLat, stopLng);
      if (!nearest || dist < nearest.distanceMeters) {
        const durakKodu = stop.DURAKKODU;
        if (!durakKodu) continue;

        nearest = {
          durakKodu,
          durakAdi: stop.DURAKADI || 'Bilinmeyen Durak',
          ilceAdi: stop.ILCEADI || '',
          lat: stopLat,
          lng: stopLng,
          distanceMeters: dist,
        };
      }
    }

    if (!nearest) {
      return NextResponse.json(
        { error: 'Yakin durak bulunamadi' },
        { status: 404 }
      );
    }

    return NextResponse.json(nearest);
  } catch (error) {
    console.error('IETT yakin-durak API error:', error);
    return NextResponse.json(
      { error: 'Yakin durak hesaplanamadi' },
      { status: 500 }
    );
  }
}
