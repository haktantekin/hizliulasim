import { NextResponse } from 'next/server';

function stripHtml(html: string): string {
  return html
    .replace(/<div[^>]*>/gi, ' ')
    .replace(/<br\s*\/?>(\s*)/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function parseTransitStep(s: any) {
  const base = {
    instruction: stripHtml(s.html_instructions || ''),
    distance: s.distance?.text || '',
    duration: s.duration?.text || '',
    maneuver: s.maneuver || '',
    travelMode: (s.travel_mode || '').toLowerCase(),
  };

  const td = s.transit_details;
  if (!td) return base;

  return {
    ...base,
    transit: {
      line: td.line?.short_name || td.line?.name || '',
      lineName: td.line?.name || '',
      vehicleType: td.line?.vehicle?.type || '',
      vehicleIcon: td.line?.vehicle?.icon || '',
      color: td.line?.color || '',
      textColor: td.line?.text_color || '',
      departureStop: td.departure_stop?.name || '',
      arrivalStop: td.arrival_stop?.name || '',
      departureTime: td.departure_time?.text || '',
      arrivalTime: td.arrival_time?.text || '',
      numStops: td.num_stops || 0,
      agencyName: td.line?.agencies?.[0]?.name || '',
    },
  };
}

function parseRoute(route: any) {
  const leg = route?.legs?.[0];
  if (!leg) return null;

  const steps = (leg.steps || []).map((s: any) => parseTransitStep(s));

  return {
    summary: route.summary || '',
    distance: leg.distance?.text || '',
    duration: leg.duration?.text || '',
    departureTime: leg.departure_time?.text || '',
    arrivalTime: leg.arrival_time?.text || '',
    startAddress: leg.start_address || '',
    endAddress: leg.end_address || '',
    steps,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin') || '';
    const destination = searchParams.get('destination') || '';
    const mode = (searchParams.get('mode') || 'driving') as 'driving' | 'walking' | 'bicycling' | 'transit';
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Missing Google API key' }, { status: 500 });

    if (!destination) return NextResponse.json({ error: 'Missing destination' }, { status: 400 });
    if (!origin) {
      return NextResponse.json({ routes: [], status: 'MISSING_ORIGIN' }, { status: 200 });
    }

    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.set('origin', origin);
    url.searchParams.set('destination', destination);
    url.searchParams.set('mode', mode);
    url.searchParams.set('language', 'tr');
    url.searchParams.set('alternatives', mode === 'transit' ? 'true' : 'false');
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString(), { next: { revalidate: 30 } });
    const data = await res.json();

    const status: string = data?.status || '';
    const error_message: string | undefined = data?.error_message;

    if (status !== 'OK' || !data?.routes?.length) {
      return NextResponse.json({ routes: [], status, error_message }, { status: 200 });
    }

    // For transit mode, return all alternatives
    if (mode === 'transit') {
      const routes = data.routes.map(parseRoute).filter(Boolean);
      return NextResponse.json({ routes, status: 'OK', error_message });
    }

    // Legacy: single route for non-transit modes (backward compat)
    const route = parseRoute(data.routes[0]);
    if (!route) {
      return NextResponse.json({ routes: [], steps: [], summary: null, status, error_message }, { status: 200 });
    }

    return NextResponse.json({
      ...route,
      routes: [route],
      status: 'OK',
      error_message,
    });
  } catch {
    return NextResponse.json({ routes: [], steps: [] }, { status: 200 });
  }
}
