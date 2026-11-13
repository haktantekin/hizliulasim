import { NextResponse } from 'next/server';
import { getStaticStop, iettStaticResponseHeaders } from '@/services/iett-static';
import { iettStaticErrorResponse } from '../static-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const kod = searchParams.get('kod');

    if (!kod) {
      return NextResponse.json(
        { error: 'kod parametresi gerekli' },
        { status: 400 }
      );
    }

    const result = await getStaticStop(kod);
    if (result.data === null) {
      return NextResponse.json(
        { error: 'Durak bulunamadı' },
        { status: 404, headers: iettStaticResponseHeaders(result.metadata) }
      );
    }

    return NextResponse.json(result.data, { headers: iettStaticResponseHeaders(result.metadata) });
  } catch (error) {
    const unavailable = iettStaticErrorResponse(error);
    if (unavailable) return unavailable;
    console.error('IETT durak API error:', error);
    return NextResponse.json(
      { error: 'Durak bilgisi alınamadı' },
      { status: 500 }
    );
  }
}
