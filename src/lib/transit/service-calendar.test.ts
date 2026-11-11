import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseManifest } from './contracts.ts';
import { getServiceContext, isServiceActive, serviceTimeToEpochMs } from './service-calendar.ts';
import { manifestFixture } from './test-fixtures.ts';

const weekdayClass = 'a'.repeat(64);
const weekendClass = 'b'.repeat(64);
const manifest = parseManifest({
  ...manifestFixture,
  serviceDateRange: { start: '2026-11-09', end: '2026-11-22' },
  indexes: {
    ...manifestFixture.indexes,
    calendarRules: { '0': weekdayClass, ALIAS: weekdayClass, WEEKEND: weekendClass },
    serviceClasses: {
      [weekdayClass]: {
        serviceIds: ['0', 'ALIAS'],
        calendar: {
          weekdays: [1, 1, 1, 1, 1, 0, 0],
          startDate: '2026-11-09',
          endDate: '2026-11-13',
          addedDates: ['2026-11-14', '2026-11-15'],
          removedDates: ['2026-11-10', '2026-11-15'],
        },
      },
      [weekendClass]: {
        serviceIds: ['WEEKEND'],
        calendar: {
          weekdays: [0, 0, 0, 0, 0, 1, 1],
          startDate: '2026-11-14',
          endDate: '2026-11-22',
          addedDates: [],
          removedDates: [],
        },
      },
    },
  },
});

test('uses Monday-first weekday rules and inclusive calendar ranges', () => {
  const cases = [
    ['2026-11-09', true, false],
    ['2026-11-13', true, false],
    ['2026-11-14', true, true],
    ['2026-11-16', false, false],
    ['2026-11-22', false, true],
  ] as const;

  for (const [date, weekday, weekend] of cases) {
    const context = getServiceContext(new Date(`${date}T12:00:00Z`), manifest);
    assert.equal(isServiceActive('0', context), weekday, date);
    assert.equal(isServiceActive('ALIAS', context), weekday, date);
    assert.equal(isServiceActive('WEEKEND', context), weekend, date);
  }
});

test('honors added dates outside the base range and gives removed dates precedence', () => {
  for (const [date, expected] of [
    ['2026-11-10', false],
    ['2026-11-14', true],
    ['2026-11-15', false],
  ] as const) {
    const context = getServiceContext(new Date(`${date}T12:00:00Z`), manifest);
    assert.equal(isServiceActive('0', context), expected, date);
  }
});

test('supports exception-only service and treats unknown IDs as inactive', () => {
  const context = getServiceContext(new Date('2026-11-10T12:00:00Z'), parseManifest(manifestFixture));
  assert.equal(isServiceActive('0', context), true);
  for (const id of ['unknown', '__proto__', 'constructor']) {
    assert.equal(isServiceActive(id, context), false);
  }
});

test('derives Istanbul civil dates and local seconds across local midnight', () => {
  const before = getServiceContext(new Date('2026-11-10T20:59:59Z'), manifest);
  const after = getServiceContext(new Date('2026-11-10T21:00:00Z'), manifest);
  assert.deepEqual([before.serviceDate, before.localDepartureSeconds], ['2026-11-10', 86399]);
  assert.deepEqual([after.serviceDate, after.localDepartureSeconds], ['2026-11-11', 0]);
});

test('uses the historical Istanbul offset when converting service midnight', () => {
  const historical = { ...manifest, serviceDateRange: { start: '2015-01-01', end: '2015-12-31' } };
  const winter = getServiceContext(new Date('2015-01-02T22:30:00Z'), historical);
  const summer = getServiceContext(new Date('2015-07-02T21:30:00Z'), historical);

  assert.deepEqual([winter.serviceDate, winter.localDepartureSeconds], ['2015-01-03', 1800]);
  assert.deepEqual([summer.serviceDate, summer.localDepartureSeconds], ['2015-07-03', 1800]);
  assert.equal(serviceTimeToEpochMs(winter.serviceDays[0], 1800), Date.parse('2015-01-02T22:30:00Z'));
  assert.equal(serviceTimeToEpochMs(summer.serviceDays[0], 1800), Date.parse('2015-07-02T21:30:00Z'));
});

