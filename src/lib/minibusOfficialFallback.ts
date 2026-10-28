import {
  MinibusDataError,
  type MinibusCachedData,
  type MinibusLineDetails,
  type MinibusRoutePoint,
  type MinibusSchedule,
  type MinibusStop,
} from './minibusData.ts';

export type MinibusOfficialDataReaders = {
  details: (sourceId: string) => Promise<MinibusLineDetails>;
  route: (sourceId: string, turningPoint: 1 | 2) => Promise<MinibusRoutePoint[]>;
  schedule: (sourceId: string) => Promise<MinibusSchedule>;
  stops: (sourceId: string) => Promise<{ verified: boolean; stops: MinibusStop[] }>;
};

function emptySchedule(): MinibusSchedule {
  return {
    weekdayOutbound: [],
    weekdayReturn: [],
    weekendOutbound: [],
    weekendReturn: [],
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hasScheduleTimes(schedule: MinibusSchedule): boolean {
  return schedule.weekdayOutbound.length > 0
    || schedule.weekdayReturn.length > 0
    || schedule.weekendOutbound.length > 0
    || schedule.weekendReturn.length > 0;
}

export async function loadOfficialMinibusLineData(
  line: Pick<{ name: string; sourceIds: string[] }, 'name' | 'sourceIds'>,
  readers: MinibusOfficialDataReaders,
): Promise<MinibusCachedData> {
  const sourceErrors: string[] = [];

  for (const sourceId of line.sourceIds) {
    const [detailsResult, outboundResult, returnResult, scheduleResult, stopsResult] = await Promise.allSettled([
      readers.details(sourceId),
      readers.route(sourceId, 1),
      readers.route(sourceId, 2),
      readers.schedule(sourceId),
      readers.stops(sourceId),
    ]);
    const errors: string[] = [];

    if (detailsResult.status === 'rejected') {
      errors.push(`Hat detayı: ${errorMessage(detailsResult.reason)}`);
    }
    if (outboundResult.status === 'rejected') {
      errors.push(`Gidiş güzergâhı: ${errorMessage(outboundResult.reason)}`);
    }
    if (returnResult.status === 'rejected') {
      errors.push(`Dönüş güzergâhı: ${errorMessage(returnResult.reason)}`);
    }
    if (scheduleResult.status === 'rejected') {
      errors.push(`Sefer bilgileri: ${errorMessage(scheduleResult.reason)}`);
    }
    if (stopsResult.status === 'rejected') {
      errors.push(`Duraklar: ${errorMessage(stopsResult.reason)}`);
    } else if (!stopsResult.value.verified) {
      errors.push('Duraklar: iki bağımsız okumada doğrulanamadı.');
    }

    const hasOfficialData = detailsResult.status === 'fulfilled'
      || (outboundResult.status === 'fulfilled' && outboundResult.value.length > 0)
      || (returnResult.status === 'fulfilled' && returnResult.value.length > 0)
      || (scheduleResult.status === 'fulfilled' && hasScheduleTimes(scheduleResult.value))
      || (stopsResult.status === 'fulfilled' && stopsResult.value.verified);

    if (!hasOfficialData) {
      sourceErrors.push(`${sourceId}: ${errors.join(' | ') || 'kullanılabilir veri dönmedi'}`);
      continue;
    }

    return {
      sourceId,
      details: detailsResult.status === 'fulfilled'
        ? detailsResult.value
        : { routeName: line.name },
      outboundRoute: outboundResult.status === 'fulfilled' ? outboundResult.value : [],
      returnRoute: returnResult.status === 'fulfilled' ? returnResult.value : [],
      schedule: scheduleResult.status === 'fulfilled' ? scheduleResult.value : emptySchedule(),
      stops: stopsResult.status === 'fulfilled' ? stopsResult.value.stops : [],
      stopsVerified: stopsResult.status === 'fulfilled' && stopsResult.value.verified,
      errors,
    };
  }

  throw new MinibusDataError(
    sourceErrors.length > 0
      ? `Hat verisi resmî API'den alınamadı. ${sourceErrors.join(' | ')}`
      : 'Hat için resmî kaynak kimliği bulunamadı.',
  );
}
