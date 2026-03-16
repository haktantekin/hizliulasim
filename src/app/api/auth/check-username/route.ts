import { NextRequest, NextResponse } from 'next/server';

const WP_API = process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp/v2', '') || 'https://cms.hizliulasim.com/wp-json';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username') || '';

  if (!username || !/^[a-z0-9.]{3,30}$/.test(username)) {
    return NextResponse.json({ available: false, message: 'Geçersiz kullanıcı adı formatı' });
  }

  try {
    const wpRes = await fetch(
      `${WP_API}/hizliulasim/v1/auth/check_username?username=${encodeURIComponent(username)}`,
      { cache: 'no-store' }
    );

    const data = await wpRes.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ available: false, message: 'Kontrol edilemedi' }, { status: 500 });
  }
}
