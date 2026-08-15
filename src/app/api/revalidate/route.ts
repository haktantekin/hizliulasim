import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

const CMS_TOKEN_VERIFY_URL =
  'https://cms.hizliulasim.com/wp-json/hizliulasim/v1/sitemap-feed/verify';

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const body = await request.json().catch(() => ({}));
  const path = typeof body.path === 'string' ? body.path : '/sitemap.xml';
  const configuredSecret = process.env.REVALIDATION_SECRET;
  const hasValidSecret = Boolean(configuredSecret && secret === configuredSecret);

  if (!hasValidSecret) {
    const cmsToken = typeof body.cms_token === 'string' ? body.cms_token : '';

    // CMS tokenlari yalnizca sitemap yenilemesine yetkilidir.
    if (!cmsToken || path !== '/sitemap.xml') {
      return NextResponse.json({ message: 'Invalid authorization' }, { status: 401 });
    }

    const verification = await fetch(CMS_TOKEN_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: cmsToken }),
      cache: 'no-store',
    }).catch(() => null);

    if (!verification?.ok) {
      return NextResponse.json({ message: 'Invalid CMS token' }, { status: 401 });
    }
  }

  revalidatePath(path);

  return NextResponse.json({ revalidated: true, path, source: hasValidSecret ? 'secret' : 'cms' });
}
