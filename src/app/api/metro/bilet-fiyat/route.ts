import { NextResponse } from 'next/server';

export const revalidate = 3600; // 1 hour cache

const METRO_API = 'https://api.ibb.gov.tr/MetroIstanbul/api/MetroMobile/V2/GetTicketPrice/TR';

export async function GET() {
  try {
    const response = await fetch(METRO_API, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`Metro Ticket Price API error: ${response.status}`);
    }

    const data = await response.json();
    const prices = Array.isArray(data) ? data : data?.Data || data?.value || [];

    return NextResponse.json(prices);
  } catch (error) {
    console.error('Metro Ticket Price API error:', error);
    return NextResponse.json(
      { error: 'Bilet fiyat bilgileri alınamadı' },
      { status: 500 }
    );
  }
}
