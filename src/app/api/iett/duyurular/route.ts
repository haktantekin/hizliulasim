import { NextResponse } from 'next/server';
import { getDuyurular } from '@/services/iett';

export const revalidate = 300;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const hatKodu = searchParams.get('hatKodu');

    const duyurular = await getDuyurular(hatKodu || undefined);
    return NextResponse.json(duyurular);
  } catch (error) {
    console.error('IETT duyurular API error:', error);
    return NextResponse.json(
      { error: 'Duyurular alınamadı' },
      { status: 500 }
    );
  }
}
