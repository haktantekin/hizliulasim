import { NextResponse } from 'next/server';

export const revalidate = 300; // 5 min cache

const METRO_API = 'https://api.ibb.gov.tr/MetroIstanbul/api/MetroMobile/V2/GetLines';

export async function GET() {
  try {
    const response = await fetch(METRO_API, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Metro API error: ${response.status}`);
    }

    const data = await response.json();
    const lines = Array.isArray(data) ? data : data?.Data || data?.value || [];

    return NextResponse.json(lines);
  } catch (error) {
    console.error('Metro Lines API error:', error);
    return NextResponse.json(
      { error: 'Raylı sistem hat bilgileri alınamadı' },
      { status: 500 }
    );
  }
}
