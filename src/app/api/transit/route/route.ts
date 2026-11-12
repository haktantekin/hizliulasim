import { createTransitRouteHandler } from './handler.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export const POST = createTransitRouteHandler();
