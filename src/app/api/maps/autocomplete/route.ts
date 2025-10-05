import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const input = searchParams.get('input') || '';
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_KEY;
    if (!apiKey) return NextResponse.json({ predictions: [], error: 'Missing Google API key' }, { status: 500 });

    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', input);
    url.searchParams.set('language', 'tr');
    url.searchParams.set('types', 'geocode');
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString(), { next: { revalidate: 60 } });
    const data = await res.json();
    return NextResponse.json({ predictions: data?.predictions || [] });
  } catch {
    return NextResponse.json({ predictions: [] }, { status: 200 });
  }
}
