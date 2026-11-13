import { NextResponse } from 'next/server';
import { getStaticSchedules, iettStaticResponseHeaders } from '@/services/iett-static';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const hatKodu = searchParams.get('hatKodu');

    if (!hatKodu) {
      return NextResponse.json(
        { error: 'hatKodu parametresi gerekli' },
        { status: 400 }
      );
    }

    const result = await getStaticSchedules(hatKodu);
    return NextResponse.json(result.data, { headers: iettStaticResponseHeaders(result.metadata) });
  } catch (error) {
    console.error('IETT sefer saatleri API error:', error);
    return NextResponse.json(
      { error: 'Sefer saatleri alınamadı' },
      { status: 500 }
    );
  }
}
