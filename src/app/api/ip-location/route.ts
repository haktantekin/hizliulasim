import { NextResponse } from 'next/server';

// Turkish city name mapping
const cityNameMap: Record<string, string> = {
  'Istanbul': 'İstanbul',
  'Ankara': 'Ankara',
  'Izmir': 'İzmir',
  'Bursa': 'Bursa',
  'Antalya': 'Antalya',
  'Adana': 'Adana',
  'Konya': 'Konya',
  'Gaziantep': 'Gaziantep',
  'Mersin': 'Mersin',
  'Kayseri': 'Kayseri',
};

// Server-side proxy for ip-api.com to avoid mixed content in browser
export async function GET() {
  try {
    const res = await fetch('http://ip-api.com/json/?fields=status,message,city,regionName,country,lat,lon');
    const data = await res.json();
    
    if (data.status !== 'success') {
      return NextResponse.json({ city: 'İstanbul' }, { status: 200 });
    }

    // Use regionName (province) for Turkey, fallback to city
    let cityName = data.regionName || data.city || 'İstanbul';
    
    // If we have a mapping, use it (fixes İ vs I issue)
    if (cityNameMap[cityName]) {
      cityName = cityNameMap[cityName];
    }
    
    return NextResponse.json({ 
      city: cityName,
      country: data.country,
      lat: data.lat,
      lon: data.lon 
    }, { status: 200 });
  } catch (err) {
    console.error('IP location error:', err);
    return NextResponse.json({ city: 'İstanbul' }, { status: 200 });
  }
}
