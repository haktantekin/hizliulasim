import assert from 'node:assert/strict';
import test from 'node:test';

import { getTurkishCalendarContext } from './calendar.ts';

test('millî günleri Europe/Istanbul gün sınırında işaretler', () => {
  assert.deepEqual(getTurkishCalendarContext(new Date('2026-04-22T21:30:00Z')), {
    localDate: '2026-04-23', hour: 0, month: 4, isWeekend: false, calendarTags: ['childrens_day'],
  });
  assert.deepEqual(getTurkishCalendarContext(new Date('2026-05-18T21:05:00Z')).calendarTags, ['youth_day']);
  assert.deepEqual(getTurkishCalendarContext(new Date('2026-08-29T21:05:00Z')).calendarTags, ['victory_day']);
  assert.deepEqual(getTurkishCalendarContext(new Date('2026-10-28T21:05:00Z')).calendarTags, ['republic_day']);
  assert.deepEqual(getTurkishCalendarContext(new Date('2026-11-09T21:05:00Z')).calendarTags, ['ataturk_memorial']);
});

test('İstanbul gününden önce özel gün etiketi üretmez', () => {
  const context = getTurkishCalendarContext(new Date('2026-04-22T20:59:00Z'));
  assert.equal(context.localDate, '2026-04-22');
  assert.deepEqual(context.calendarTags, []);
});

test('yerel saat, ay ve hafta sonu bilgisini deterministik üretir', () => {
  assert.deepEqual(getTurkishCalendarContext(new Date('2026-11-14T08:15:00Z')), {
    localDate: '2026-11-14', hour: 11, month: 11, isWeekend: true, calendarTags: [],
  });
});
