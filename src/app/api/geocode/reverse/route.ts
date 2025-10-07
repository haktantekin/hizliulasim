import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Lat and lon required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=tr`,
      { 
        headers: { 
          'User-Agent': 'HizliUlasim/1.0',
          'Referer': 'https://hizliulasim.com'
        } 
      }
    );
    
    if (!res.ok) {
      throw new Error('Nominatim API failed');
    }

    const data = await res.json();
    const city = data.address?.province || data.address?.city || data.address?.town || 'İstanbul';
    
    return NextResponse.json({ city });
  } catch (error) {
    console.error('Reverse geocode error:', error);
    return NextResponse.json({ city: 'İstanbul' }, { status: 200 });
  }
}
