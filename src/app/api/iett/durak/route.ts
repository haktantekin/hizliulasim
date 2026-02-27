import { NextResponse } from 'next/server';
import { getDurak } from '@/services/iett';

export const revalidate = 3600; // 1 hour cache for stop data

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

    const duraklar = await getDurak(kod);
    if (duraklar.length === 0) {
      return NextResponse.json(
        { error: 'Durak bulunamadı' },
        { status: 404 }
      );
    }

    return NextResponse.json(duraklar[0]);
  } catch (error) {
    console.error('IETT durak API error:', error);
    return NextResponse.json(
      { error: 'Durak bilgisi alınamadı' },
      { status: 500 }
    );
  }
}
