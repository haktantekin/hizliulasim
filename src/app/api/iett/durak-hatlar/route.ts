import { NextResponse } from 'next/server';
import { getHatlarByDurak } from '@/services/iett';

export const revalidate = 3600; // 1 hour cache

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

    const results = await getHatlarByDurak(durakKodu);

    return NextResponse.json(results);
  } catch (error) {
    console.error('IETT durak-hatlar API error:', error);
    return NextResponse.json(
      { error: 'Geçen hat bilgisi alınamadı' },
      { status: 500 }
    );
  }
}
