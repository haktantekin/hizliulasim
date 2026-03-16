import { NextRequest, NextResponse } from 'next/server';

const WP_API = process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp/v2', '') || 'https://cms.hizliulasim.com/wp-json';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function POST(request: NextRequest) {
  const refreshTokenValue = request.cookies.get('refresh_token')?.value;

  if (!refreshTokenValue) {
    return NextResponse.json({ message: 'Refresh token bulunamadı' }, { status: 401 });
  }

  const wpRes = await fetch(`${WP_API}/hizliulasim/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshTokenValue }),
  });

  if (!wpRes.ok) {
    const errRes = NextResponse.json({ message: 'Oturum yenilenemedi' }, { status: 401 });
    errRes.cookies.set('auth_token', '', { ...COOKIE_OPTIONS, maxAge: 0 });
    errRes.cookies.set('refresh_token', '', { ...COOKIE_OPTIONS, maxAge: 0 });
    return errRes;
  }

  const data = await wpRes.json();
  const response = NextResponse.json({ success: true });

  response.cookies.set('auth_token', data.tokens.access_token, {
    ...COOKIE_OPTIONS,
    maxAge: data.tokens.expires_in,
  });

  response.cookies.set('refresh_token', data.tokens.refresh_token, {
    ...COOKIE_OPTIONS,
    maxAge: 30 * 24 * 60 * 60,
  });

  return response;
}
