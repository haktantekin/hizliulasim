import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface Place {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  rating?: number;
  user_ratings_total?: number;
  types: string[];
}

// Calculate distance between two coordinates (Haversine formula)
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const district = searchParams.get('district');
  const city = searchParams.get('city') || 'İstanbul';
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_KEY;

  console.log('Attractions API called:', { district, city, hasApiKey: !!apiKey });

  if (!district) {
    return NextResponse.json({ error: 'District parameter is required' }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
  }

  try {
    // 1. Geocode the district to get coordinates using Nominatim (free, no API key needed)
    console.log('Geocoding:', district, city);
    
    const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(district + ', ' + city + ', Turkey')}&format=json&limit=1&accept-language=tr`;
    const geocodeRes = await fetch(geocodeUrl, {
      headers: {
        'User-Agent': 'HizliUlasim/1.0',
        'Referer': 'https://hizliulasim.com'
      }
    });
    const geocodeData = await geocodeRes.json();

    console.log('Geocode results:', geocodeData.length);

    if (!geocodeData || geocodeData.length === 0) {
      console.error('Geocode failed: No results');
      return NextResponse.json({ 
        error: 'District not found'
      }, { status: 404 });
    }

    const lat = parseFloat(geocodeData[0].lat);
    const lng = parseFloat(geocodeData[0].lon);

    console.log('Location found:', { lat, lng });

    // 2. Search for specific cultural/historical places (exclude hotels, restaurants, shops)
    // Use multiple searches for better results
    const searchTypes = [
      'tourist_attraction',
      'mosque',
      'church',
      'museum',
      'art_gallery',
      'synagogue',
      'historical_landmark'
    ];

    const allPlaces: Place[] = [];
    const seenPlaceIds = new Set<string>();

    // Search with each type and combine results
    for (const type of searchTypes) {
      const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&type=${type}&key=${apiKey}`;
      const placesRes = await fetch(placesUrl);
      const placesData = await placesRes.json();

      if (placesData.status === 'OK' && placesData.results) {
        for (const place of placesData.results) {
          // Filter out places that ONLY have point_of_interest and establishment types
          const isOnlyGeneric = place.types?.every((t: string) => 
            t === 'point_of_interest' || t === 'establishment'
          );

          // Filter out hotels, restaurants, shops, cafes, parking, health facilities
          const hasUnwantedType = place.types?.some((t: string) => 
            t.includes('lodging') || 
            t.includes('hotel') || 
            t.includes('restaurant') || 
            t.includes('food') || 
            t.includes('cafe') || 
            t.includes('store') || 
            t.includes('shop') || 
            t.includes('mall') ||
            t.includes('parking') ||
            t.includes('health') ||
            t.includes('hospital') ||
            t.includes('pharmacy') ||
            t.includes('doctor')
          );

          // Also filter out places with low ratings (below 3.5)
          const hasLowRating = place.rating && place.rating < 3.5;

          if (!isOnlyGeneric && !hasUnwantedType && !hasLowRating && !seenPlaceIds.has(place.place_id)) {
            seenPlaceIds.add(place.place_id);
            allPlaces.push(place);
          }
        }
      }
    }

    console.log('Total unique places found:', allPlaces.length);

    // 3. Process and sort results by distance
    const places = allPlaces.map((place: Place) => {
      const distance = getDistance(
        lat,
        lng,
        place.geometry.location.lat,
        place.geometry.location.lng
      );

      return {
        id: place.place_id,
        name: place.name,
        address: place.formatted_address,
        location: place.geometry.location,
        distance: Math.round(distance * 100) / 100, // Round to 2 decimals
        photo: place.photos?.[0]
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${place.photos[0].photo_reference}&key=${apiKey}`
          : null,
        rating: place.rating,
        ratingsCount: place.user_ratings_total,
        types: place.types,
        mapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
      };
    });

    // Sort by distance (closest first) for route optimization
    places.sort((a: { distance: number }, b: { distance: number }) => a.distance - b.distance);

    console.log('Returning', places.length, 'places');

    // Create route suggestions (grouped by proximity)
    const routeSteps = places.slice(0, 15).map((place, index) => ({
      ...place,
      step: index + 1,
      estimatedDuration: index === 0 ? '30-45 dk' : '20-30 dk', // First place longer visit
    }));

    return NextResponse.json({
      district,
      city,
      center: { lat, lng },
      places: places.slice(0, 20), // All places
      route: routeSteps, // Optimized route
      totalDistance: routeSteps.reduce((sum, p) => sum + p.distance, 0).toFixed(2),
    });

  } catch (error) {
    console.error('Attractions API error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}