test('uses local noon on the spring offset change date to anchor GTFS times', () => {
  const historical = { ...manifest, serviceDateRange: { start: '2015-01-01', end: '2015-12-31' } };
  const context = getServiceContext(new Date('2015-03-29T00:30:00Z'), historical);
  const serviceDay = context.serviceDays[0];
  assert.equal(context.localDepartureSeconds, 2.5 * 3600);
  assert.equal(serviceDay.serviceDate, '2015-03-29');
  assert.equal(serviceDay.departureSeconds, 3.5 * 3600);
  assert.equal(serviceTimeToEpochMs(serviceDay, 0), Date.parse('2015-03-28T21:00:00Z'));
  assert.equal(serviceTimeToEpochMs(serviceDay, 12 * 3600), Date.parse('2015-03-29T09:00:00Z'));
});

test('includes Friday 71:30 service at Monday 00:30 after the spring offset change', () => {
  const historical = { ...manifest, serviceDateRange: { start: '2015-01-01', end: '2015-12-31' } };
  const context = getServiceContext(new Date('2015-03-29T21:30:00Z'), historical);
  assert.deepEqual(context.serviceDays.map((day) => day.serviceDate), [
    '2015-03-30', '2015-03-29', '2015-03-28', '2015-03-27',
  ]);
  const friday = context.serviceDays[3];
  assert.equal(friday.departureSeconds, 257400);
  assert.equal(serviceTimeToEpochMs(friday, 257400), context.departureEpochMs);
  const next = getServiceContext(new Date('2015-03-29T22:00:00Z'), historical);
  assert.equal(next.serviceDays.some((day) => day.serviceDate === friday.serviceDate), false);
});

test('keeps the two occurrences of the fall transition hour distinct on the GTFS time axis', () => {
  const historical = { ...manifest, serviceDateRange: { start: '2015-01-01', end: '2015-12-31' } };
  const first = getServiceContext(new Date('2015-11-08T00:30:00Z'), historical);
  const second = getServiceContext(new Date('2015-11-08T01:30:00Z'), historical);
  assert.equal(first.localDepartureSeconds, 3.5 * 3600);
  assert.equal(second.localDepartureSeconds, 3.5 * 3600);
  assert.equal(first.serviceDays[0].departureSeconds, 2.5 * 3600);
  assert.equal(second.serviceDays[0].departureSeconds, 3.5 * 3600);
  assert.equal(serviceTimeToEpochMs(first.serviceDays[0], 0), Date.parse('2015-11-07T22:00:00Z'));
  assert.equal(serviceTimeToEpochMs(first.serviceDays[0], 12 * 3600), Date.parse('2015-11-08T10:00:00Z'));
});

test('exposes distinct service days with full GTFS times through 71:59:59', () => {
  const context = getServiceContext(new Date('2026-11-10T21:10:00Z'), manifest);
  assert.deepEqual(context.serviceDays.map(({ serviceDate, departureSeconds }) => [serviceDate, departureSeconds]), [
    ['2026-11-11', 600],
    ['2026-11-10', 87000],
    ['2026-11-09', 173400],
  ]);
  const [current, previous, twoDaysAgo] = context.serviceDays;
  const queryTime = Date.parse('2026-11-10T21:10:00Z');
  assert.equal(serviceTimeToEpochMs(current, 600), queryTime);
  assert.equal(serviceTimeToEpochMs(previous, 87000), queryTime);
  assert.equal(serviceTimeToEpochMs(twoDaysAgo, 173400), queryTime);
  assert.equal(serviceTimeToEpochMs(twoDaysAgo, 259199), Date.parse('2026-11-11T20:59:59Z'));
  for (const seconds of [-1, 1.5, 259200, Infinity]) {
    assert.throws(() => serviceTimeToEpochMs(twoDaysAgo, seconds), RangeError);
  }
  assert.equal(isServiceActive('0', context, previous.serviceDate), false);
  assert.equal(isServiceActive('0', context, twoDaysAgo.serviceDate), true);
});

test('withholds service days outside coverage without clamping the local date', () => {
  const first = getServiceContext(new Date('2026-11-08T21:00:00Z'), manifest);
  assert.deepEqual(first.serviceDays.map(({ serviceDate }) => serviceDate), ['2026-11-09']);
  for (const [instant, date] of [
    ['2026-11-08T20:59:59Z', '2026-11-08'],
    ['2026-11-22T21:00:00Z', '2026-11-23'],
  ]) {
    const context = getServiceContext(new Date(instant), manifest);
    assert.equal(context.serviceDate, date);
    assert.deepEqual(context.serviceDays, []);
    assert.equal(isServiceActive('WEEKEND', context), false);
    assert.equal(isServiceActive('WEEKEND', context, '2026-11-22'), false);
  }
  assert.throws(() => getServiceContext(new Date(NaN), manifest), RangeError);
});
