import type { IETTDuyuru } from '../types/iett.ts';
import { getIettAlerts, type IettAlertsResult } from './iett-alerts.ts';

type AlertLoader = (query: { limit: number }) => Promise<IettAlertsResult>;

export async function loadIettAlertBarAlerts(
  loadAlerts: AlertLoader = getIettAlerts,
): Promise<IETTDuyuru[]> {
  try {
    const result = await loadAlerts({ limit: 5 });
    return result.data.slice(0, 5);
  } catch {
    return [];
  }
}
