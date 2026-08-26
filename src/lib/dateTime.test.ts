import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { formatTrDateTime } = require('./dateTime.ts') as typeof import('./dateTime');

test('formats a date with Turkish numeric date and time', () => {
  const value = new Date(2026, 7, 2, 18, 8, 12);

  assert.equal(formatTrDateTime(value), '02.08.2026 18:08');
});

test('returns an empty string for invalid dates', () => {
  assert.equal(formatTrDateTime('invalid-date'), '');
});
