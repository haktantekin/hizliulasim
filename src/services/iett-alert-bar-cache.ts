import { unstable_cache } from 'next/cache';
import { loadIettAlertBarAlerts } from './iett-alert-bar.ts';

export const getCachedIettAlertBarAlerts = unstable_cache(
  () => loadIettAlertBarAlerts(),
  ['iett-alert-bar-alerts'],
  { revalidate: 300, tags: ['iett-alerts'] },
);
