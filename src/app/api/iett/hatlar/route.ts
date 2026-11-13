import { NextResponse } from 'next/server';
import { getStaticHatlar, iettStaticResponseHeaders } from '@/services/iett-static';
import { iettStaticErrorResponse } from '../static-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const kod = searchParams.get('kod');

    const result = await getStaticHatlar({
      ...(kod === null ? {} : { code: kod }),
      ...(q === null ? {} : { query: q }),
    });
    return NextResponse.json(result.data, { headers: iettStaticResponseHeaders(result.metadata) });
  } catch (error) {
    const unavailable = iettStaticErrorResponse(error);
    if (unavailable) return unavailable;
    console.error('IETT hatlar API error:', error);
    return NextResponse.json(
      { error: 'IETT hat bilgileri alınamadı' },
      { status: 500 }
    );
  }
}
