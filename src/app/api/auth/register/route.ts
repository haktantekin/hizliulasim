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
    const { email, password, name, username } = body;

    if (!email || !password) {
      return NextResponse.json({ message: 'E-posta ve şifre gerekli' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ message: 'Şifre en az 8 karakter olmalı' }, { status: 400 });
    }

    if (!username || !/^[a-z0-9.]{3,30}$/.test(username)) {
      return NextResponse.json(
        { message: 'Kullanıcı adı 3-30 karakter olmalı ve sadece küçük harf, rakam ve nokta içerebilir' },
        { status: 400 }
      );
    }

    const wpRes = await fetch(`${WP_API}/hizliulasim/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, username }),
    });

    const data = await wpRes.json();

    if (!wpRes.ok) {
      return NextResponse.json(
        { message: data.message || 'Kayıt başarısız' },
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
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch {
    return NextResponse.json({ message: 'Sunucu hatası' }, { status: 500 });
  }
}
