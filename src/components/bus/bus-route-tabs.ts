export type BusRouteTabId = 'schedule' | 'route' | 'nearest' | 'info';

interface BuildBusRouteTabsInput {
  lineCode: string;
  stopCount: number;
  hasWpContent: boolean;
}

export function buildBusRouteTabs({ lineCode, stopCount, hasWpContent }: BuildBusRouteTabsInput) {
  const tabs: Array<{ id: BusRouteTabId; label: string }> = [
    { id: 'schedule', label: `${lineCode} Sefer Saatleri` },
    { id: 'route', label: 'Güzergah' },
  ];

  if (stopCount > 0) tabs.push({ id: 'nearest', label: 'En Yakın Durak' });
  if (hasWpContent) tabs.push({ id: 'info', label: `${lineCode} Hat Bilgileri` });

  return tabs;
}
