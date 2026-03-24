import { NextRequest, NextResponse } from 'next/server';

const WP_API = process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp/v2', '') || 'https://cms.hizliulasim.com/wp-json';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ message: 'Tüm alanlar zorunludur' }, { status: 400 });
    }

    // Basic email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ message: 'Geçerli bir e-posta adresi girin' }, { status: 400 });
    }

    // Length limits
    if (name.length > 100 || email.length > 200 || subject.length > 200 || message.length > 5000) {
      return NextResponse.json({ message: 'Alan uzunluk sınırları aşıldı' }, { status: 400 });
    }

    // Forward to WordPress REST API as a contact form submission
    const wpRes = await fetch(`${WP_API}/hizliulasim/v1/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, subject, message }),
    });

    if (!wpRes.ok) {
      const data = await wpRes.json().catch(() => null);
      return NextResponse.json(
        { message: data?.message || 'Mesaj gönderilemedi' },
        { status: wpRes.status },
      );
    }

    return NextResponse.json({ message: 'Mesajınız başarıyla gönderildi' });
  } catch {
    return NextResponse.json({ message: 'Sunucu hatası oluştu' }, { status: 500 });
  }
}
