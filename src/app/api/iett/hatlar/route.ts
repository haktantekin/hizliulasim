import { NextResponse } from 'next/server';
import { getHat, searchHatlar } from '@/services/iett';

export const revalidate = 300; // 5 min cache

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const kod = searchParams.get('kod');

    if (kod) {
      const hatlar = await getHat(kod.toUpperCase());
      return NextResponse.json(hatlar);
    }

    if (q) {
      const hatlar = await searchHatlar(q);
      return NextResponse.json(hatlar);
    }

    // Return all lines
    const hatlar = await getHat();
    return NextResponse.json(hatlar);
  } catch (error) {
    console.error('IETT hatlar API error:', error);
    return NextResponse.json(
      { error: 'IETT hat bilgileri alınamadı' },
      { status: 500 }
    );
  }
}
