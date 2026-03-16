import { NextRequest, NextResponse } from 'next/server';

const WP_API = process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp/v2', '') || 'https://cms.hizliulasim.com/wp-json';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function GET(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    return NextResponse.json({ message: 'Oturum bulunamadı' }, { status: 401 });
  }

  const wpRes = await fetch(`${WP_API}/hizliulasim/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (wpRes.status === 401) {
    // Token expired — try refresh
    const refreshToken = request.cookies.get('refresh_token')?.value;
    if (!refreshToken) {
      const errRes = NextResponse.json({ message: 'Oturum süresi dolmuş' }, { status: 401 });
      errRes.cookies.set('auth_token', '', { ...COOKIE_OPTIONS, maxAge: 0 });
      return errRes;
    }

    const refreshRes = await fetch(`${WP_API}/hizliulasim/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!refreshRes.ok) {
      const errRes = NextResponse.json({ message: 'Oturum süresi dolmuş' }, { status: 401 });
      errRes.cookies.set('auth_token', '', { ...COOKIE_OPTIONS, maxAge: 0 });
      errRes.cookies.set('refresh_token', '', { ...COOKIE_OPTIONS, maxAge: 0 });
      return errRes;
    }

    const refreshData = await refreshRes.json();
    const newToken = refreshData.tokens.access_token;

    // Retry with new token
    const retryRes = await fetch(`${WP_API}/hizliulasim/v1/auth/me`, {
      headers: { Authorization: `Bearer ${newToken}` },
    });

    if (!retryRes.ok) {
      return NextResponse.json({ message: 'Profil alınamadı' }, { status: 401 });
    }

    const retryData = await retryRes.json();
    const response = NextResponse.json(retryData);

    response.cookies.set('auth_token', newToken, {
      ...COOKIE_OPTIONS,
      maxAge: refreshData.tokens.expires_in,
    });
    response.cookies.set('refresh_token', refreshData.tokens.refresh_token, {
      ...COOKIE_OPTIONS,
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  }

  if (!wpRes.ok) {
    return NextResponse.json({ message: 'Profil alınamadı' }, { status: wpRes.status });
  }

  const data = await wpRes.json();
  return NextResponse.json(data);
}
