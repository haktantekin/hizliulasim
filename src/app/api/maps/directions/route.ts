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
      // Server cannot resolve "My Location"; require explicit origin for step-by-step directions
      return NextResponse.json({ steps: [], status: 'MISSING_ORIGIN' }, { status: 200 });
    }

    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', origin);
    url.searchParams.set('destination', destination);
    url.searchParams.set('mode', mode);
    url.searchParams.set('language', 'tr');
    url.searchParams.set('alternatives', 'false');
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString(), { next: { revalidate: 30 } });
    const data = await res.json();

    const status: string = data?.status || '';
    const error_message: string | undefined = data?.error_message;
    const route = status === 'OK' ? data?.routes?.[0] : undefined;
    const leg = route?.legs?.[0];
    if (!route || !leg) {
      return NextResponse.json({ steps: [], summary: null, status, error_message }, { status: 200 });
    }

    type GStep = { html_instructions?: string; distance?: { text?: string }; duration?: { text?: string }; maneuver?: string };
    const steps = (leg.steps || []).map((s: GStep) => ({
      instruction: stripHtml(s.html_instructions || ''),
      distance: s.distance?.text || '',
      duration: s.duration?.text || '',
      maneuver: s.maneuver || '',
    }));

    return NextResponse.json({
      summary: route.summary || '',
      distance: leg.distance?.text || '',
      duration: leg.duration?.text || '',
      steps,
      status: status || 'OK',
      error_message,
    });
  } catch {
    return NextResponse.json({ steps: [] }, { status: 200 });
  }
}
