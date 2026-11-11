import { createTransitStatusHandler } from './handler.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = createTransitStatusHandler();
