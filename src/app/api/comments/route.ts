import { NextRequest, NextResponse } from 'next/server';

const WP_API = process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp/v2', '') || 'https://cms.hizliulasim.com/wp-json';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postId = searchParams.get('post_id');
  const page = searchParams.get('page') || '1';

  if (!postId) {
    return NextResponse.json({ message: 'post_id gerekli' }, { status: 400 });
  }

  const wpRes = await fetch(
    `${WP_API}/hizliulasim/v1/comments?post_id=${encodeURIComponent(postId)}&page=${encodeURIComponent(page)}`,
    { next: { revalidate: 30 } }
  );

  const data = await wpRes.json();

  if (!wpRes.ok) {
    return NextResponse.json(
      { message: data.message || 'Yorumlar yüklenemedi' },
      { status: wpRes.status }
    );
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ message: 'Yorum yapmak için giriş yapmalısınız' }, { status: 401 });
    }

    const body = await request.json();

    const wpRes = await fetch(`${WP_API}/hizliulasim/v1/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await wpRes.json();

    if (!wpRes.ok) {
      return NextResponse.json(
        { message: data.message || 'Yorum gönderilemedi' },
        { status: wpRes.status }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ message: 'Sunucu hatası' }, { status: 500 });
  }
}
