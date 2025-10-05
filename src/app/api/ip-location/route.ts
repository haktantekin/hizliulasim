import { NextResponse } from 'next/server';

// Server-side proxy for ip-api.com to avoid mixed content in browser
export async function GET() {
  try {
    // fields=city,regionName,country,lat,lon,status,message
    const res = await fetch('http://ip-api.com/json/?fields=status,message,city,regionName,country,lat,lon');
    const data = await res.json();
    if (data.status !== 'success') {
      return NextResponse.json({ city: 'İstanbul' }, { status: 200 });
    }
    return NextResponse.json({ city: data.city || 'İstanbul' }, { status: 200 });
  } catch {
    return NextResponse.json({ city: 'İstanbul' }, { status: 200 });
  }
}
