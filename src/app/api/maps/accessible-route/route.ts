import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const origin = searchParams.get('origin') || '';
  const destination = searchParams.get('destination') || '';
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Google API key not configured' }, { status: 500 });
  }

  if (!origin || !destination) {
    return NextResponse.json({ error: 'origin and destination are required' }, { status: 400 });
  }

  try {
    // Use transit mode with less_walking preference for wheelchair users
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=transit&transit_routing_preference=less_walking&language=tr&alternatives=true&key=${apiKey}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' || !data.routes?.length) {
      // Fallback to walking directions
      const walkUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=walking&language=tr&key=${apiKey}`;
      const walkRes = await fetch(walkUrl);
      const walkData = await walkRes.json();

      if (walkData.status !== 'OK' || !walkData.routes?.length) {
        return NextResponse.json({ error: 'Rota bulunamadı' }, { status: 404 });
      }

      const route = walkData.routes[0];
      const leg = route.legs[0];

      return NextResponse.json({
        summary: 'Yaya rotası',
        distance: leg.distance?.text || '',
        duration: leg.duration?.text || '',
        steps: (leg.steps || []).map((s: any) => ({
          instruction: s.html_instructions || '',
          distance: s.distance?.text || '',
          duration: s.duration?.text || '',
          travelMode: s.travel_mode || 'WALKING',
        })),
        mapUrl: `https://www.google.com/maps?output=embed&dirflg=w&saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(destination)}`,
      });
    }

    // Pick the route with least walking
    const route = data.routes.reduce((best: any, current: any) => {
      const bestWalk = (best.legs?.[0]?.steps || [])
        .filter((s: any) => s.travel_mode === 'WALKING')
        .reduce((sum: number, s: any) => sum + (s.distance?.value || 0), 0);
      const currentWalk = (current.legs?.[0]?.steps || [])
        .filter((s: any) => s.travel_mode === 'WALKING')
        .reduce((sum: number, s: any) => sum + (s.distance?.value || 0), 0);
      return currentWalk < bestWalk ? current : best;
    }, data.routes[0]);

    const leg = route.legs[0];

    return NextResponse.json({
      summary: route.summary || 'Toplu taşıma rotası (az yürüme)',
      distance: leg.distance?.text || '',
      duration: leg.duration?.text || '',
      steps: (leg.steps || []).map((s: any) => ({
        instruction: s.html_instructions || '',
        distance: s.distance?.text || '',
        duration: s.duration?.text || '',
        travelMode: s.travel_mode || 'TRANSIT',
        transitDetails: s.transit_details
          ? {
              lineName: s.transit_details.line?.short_name || s.transit_details.line?.name || '',
              vehicleType: s.transit_details.line?.vehicle?.type || '',
              departureStop: s.transit_details.departure_stop?.name || '',
              arrivalStop: s.transit_details.arrival_stop?.name || '',
              numStops: s.transit_details.num_stops || 0,
            }
          : undefined,
      })),
      mapUrl: `https://www.google.com/maps?output=embed&dirflg=r&saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(destination)}`,
    });
  } catch (error) {
    console.error('Accessible route API error:', error);
    return NextResponse.json({ error: 'Rota hesaplanamadı' }, { status: 500 });
  }
}
