import { IettStaticSourceError } from '../../../lib/iett-static/source.ts';

export function iettStaticErrorResponse(error: unknown): Response | null {
  if (!(error instanceof IettStaticSourceError) || error.code !== 'DATA_UNAVAILABLE') return null;
  return Response.json(
    { error: 'DATA_UNAVAILABLE' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
