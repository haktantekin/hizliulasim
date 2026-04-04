import { NextResponse } from 'next/server';

export const revalidate = 300; // 5 min cache

const METRO_API = 'https://api.ibb.gov.tr/MetroIstanbul/api/MetroMobile/V2/GetAnnouncements/TR';

export async function GET() {
  try {
    const response = await fetch(METRO_API, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Metro Announcements API error: ${response.status}`);
    }

    const data = await response.json();
    const announcements = Array.isArray(data) ? data : data?.Data || data?.value || [];

    return NextResponse.json(announcements);
  } catch (error) {
    console.error('Metro Announcements API error:', error);
    return NextResponse.json(
      { error: 'Duyuru bilgileri alınamadı' },
      { status: 500 }
    );
  }
}
