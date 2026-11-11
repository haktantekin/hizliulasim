import type { TransitManifest } from './contracts.ts';

const secondsPerDay = 24 * 60 * 60;
const millisecondsPerDay = secondsPerDay * 1000;
const maxServiceSeconds = 3 * secondsPerDay;
const istanbulClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Istanbul',
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export interface ServiceDay {
  readonly serviceDate: string;
  /** Monday is zero, Sunday is six. */
  readonly weekdayIndex: number;
  readonly midnightEpochMs: number;
  /** Elapsed seconds since this service day's midnight, including overnight carryover. */
  readonly departureSeconds: number;
}

export interface ServiceContext {
  readonly serviceDate: string;
  readonly localDepartureSeconds: number;
  readonly departureEpochMs: number;
  /** Covered service days, newest first. Each date is evaluated separately. */
  readonly serviceDays: readonly ServiceDay[];
  readonly calendars: Pick<TransitManifest['indexes'], 'calendarRules' | 'serviceClasses'>;
}

function istanbulTime(instant: number) {
  const { year, month, day, hour, minute, second } = Object.fromEntries(
    istanbulClock.formatToParts(instant).map(({ type, value }) => [type, value]),
  );
  return {
    date: `${year.padStart(4, '0')}-${month}-${day}`,
    seconds: Number(hour) * 3600 + Number(minute) * 60 + Number(second),
  };
}

// UTC Date operations encode Gregorian dates for arithmetic. Intl supplies the timezone offset.
function civilDateNumber(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function istanbulOffsetMs(instant: number): number {
  const local = istanbulTime(instant);
  return civilDateNumber(local.date) + local.seconds * 1000 - instant;
}

function istanbulMidnight(civilDate: number): number {
  const estimate = civilDate - istanbulOffsetMs(civilDate);
  // Re-evaluate at the intended local midnight in case the offset changed that morning.
  return civilDate - istanbulOffsetMs(estimate);
}

export function getServiceContext(departureAt: Date, manifest: TransitManifest): ServiceContext {
  const departureEpochMs = departureAt.getTime();
  const local = istanbulTime(departureEpochMs);
  const context = {
    serviceDate: local.date,
    localDepartureSeconds: local.seconds,
    departureEpochMs,
    calendars: manifest.indexes,
    serviceDays: [] as ServiceDay[],
  };
  const { start, end } = manifest.serviceDateRange;
  if (local.date < start || local.date > end) return context;

  const departureCivilDate = civilDateNumber(local.date);
  for (let daysAgo = 0; daysAgo < maxServiceSeconds / secondsPerDay; daysAgo++) {
    const civilDate = new Date(departureCivilDate - daysAgo * millisecondsPerDay);
    const serviceDate = civilDate.toISOString().slice(0, 10);
    if (serviceDate < start) break;
    const midnightEpochMs = istanbulMidnight(civilDate.getTime());
    context.serviceDays.push({
      serviceDate,
      weekdayIndex: (civilDate.getUTCDay() + 6) % 7,
      midnightEpochMs,
      departureSeconds: (departureEpochMs - midnightEpochMs) / 1000,
    });
  }
  return context;
}

/** Defaults to the query's local date. Pass a candidate date to evaluate overnight service. */
export function isServiceActive(
  serviceId: string,
  context: ServiceContext,
  serviceDate = context.serviceDate,
): boolean {
  const day = context.serviceDays.find((candidate) => candidate.serviceDate === serviceDate);
  const { calendarRules, serviceClasses } = context.calendars;
  if (!day || !Object.hasOwn(calendarRules, serviceId)) return false;
  const classId = calendarRules[serviceId];
  if (!Object.hasOwn(serviceClasses, classId)) return false;

  const { calendar } = serviceClasses[classId];
  if (calendar.removedDates.includes(serviceDate)) return false;
  if (calendar.addedDates.includes(serviceDate)) return true;
  return calendar.startDate !== null && calendar.endDate !== null
    && serviceDate >= calendar.startDate && serviceDate <= calendar.endDate
    && calendar.weekdays[day.weekdayIndex] === 1;
}

export function serviceTimeToEpochMs(day: ServiceDay, gtfsSeconds: number): number {
  if (!Number.isInteger(gtfsSeconds) || gtfsSeconds < 0 || gtfsSeconds >= maxServiceSeconds) {
    throw new RangeError('Invalid GTFS service time');
  }
  return day.midnightEpochMs + gtfsSeconds * 1000;
}
