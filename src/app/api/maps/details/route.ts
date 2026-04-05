import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get('place_id') || '';
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Missing Google API key' }, { status: 500 });
    if (!placeId) return NextResponse.json({ error: 'Missing place_id' }, { status: 400 });

    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', 'geometry,name,formatted_address');
    url.searchParams.set('language', 'tr');
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
    const data = await res.json();

    if (data?.status !== 'OK' || !data?.result) {
      return NextResponse.json({ error: data?.status || 'UNKNOWN_ERROR' }, { status: 200 });
    }

    const r = data.result;
    return NextResponse.json({
      name: r.name || '',
      address: r.formatted_address || '',
      lat: r.geometry?.location?.lat,
      lng: r.geometry?.location?.lng,
    });
  } catch {
    return NextResponse.json({ error: 'FETCH_ERROR' }, { status: 500 });
  }
}
