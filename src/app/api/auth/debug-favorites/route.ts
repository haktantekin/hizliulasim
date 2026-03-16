import { NextRequest, NextResponse } from 'next/server';

const WP_API = process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp/v2', '') || 'https://cms.hizliulasim.com/wp-json';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) {
    return NextResponse.json({ message: 'Oturum bulunamadı' }, { status: 401 });
  }

  try {
    const wpRes = await fetch(`${WP_API}/hizliulasim/v1/auth/debug-favorites`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    const data = await wpRes.json();
    return NextResponse.json(data, { status: wpRes.status });
  } catch {
    return NextResponse.json({ message: 'Sunucu hatası' }, { status: 500 });
  }
}
