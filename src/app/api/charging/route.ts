import { NextRequest, NextResponse } from 'next/server';

export const revalidate = 300; // 5 min cache

const OCM_API = 'https://api.openchargemap.io/v3/poi/';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const distance = searchParams.get('distance') || '10';
  const maxresults = searchParams.get('maxresults') || '50';

  try {
    const params = new URLSearchParams({
      output: 'json',
      countrycode: 'TR',
      distance,
      distanceunit: 'KM',
      maxresults,
      compact: 'true',
      verbose: 'false',
    });

    const apiKey = process.env.OPENCHARGEMAP_API_KEY;
    if (apiKey) {
      params.set('key', apiKey);
    }

    if (lat && lng) {
      params.set('latitude', lat);
      params.set('longitude', lng);
    }

    const response = await fetch(`${OCM_API}?${params.toString()}`, {
      next: { revalidate: 300 },
      headers: {
        'User-Agent': 'HizliUlasim/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`OpenChargeMap API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('OpenChargeMap API error:', error);
    return NextResponse.json(
      { error: 'Şarj istasyonu bilgileri alınamadı' },
      { status: 500 }
    );
  }
}
