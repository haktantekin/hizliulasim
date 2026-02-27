import { NextResponse } from 'next/server';
import { getHatOtoKonum } from '@/services/iett';

export const revalidate = 30; // 30 second cache for real-time data

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

    const konumlar = await getHatOtoKonum(hatKodu.toUpperCase());
    return NextResponse.json(konumlar);
  } catch (error) {
    console.error('IETT konum API error:', error);
    return NextResponse.json(
      { error: 'Araç konum bilgileri alınamadı' },
      { status: 500 }
    );
  }
}
