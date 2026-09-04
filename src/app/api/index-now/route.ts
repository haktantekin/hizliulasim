import { NextResponse } from 'next/server';

import {
  authorizeIndexNowRequest,
  canSubmitProductionUrls,
  normalizeIndexNowUrls,
  submitIndexNow,
} from '@/lib/indexNow';
import { getHat } from '@/services/iett';

const SITE_URL = 'https://hizliulasim.com';

type IndexNowRequestBody = {
  urls?: unknown;
  cms_token?: unknown;
};

export async function POST(request: Request) {
  if (!canSubmitProductionUrls(process.env.NODE_ENV, process.env.INDEXNOW_ALLOW_NON_PRODUCTION)) {
    return NextResponse.json(
      { error: 'Production IndexNow submissions are disabled in this environment' },
      { status: 403 },
    );
  }

  const key = process.env.INDEXNOW_KEY ?? '';
  if (key === '') {
    return NextResponse.json(
      { error: 'INDEXNOW_KEY environment variable is not set' },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({})) as IndexNowRequestBody;
  const requestUrl = new URL(request.url);
  const authorizationSource = await authorizeIndexNowRequest({
    configuredSecret: process.env.REVALIDATION_SECRET ?? '',
    providedSecret: requestUrl.searchParams.get('secret') ?? '',
    cmsToken: typeof body.cms_token === 'string' ? body.cms_token : '',
  });

  if (!authorizationSource) {
    return NextResponse.json({ error: 'Invalid authorization' }, { status: 401 });
  }

  const requestedUrls = Array.isArray(body.urls) ? [...body.urls] : [];
  const scope = requestUrl.searchParams.get('scope');
  const busCode = requestUrl.searchParams.get('hat');

  if (scope === 'all') {
    const routes = await getHat();
    requestedUrls.push(
      `${SITE_URL}/otobus-hatlari`,
      ...routes.map((route) => `${SITE_URL}/otobus-hatlari/${route.SHATKODU.toLowerCase()}`),
    );
  } else if (busCode) {
    requestedUrls.push(`${SITE_URL}/otobus-hatlari/${busCode.toLowerCase()}`);
  }

  const urls = normalizeIndexNowUrls(requestedUrls);
  if (urls.length === 0) {
    return NextResponse.json(
      { error: 'At least one valid hizliulasim.com URL is required' },
      { status: 400 },
    );
  }

  const result = await submitIndexNow(urls, { key });
  return NextResponse.json(
    { ...result, source: authorizationSource },
    { status: result.success ? 200 : 502 },
  );
}
