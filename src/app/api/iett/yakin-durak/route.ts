import { NextResponse } from 'next/server';
import { getStaticNearestStop, iettStaticResponseHeaders } from '@/services/iett-static';
import { iettStaticErrorResponse } from '../static-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    const result = await getStaticNearestStop(lat, lng);
    if (!result.data) {
      return NextResponse.json(
        { error: 'Yakin durak bulunamadi' },
        { status: 404, headers: iettStaticResponseHeaders(result.metadata) }
      );
    }

    return NextResponse.json(result.data, { headers: iettStaticResponseHeaders(result.metadata) });
  } catch (error) {
    const unavailable = iettStaticErrorResponse(error);
    if (unavailable) return unavailable;
    console.error('IETT yakin-durak API error:', error);
    return NextResponse.json(
      { error: 'Yakin durak hesaplanamadi' },
      { status: 500 }
    );
  }
}
