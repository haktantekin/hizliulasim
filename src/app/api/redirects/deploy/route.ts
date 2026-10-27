import { NextRequest, NextResponse } from 'next/server';
import { triggerRedirectDeploy } from '@/lib/redirectDeploy';

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization') ?? '';
  const providedSecret = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';

  const result = await triggerRedirectDeploy({
    configuredSecret: process.env.REVALIDATION_SECRET ?? '',
    providedSecret,
    deployHookUrl: process.env.VERCEL_DEPLOY_HOOK_URL ?? '',
  });

  return NextResponse.json(result.body, { status: result.status });
}
