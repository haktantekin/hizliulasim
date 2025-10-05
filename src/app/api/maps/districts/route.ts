import { NextResponse } from 'next/server';

// Returns list of districts (ilçeler) for a given city using Google Geocoding API.
// Fallback: returns a static list for Istanbul when API fails or quota is exceeded.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const city = (searchParams.get('city') || 'İstanbul').trim();
    const country = (searchParams.get('country') || 'TR').trim();
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_KEY;

    if (!apiKey) {
      return NextResponse.json({ city, districts: [], error: 'Missing Google API key' }, { status: 500 });
    }

    // 1) Geocode the city to get its place_id
  const geocodeUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  geocodeUrl.searchParams.set('address', `${city}, ${country}`);
    geocodeUrl.searchParams.set('language', 'tr');
  geocodeUrl.searchParams.set('region', 'tr');
    geocodeUrl.searchParams.set('key', apiKey);

    const geoRes = await fetch(geocodeUrl.toString(), { next: { revalidate: 86400 } });
    const geo = await geoRes.json();
    type GeocodeResult = { types?: string[]; geometry?: { bounds?: { northeast: { lat: number; lng: number }; southwest: { lat: number; lng: number } }; viewport?: { northeast: { lat: number; lng: number }; southwest: { lat: number; lng: number } } } };
    const cityResult = Array.isArray(geo?.results)
      ? (geo.results as GeocodeResult[]).find((r) => r.types?.includes('locality') || r.types?.includes('administrative_area_level_1'))
      : null;
    const cityBounds = cityResult?.geometry?.bounds || cityResult?.geometry?.viewport;

    // 2) Use Place Text Search to find candidates (best-effort)
    // Note: Google Places does not provide a direct "list districts for city" endpoint. This is heuristic.
    const normalizedCity = city.toLowerCase() === 'istanbul' ? 'İstanbul' : city;

    // Helper to page through Text Search results and run multiple query variants
    type PlaceTextSearchItem = { place_id?: string; name?: string };
    const gatherCandidates = async (
      queries: Array<{ q: string; lang: string }>
    ): Promise<{ ids: string[]; names: string[] }> => {
      const ids = new Set<string>();
      const names = new Set<string>();
      const addFrom = (items: PlaceTextSearchItem[]) => {
        for (const it of items || []) {
          if (it?.place_id) ids.add(String(it.place_id));
          if (it?.name) names.add(String(it.name));
        }
      };
      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
      for (const { q, lang } of queries) {
        let pageToken: string | undefined;
        let page = 0;
        do {
          const u = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
          u.searchParams.set('query', q);
          u.searchParams.set('language', lang);
          u.searchParams.set('region', 'tr');
          if (cityBounds) {
            const ne = cityBounds?.northeast;
            const sw = cityBounds?.southwest;
            if (ne && sw) {
              const lat = (ne.lat + sw.lat) / 2;
              const lng = (ne.lng + sw.lng) / 2;
              u.searchParams.set('location', `${lat},${lng}`);
              u.searchParams.set('radius', '30000');
            }
          }
          if (pageToken) u.searchParams.set('pagetoken', pageToken);
          u.searchParams.set('key', apiKey);
          const r = await fetch(u.toString(), { next: { revalidate: 86400 } });
          const j = await r.json();
          addFrom((j?.results || []) as PlaceTextSearchItem[]);
          pageToken = j?.next_page_token;
          page++;
          if (pageToken) await delay(1600); // next_page_token needs ~1.5s to activate
        } while (pageToken && page < 3);
      }
      return { ids: Array.from(ids), names: Array.from(names) };
    };

    const queryVariants = [
      { q: `${normalizedCity} ilçeleri`, lang: 'tr' },
      { q: `${normalizedCity} kaymakamlığı`, lang: 'tr' },
      { q: `${normalizedCity} ilçe`, lang: 'tr' },
      { q: `districts of ${city}`, lang: 'en' },
      { q: `${city} districts`, lang: 'en' },
    ];

  const { ids: placeIds, names: candidateNames } = await gatherCandidates(queryVariants);

    // Limit to avoid quota spikes
  const limitedIds = placeIds.slice(0, 30);

    // Helper to fetch details and extract administrative_area_level_2 (district)
    const fetchDetail = async (pid: string) => {
      const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      detailsUrl.searchParams.set('place_id', pid);
  detailsUrl.searchParams.set('fields', 'name,address_components');
  detailsUrl.searchParams.set('language', 'tr');
      detailsUrl.searchParams.set('key', apiKey);
      const r = await fetch(detailsUrl.toString(), { next: { revalidate: 86400 } });
      const j = await r.json();
      const comps: Array<{ long_name: string; short_name: string; types: string[] }> = j?.result?.address_components || [];
      // Prefer admin_level_2, fallback to sublocality_level_1 if any
      const admin2 = comps.find((c) => c.types?.includes('administrative_area_level_2'))?.long_name;
      const subloc1 = comps.find((c) => c.types?.includes('sublocality_level_1'))?.long_name;
      return admin2 || subloc1 || null;
    };

    // Concurrency limit of 5
    const results: (string | null)[] = [];
    for (let i = 0; i < limitedIds.length; i += 5) {
      const batch = limitedIds.slice(i, i + 5);
      const out = await Promise.all(batch.map((id) => fetchDetail(id)));
      results.push(...out);
    }

    const normalize = (s: string) =>
      s
        .normalize('NFD')
        .replace(/\p{Diacritic}+/gu, '')
        .toLowerCase();

    const cityNorm = normalize(city);

    let districts = Array.from(
      new Set(
        results
          .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
          .map((n) => n.trim())
      )
    );

    // Remove items equal to the city (e.g., Istanbul)
    districts = districts.filter((d) => normalize(d) !== cityNorm);

    // Heuristic fallback: parse names like "Beşiktaş Belediyesi", "Kadıköy İlçesi" -> use first token as district
    if (districts.length === 0 && candidateNames.length > 0) {
      const guesses = candidateNames
        .map((n) => n.replace(/\b(Belediyesi|İlçesi|Kaymakamlığı)\b/gi, '').trim())
        .map((n) => n.split(/\s+/)[0])
        .filter((s) => s && s.length > 2)
        .filter((s) => normalize(s) !== cityNorm);
      districts = Array.from(new Set(guesses));
    }

    // Sort alphabetically (locale-aware Turkish)
    districts.sort((a, b) => a.localeCompare(b, 'tr'));

    return NextResponse.json({ city, districts, source: 'google' });
  } catch {
    // On error, return empty to signal UI to handle gracefully
    return NextResponse.json({ city: 'unknown', districts: [], source: 'error' }, { status: 200 });
  }
}
