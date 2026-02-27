import { NextResponse } from 'next/server';
import { getDurakDetay } from '@/services/iett';

export const revalidate = 3600; // 1 hour cache

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

    const duraklar = await getDurakDetay(hatKodu.toUpperCase());
    return NextResponse.json(duraklar);
  } catch (error) {
    console.error('IETT durak detay API error:', error);
    return NextResponse.json(
      { error: 'Durak bilgileri alınamadı' },
      { status: 500 }
    );
  }
}
