import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 3600; // 1 hour cache

const BASE_URL = 'https://api.ibb.gov.tr/MetroIstanbul/api/MetroMobile/V2';

export async function GET(request: NextRequest) {
  const hatId = request.nextUrl.searchParams.get('hatId');

  try {
    const url = hatId
      ? `${BASE_URL}/GetStationById/${hatId}`
      : `${BASE_URL}/GetStations`;

    const response = await fetch(url, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`Metro Stations API error: ${response.status}`);
    }

    const data = await response.json();
    const stations = Array.isArray(data) ? data : data?.Data || data?.value || [];

    return NextResponse.json(stations);
  } catch (error) {
    console.error('Metro Stations API error:', error);
    return NextResponse.json(
      { error: 'İstasyon bilgileri alınamadı' },
      { status: 500 }
    );
  }
}
