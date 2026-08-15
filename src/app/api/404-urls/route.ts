import { NextRequest, NextResponse } from 'next/server';

const CMS_404_ENDPOINT = 'https://cms.hizliulasim.com/wp-json/hizliulasim/v1/404-urls';

type NotFoundReport = {
  path?: unknown;
  referrer?: unknown;
  userAgent?: unknown;
};

export async function POST(request: NextRequest) {
  const report = await request.json() as NotFoundReport;

  if (typeof report.path !== 'string' || !report.path.startsWith('/')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  const response = await fetch(CMS_404_ENDPOINT, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: report.path,
      referrer: typeof report.referrer === 'string' ? report.referrer : '',
      userAgent: typeof report.userAgent === 'string' ? report.userAgent : '',
    }),
    signal: AbortSignal.timeout(3000),
  });

  return new NextResponse(null, { status: response.ok ? 204 : 502 });
}
