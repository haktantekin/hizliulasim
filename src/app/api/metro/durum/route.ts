import { NextResponse } from 'next/server';

export const revalidate = 300; // 5 min cache

const METRO_API = 'https://api.ibb.gov.tr/MetroIstanbul/api/MetroMobile/V2/GetServiceStatuses';

export async function GET() {
  try {
    const response = await fetch(METRO_API, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Metro Service Status API error: ${response.status}`);
    }

    const data = await response.json();
    const statuses = Array.isArray(data) ? data : data?.Data || data?.value || [];

    return NextResponse.json(statuses);
  } catch (error) {
    console.error('Metro Service Status API error:', error);
    return NextResponse.json(
      { error: 'Hizmet durumu bilgileri alınamadı' },
      { status: 500 }
    );
  }
}
