import { NextRequest, NextResponse } from 'next/server';

const WP_API = process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp/v2', '') || 'https://cms.hizliulasim.com/wp-json';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) {
    return NextResponse.json({ message: 'Oturum bulunamadı' }, { status: 401 });
  }

  const wpRes = await fetch(`${WP_API}/hizliulasim/v1/user/favorites`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!wpRes.ok) {
    return NextResponse.json({ message: 'Favoriler alınamadı' }, { status: wpRes.status });
  }

  return NextResponse.json(await wpRes.json());
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) {
    return NextResponse.json({ message: 'Oturum bulunamadı' }, { status: 401 });
  }

  const body = await request.json();

  const wpRes = await fetch(`${WP_API}/hizliulasim/v1/user/favorites`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!wpRes.ok) {
    const err = await wpRes.json();
    return NextResponse.json({ message: err.message || 'Favori güncellenemedi' }, { status: wpRes.status });
  }

  return NextResponse.json(await wpRes.json());
}
