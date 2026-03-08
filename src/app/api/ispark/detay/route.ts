import { NextResponse } from 'next/server';
import type { ISPARKParkDetay } from '@/types/ispark';

export const revalidate = 300;

const ISPARK_DETAY_API = 'https://api.ibb.gov.tr/ispark/ParkDetay';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: 'Otopark ID gerekli' },
      { status: 400 }
    );
  }

  const parkId = parseInt(id, 10);
  if (isNaN(parkId)) {
    return NextResponse.json(
      { error: 'Geçersiz otopark ID' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`${ISPARK_DETAY_API}?id=${parkId}`, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`ISPARK API error: ${response.status}`);
    }

    const data = await response.json();
    const detay: ISPARKParkDetay | null = data.value?.[0] || null;

    if (!detay) {
      return NextResponse.json(
        { error: 'Otopark bulunamadı' },
        { status: 404 }
      );
    }

    return NextResponse.json(detay);
  } catch (error) {
    console.error('ISPARK detay API error:', error);
    return NextResponse.json(
      { error: 'Otopark detay bilgileri alınamadı' },
      { status: 500 }
    );
  }
}
