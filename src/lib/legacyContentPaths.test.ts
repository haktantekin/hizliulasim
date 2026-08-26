import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { hasLegacyContentSegment, isLegacyContentPath } = require('./legacyContentPaths.ts') as typeof import('./legacyContentPaths');

test('matches removed content roots and every nested path', () => {
  for (const pathname of [
    '/blog',
    '/blog/',
    '/blog/eski-yazi',
    '/BLOG/ESKI-YAZI',
    '/nasil-giderim',
    '/nasil-giderim/metrocity-avm',
  ]) {
    assert.equal(isLegacyContentPath(pathname), true, pathname);
  }
});

test('does not match current routes or similarly named slugs', () => {
  for (const pathname of [
    '/',
    '/kategoriler',
    '/ulasim-rehberi/nasil-giderim/metrocity-avm',
    '/bloglar',
    '/nasil-giderim-rehberi',
  ]) {
    assert.equal(isLegacyContentPath(pathname), false, pathname);
  }
});

test('detects legacy segments inside old hierarchical URLs', () => {
  assert.equal(hasLegacyContentSegment('/ulasim-rehberi/nasil-giderim/sultanahmet-camii'), true);
  assert.equal(hasLegacyContentSegment('/ulasim-rehberi/camiler/sultanahmet-camii'), false);
});
