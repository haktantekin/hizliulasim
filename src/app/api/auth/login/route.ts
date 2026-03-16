import { NextResponse } from 'next/server';

const WP_API = process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp/v2', '') || 'https://cms.hizliulasim.com/wp-json';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ message: 'E-posta ve şifre gerekli' }, { status: 400 });
    }

    const wpRes = await fetch(`${WP_API}/hizliulasim/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await wpRes.json();

    if (!wpRes.ok) {
      return NextResponse.json(
        { message: data.message || 'Giriş başarısız' },
        { status: wpRes.status }
      );
    }

    const response = NextResponse.json({
      user: data.user,
    });

    response.cookies.set('auth_token', data.tokens.access_token, {
      ...COOKIE_OPTIONS,
      maxAge: data.tokens.expires_in,
    });

    response.cookies.set('refresh_token', data.tokens.refresh_token, {
      ...COOKIE_OPTIONS,
      maxAge: 30 * 24 * 60 * 60, // 30 gün
    });

    return response;
  } catch {
    return NextResponse.json({ message: 'Sunucu hatası' }, { status: 500 });
  }
}
