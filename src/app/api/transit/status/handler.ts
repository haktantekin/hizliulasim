import { loadManifest, loadSnapshotPointer } from '../../../../lib/transit/snapshot-source.ts';

const istanbulCalendar = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Istanbul', calendar: 'gregory', numberingSystem: 'latn',
  year: 'numeric', month: '2-digit', day: '2-digit',
});

async function inspectSnapshot(name: 'current' | 'previous') {
  const pointer = await loadSnapshotPointer(name).catch(() => null);
  if (!pointer) return { version: null, manifest: null };
  const manifest = await loadManifest(pointer).catch(() => null);
  return { version: pointer.version, manifest };
}

export function createTransitStatusHandler(now = () => new Date()) {
  return async () => {
    const checkedAt = now();
    const { year, month, day } = Object.fromEntries(istanbulCalendar.formatToParts(checkedAt)
      .map(({ type, value }) => [type, value]));
    const istanbulDate = `${year.padStart(4, '0')}-${month}-${day}`;
    const [current, previous] = await Promise.all([inspectSnapshot('current'), inspectSnapshot('previous')]);
    const active = current.manifest ?? previous.manifest;
    const usedFallback = !current.manifest && previous.manifest !== null;
    const range = active?.serviceDateRange;
    const coversToday = !!range && range.start <= istanbulDate && istanbulDate <= range.end;
    return Response.json({
      ready: coversToday,
      status: coversToday ? (usedFallback ? 'degraded' : 'ready') : 'unavailable',
      readinessScope: 'manifest',
      shardIntegrityChecked: false,
      shardValidation: 'on-route-request',
      activeVersion: active?.version ?? null,
      usedFallback,
      currentVersion: current.version,
      previousVersion: previous.version,
      schemaCompatible: active !== null,
      serviceDateRange: range ? { start: range.start, end: range.end } : null,
      istanbulDate,
      coversToday,
      generatedAt: active?.createdAt ?? null,
      checkedAt: checkedAt.toISOString(),
    }, { status: coversToday ? 200 : 503, headers: { 'Cache-Control': 'private, no-store' } });
  };
}
