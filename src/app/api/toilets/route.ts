import { getToilets } from '../../../lib/toilets/source.ts';
import { createToiletsHandler } from './handler.ts';

export const runtime = 'nodejs';
export const GET = createToiletsHandler(() => getToilets());
