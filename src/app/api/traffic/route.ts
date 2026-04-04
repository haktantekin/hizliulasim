import { NextResponse } from 'next/server';

export const revalidate = 300; // 5 min cache

const TRAFFIC_CURRENT_API =
  'https://api.ibb.gov.tr/tkmservices/api/TrafficData/v1/TrafficIndex';
const TRAFFIC_HISTORY_API =
  'https://api.ibb.gov.tr/tkmservices/api/TrafficData/v1/TrafficIndexHistory/24/H';

function parseXmlValue(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return match ? match[1] : '';
}

function parseArrayItems(xml: string): { index: number; date: string }[] {
  const items: { index: number; date: string }[] = [];
  const regex =
    /<ResponseTrafficIndexHistory>[\s\S]*?<TrafficIndex>(\d+)<\/TrafficIndex>[\s\S]*?<TrafficIndexDate>([^<]*)<\/TrafficIndexDate>[\s\S]*?<\/ResponseTrafficIndexHistory>/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    items.push({ index: Number(m[1]), date: m[2] });
  }
  return items;
}

function parseCurrentIndex(xml: string): number {
  const result = Number(parseXmlValue(xml, 'Result'));
  if (Number.isFinite(result) && result > 0) return result;

  const trafficIndex = Number(parseXmlValue(xml, 'TrafficIndex'));
  if (Number.isFinite(trafficIndex) && trafficIndex > 0) return trafficIndex;

  return 0;
}

function parseCurrentPayload(payload: string): number {
  try {
    const json = JSON.parse(payload) as { Result?: number; TrafficIndex?: number };
    const fromResult = Number(json?.Result);
    if (Number.isFinite(fromResult) && fromResult > 0) return fromResult;

    const fromTrafficIndex = Number(json?.TrafficIndex);
    if (Number.isFinite(fromTrafficIndex) && fromTrafficIndex > 0) return fromTrafficIndex;
  } catch {
    // Not JSON, continue with XML parser fallback.
  }

  return parseCurrentIndex(payload);
}

function parseHistoryPayload(payload: string): { index: number; date: string }[] {
  try {
    const json = JSON.parse(payload) as Array<{ TrafficIndex?: number; TrafficIndexDate?: string }>;
    if (Array.isArray(json)) {
      return json
        .map(item => ({
          index: Number(item?.TrafficIndex) || 0,
          date: item?.TrafficIndexDate || '',
        }))
        .filter(item => item.index > 0 && item.date);
    }
  } catch {
    // Not JSON, continue with XML parser fallback.
  }

  return parseArrayItems(payload);
}

export async function GET() {
  try {
    const [currentResponse, historyResponse] = await Promise.all([
      fetch(TRAFFIC_CURRENT_API, {
        next: { revalidate: 300 },
      }),
      fetch(TRAFFIC_HISTORY_API, {
        next: { revalidate: 300 },
      }),
    ]);

    if (!currentResponse.ok) {
      throw new Error(`Traffic current API error: ${currentResponse.status}`);
    }

    const currentPayload = await currentResponse.text();
    const currentIndex = parseCurrentPayload(currentPayload);

    let history: { index: number; date: string }[] = [];
    if (historyResponse.ok) {
      const historyPayload = await historyResponse.text();
      history = parseHistoryPayload(historyPayload);
    }

    const fallbackIndex = history.length > 0 ? history[0].index : 0;
    const index = currentIndex > 0 ? currentIndex : fallbackIndex;
    const date = history.length > 0 ? history[0].date : new Date().toISOString();

    return NextResponse.json({
      index,
      date,
      history,
    });
  } catch (error) {
    console.error('Traffic API error:', error);
    return NextResponse.json(
      { error: 'Trafik bilgileri alınamadı' },
      { status: 500 }
    );
  }
}
