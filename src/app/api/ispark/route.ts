import { NextResponse } from 'next/server';
import type { ISPARKPark } from '@/types/ispark';

export const revalidate = 300; // 5 min cache

const ISPARK_API = 'https://api.ibb.gov.tr/ispark/Park';

export async function GET() {
  try {
    const response = await fetch(ISPARK_API, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`ISPARK API error: ${response.status}`);
    }

    const data = await response.json();
    const parks: ISPARKPark[] = data.value || data || [];

    return NextResponse.json(parks);
  } catch (error) {
    console.error('ISPARK API error:', error);
    return NextResponse.json(
      { error: 'Otopark bilgileri alınamadı' },
      { status: 500 }
    );
  }
}
