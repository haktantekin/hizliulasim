import type { NextRequest } from 'next/server';
import { createGoogleLinkPost } from './handler';

export const runtime = 'nodejs';

const post = createGoogleLinkPost();

export async function POST(request: NextRequest) {
  return post(request, request.cookies.get('auth_token')?.value);
}
