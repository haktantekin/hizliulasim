import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'mail.haktantekin.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || '465');
const SMTP_USER = process.env.SMTP_USER || 'info@haktantekin.com';
const SMTP_PASS = process.env.SMTP_PASS || '';
const CONTACT_TO = process.env.CONTACT_TO || 'webhaktan@gmail.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ message: 'Tüm alanlar zorunludur' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ message: 'Geçerli bir e-posta adresi girin' }, { status: 400 });
    }

    if (name.length > 100 || email.length > 200 || subject.length > 200 || message.length > 5000) {
      return NextResponse.json({ message: 'Alan uzunluk sınırları aşıldı' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Hızlı Ulaşım İletişim" <${SMTP_USER}>`,
      to: CONTACT_TO,
      replyTo: `"${name}" <${email}>`,
      subject: `[Hızlı Ulaşım İletişim] ${subject}`,
      text: `Ad Soyad: ${name}\nE-posta: ${email}\nKonu: ${subject}\n\nMesaj:\n${message}`,
    });

    return NextResponse.json({ message: 'Mesajınız başarıyla gönderildi' });
  } catch (err) {
    console.error('Contact form error:', err);
    return NextResponse.json({ message: 'E-posta gönderilemedi' }, { status: 500 });
  }
}
