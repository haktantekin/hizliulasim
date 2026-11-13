import { NextResponse } from 'next/server';
import { getStaticRouteStops, iettStaticResponseHeaders } from '@/services/iett-static';
import { iettStaticErrorResponse } from '../static-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const hatKodu = searchParams.get('hatKodu');

    if (!hatKodu) {
      return NextResponse.json(
        { error: 'hatKodu parametresi gereklidir' },
        { status: 400 }
      );
    }

    const result = await getStaticRouteStops(hatKodu);
    return NextResponse.json(result.data, { headers: iettStaticResponseHeaders(result.metadata) });
  } catch (error) {
    const unavailable = iettStaticErrorResponse(error);
    if (unavailable) return unavailable;
    console.error('IETT durak detay API error:', error);
    return NextResponse.json(
      { error: 'Durak bilgileri alınamadı' },
      { status: 500 }
    );
  }
}
