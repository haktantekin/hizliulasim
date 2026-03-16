import { NextRequest, NextResponse } from 'next/server';

const WP_API = process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp/v2', '') || 'https://cms.hizliulasim.com/wp-json';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    return NextResponse.json({ message: 'Giriş yapmalısınız' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('avatar');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ message: 'Dosya yüklenmedi' }, { status: 400 });
    }

    const wpFormData = new FormData();
    wpFormData.append('avatar', file);

    const wpRes = await fetch(`${WP_API}/hizliulasim/v1/auth/avatar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: wpFormData,
    });

    const data = await wpRes.json();

    if (!wpRes.ok) {
      return NextResponse.json(
        { message: data.message || 'Yükleme başarısız' },
        { status: wpRes.status }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ message: 'Sunucu hatası' }, { status: 500 });
  }
}
