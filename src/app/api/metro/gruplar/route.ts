import { NextResponse } from 'next/server';

export const revalidate = 3600; // 1 hour cache

const METRO_API = 'https://api.ibb.gov.tr/MetroIstanbul/api/MetroMobile/V2/GetRailwayGroups';

export async function GET() {
  try {
    const response = await fetch(METRO_API, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`Metro Groups API error: ${response.status}`);
    }

    const data = await response.json();
    const groups = Array.isArray(data) ? data : data?.Data || data?.value || [];

    return NextResponse.json(groups);
  } catch (error) {
    console.error('Metro Groups API error:', error);
    return NextResponse.json(
      { error: 'Raylı sistem grup bilgileri alınamadı' },
      { status: 500 }
    );
  }
}
