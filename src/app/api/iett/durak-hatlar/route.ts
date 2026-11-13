import { NextResponse } from 'next/server';
import { getStaticLinesByStop, iettStaticResponseHeaders } from '@/services/iett-static';
import { iettStaticErrorResponse } from '../static-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const durakKodu = searchParams.get('kod');

    if (!durakKodu) {
      return NextResponse.json(
        { error: 'kod parametresi gerekli' },
        { status: 400 }
      );
    }

    const result = await getStaticLinesByStop(durakKodu);
    return NextResponse.json(result.data, { headers: iettStaticResponseHeaders(result.metadata) });
  } catch (error) {
    const unavailable = iettStaticErrorResponse(error);
    if (unavailable) return unavailable;
    console.error('IETT durak-hatlar API error:', error);
    return NextResponse.json(
      { error: 'Geçen hat bilgisi alınamadı' },
      { status: 500 }
    );
  }
}
