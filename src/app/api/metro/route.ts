import { NextResponse } from 'next/server';

export const revalidate = 300; // 5 min cache

const METRO_API = 'https://api.ibb.gov.tr/MetroIstanbul/api/MetroMobile/V2/GetLines';

export async function GET() {
  try {
    const response = await fetch(METRO_API, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'HizliUlasim/1.0',
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.warn(`Metro API degraded response: ${response.status}`);
      return NextResponse.json([]);
    }

    const data = await response.json();
    const lines = Array.isArray(data) ? data : data?.Data || data?.value || [];

    return NextResponse.json(lines);
  } catch (error) {
    console.error('Metro Lines API error:', error);
    return NextResponse.json([]);
  }
}
