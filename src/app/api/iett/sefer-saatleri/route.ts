import { NextResponse } from 'next/server';
import { getPlanlananSeferSaati } from '@/services/iett';

export const revalidate = 300;

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

    const seferler = await getPlanlananSeferSaati(hatKodu.toUpperCase());
    return NextResponse.json(seferler);
  } catch (error) {
    console.error('IETT sefer saatleri API error:', error);
    return NextResponse.json(
      { error: 'Sefer saatleri alınamadı' },
      { status: 500 }
    );
  }
}
