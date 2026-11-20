import { createContactPost } from './handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = createContactPost();
