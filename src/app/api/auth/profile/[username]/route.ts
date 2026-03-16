import { NextRequest, NextResponse } from 'next/server';

const WP_API = process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp/v2', '') || 'https://cms.hizliulasim.com/wp-json';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const token = request.cookies.get('auth_token')?.value;

  if (!/^[a-z0-9.]{3,30}$/.test(username)) {
    return NextResponse.json({ message: 'Geçersiz kullanıcı adı' }, { status: 400 });
  }

  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const wpRes = await fetch(
      `${WP_API}/hizliulasim/v1/auth/profile/${encodeURIComponent(username)}`,
      { headers }
    );

    const data = await wpRes.json();

    if (!wpRes.ok) {
      return NextResponse.json(
        { message: data.message || 'Profil bulunamadı' },
        { status: wpRes.status }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ message: 'Sunucu hatası' }, { status: 500 });
  }
}
