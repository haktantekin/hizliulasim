import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';
  const city = searchParams.get('city') || 'İstanbul';
  const type = searchParams.get('type') || '';
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
  }

  if (!query && !type) {
    return NextResponse.json({ error: 'q or type parameter is required' }, { status: 400 });
  }

  try {
    const searchQuery = query
      ? `${query} erişilebilir engelli dostu in ${city}`
      : `${type} in ${city}`;

    // Use Text Search to find places
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${apiKey}&language=tr`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' || !data.results) {
      return NextResponse.json({ places: [], total: 0 });
    }

    // Get place details with accessibility info for top results (max 10 to avoid quota)
    const topPlaces = data.results.slice(0, 10);
    const detailedPlaces = await Promise.all(
      topPlaces.map(async (place: any) => {
        try {
          const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=place_id,name,formatted_address,geometry,rating,user_ratings_total,wheelchair_accessible_entrance,types,photos&key=${apiKey}&language=tr`;
          const detailRes = await fetch(detailUrl);
          const detailData = await detailRes.json();

          const result = detailData.result || place;
          return {
            id: result.place_id || place.place_id,
            name: result.name || place.name,
            address: result.formatted_address || place.formatted_address,
            location: result.geometry?.location || place.geometry?.location,
            rating: result.rating || place.rating,
            ratingsCount: result.user_ratings_total || place.user_ratings_total,
            types: result.types || place.types || [],
            wheelchairAccessibleEntrance: result.wheelchair_accessible_entrance ?? null,
            photo: result.photos?.[0]
              ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${result.photos[0].photo_reference}&key=${apiKey}`
              : null,
            mapsUrl: `https://www.google.com/maps/place/?q=place_id:${result.place_id || place.place_id}`,
          };
        } catch {
          return {
            id: place.place_id,
            name: place.name,
            address: place.formatted_address,
            location: place.geometry?.location,
            rating: place.rating,
            ratingsCount: place.user_ratings_total,
            types: place.types || [],
            wheelchairAccessibleEntrance: null,
            photo: null,
            mapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          };
        }
      })
    );

    return NextResponse.json({
      places: detailedPlaces,
      total: detailedPlaces.length,
    });
  } catch (error) {
    console.error('Accessible places API error:', error);
    return NextResponse.json({ error: 'Mekan bilgisi alınamadı' }, { status: 500 });
  }
}
