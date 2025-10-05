import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const city = searchParams.get('city') || 'İstanbul';
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing Google API key' }, { status: 500 });
    }

    const query = `${q} in ${city}`.trim();
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch places' }, { status: 500 });
  }
}
