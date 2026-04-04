import { NextRequest, NextResponse } from 'next/server';

const WP_API = process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp/v2', '') || 'https://cms.hizliulasim.com/wp-json';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '12';

    const wpRes = await fetch(
      `${WP_API}/hizliulasim/v1/bus-searches?limit=${encodeURIComponent(limit)}`,
      { next: { revalidate: 30 } }
    );

    const data = await wpRes.json();

    if (!wpRes.ok) {
      return NextResponse.json(
        { message: data?.message || 'Otobus arama gecmisi yuklenemedi' },
        { status: wpRes.status }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ message: 'Sunucu hatasi' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const payload = {
      hat_kodu: typeof body?.hatKodu === 'string' ? body.hatKodu : '',
      hat_adi: typeof body?.hatAdi === 'string' ? body.hatAdi : '',
    };

    const wpRes = await fetch(`${WP_API}/hizliulasim/v1/bus-searches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const data = await wpRes.json();

    if (!wpRes.ok) {
      return NextResponse.json(
        { message: data?.message || 'Otobus arama gecmisi kaydedilemedi' },
        { status: wpRes.status }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ message: 'Sunucu hatasi' }, { status: 500 });
  }
}
