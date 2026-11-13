import type { CalendarContext, CalendarTag } from './contracts.ts';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});

const fixedCalendarTags: Record<string, CalendarTag> = {
  '04-23': 'childrens_day',
  '05-19': 'youth_day',
  '08-30': 'victory_day',
  '10-29': 'republic_day',
  '11-10': 'ataturk_memorial',
};

export function getTurkishCalendarContext(now: Date): CalendarContext {
  const parts = new Map(formatter.formatToParts(now).map(({ type, value }) => [type, value]));
  const year = parts.get('year') ?? '0000';
  const monthText = parts.get('month') ?? '01';
  const day = parts.get('day') ?? '01';
  const weekday = parts.get('weekday') ?? '';
  const tag = fixedCalendarTags[`${monthText}-${day}`];

  return {
    localDate: `${year}-${monthText}-${day}`,
    hour: Number(parts.get('hour') ?? 0),
    month: Number(monthText),
    isWeekend: weekday === 'Sat' || weekday === 'Sun',
    calendarTags: tag ? [tag] : [],
  };
}
