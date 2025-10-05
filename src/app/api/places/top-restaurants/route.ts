import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
  const city = searchParams.get('city') || 'İstanbul';
  const district = searchParams.get('district') || '';
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing Google API key' }, { status: 500 });
    }

  const query = district ? `restaurant in ${district} ${city}` : `restaurant in ${city}`;
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 7 } });
    const data = await res.json();
    interface PlaceResult {
      name?: string;
      rating?: number;
      user_ratings_total?: number;
      formatted_address?: string;
      place_id?: string;
      types?: string[];
      __score?: number;
    }
    const results: PlaceResult[] = Array.isArray(data?.results) ? data.results : [];

    const scored = results
      .filter((r) => typeof r.rating === 'number')
      .map((r) => ({
        ...r,
        __score: Number(r.rating) * (Math.log10((Number(r.user_ratings_total) || 0) + 1) + 1),
      }))
      .sort((a, b) => (b.__score || 0) - (a.__score || 0))
      .slice(0, 10)
      .map((r) => ({
        name: r.name,
        rating: r.rating,
        user_ratings_total: r.user_ratings_total,
        address: r.formatted_address,
        place_id: r.place_id,
        types: r.types,
      }));

    return NextResponse.json({ city, items: scored }, { status: 200 });
  } catch {
    return NextResponse.json({ city: 'İstanbul', items: [] }, { status: 200 });
  }
}
