import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { parseMinibusLinesPayload } from './minibusData.ts';
import {
  buildMinibusDistrictEntries,
  filterMinibusLinesForDistrict,
  findMinibusDistrict,
  mergeMinibusDistrictCatalogs,
  MinibusDirectoryError,
  parseMinibusDirectoryPayload,
  resolveMinibusDistrictLoad,
  resolveMinibusDirectoryRoute,
} from './minibusDirectory.ts';

const validPayload = {
  version: 1,
  generatedAt: '2026-10-28T12:00:00Z',
  cities: [
    {
      id: 78,
      name: 'İstanbul',
      slug: 'istanbul',
      districts: [
        {
          id: 79,
          name: 'Kadıköy',
          slug: 'kadikoy',
          sourceIds: [
            '{FC8193A4-E0A1-4091-9146-F0C8EEE2A0A4}',
            '{187F9301-AC1B-4F24-BEEE-080711CF6C70}',
          ],
          lineIds: [101, 102],
        },
      ],
    },
  ],
};

const districtSnapshotPayload = JSON.parse(
  readFileSync(new URL('../data/minibus-districts.snapshot.json', import.meta.url), 'utf8'),
) as unknown;

test('parses the WordPress category catalog into explicit city and district relations', () => {
  const districts = parseMinibusDirectoryPayload(validPayload);

  assert.deepEqual(districts, [
    {
      id: 79,
      name: 'Kadıköy',
      slug: 'kadikoy',
      cityId: 78,
      cityName: 'İstanbul',
      citySlug: 'istanbul',
      sourceIds: [
        '{FC8193A4-E0A1-4091-9146-F0C8EEE2A0A4}',
        '{187F9301-AC1B-4F24-BEEE-080711CF6C70}',
      ],
      lineIds: [101, 102],
    },
  ]);
  assert.equal(findMinibusDistrict(districts, 'İSTANBUL', 'KADIKÖY')?.id, 79);
});

test('parses and matches a WordPress line category by official source identity', async () => {
  const directoryModule = await import('./minibusDirectory.ts') as unknown as Record<string, unknown>;
  assert.equal(typeof directoryModule.parseMinibusEditorialLinesPayload, 'function');
  assert.equal(typeof directoryModule.findMinibusEditorialLine, 'function');

  const parseEditorialLines = directoryModule.parseMinibusEditorialLinesPayload as (payload: unknown) => Array<Record<string, unknown>>;
  const findEditorialLine = directoryModule.findMinibusEditorialLine as (
    lines: Array<Record<string, unknown>>,
    citySlug: string,
    line: ReturnType<typeof parseMinibusLinesPayload>[number],
  ) => Record<string, unknown> | null;
  const editorialLines = parseEditorialLines({
    ...validPayload,
    cities: [{
      ...validPayload.cities[0],
      lines: [{
        id: 101,
        categoryId: 501,
        code: 'A19',
        name: 'Bakırköy-Hastane-Esenler-Atışalanı',
        slug: 'a19-bakirkoy-hastane-esenler-atisalani',
        sourceIds: ['{FC8193A4-E0A1-4091-9146-F0C8EEE2A0A4}'],
        infoHtml: '<p>Hat hakkında editoryal bilgi.</p>',
      }],
    }],
  });
  const [officialLine] = parseMinibusLinesPayload({
    d: JSON.stringify([{
      Value: '{FC8193A4-E0A1-4091-9146-F0C8EEE2A0A4}',
      Text: 'A19 - Bakırköy-Hastane-Esenler-Atışalanı',
      Status: 'MİNİBÜS',
    }]),
  });

  assert.equal(editorialLines[0].infoHtml, '<p>Hat hakkında editoryal bilgi.</p>');
  assert.equal(findEditorialLine(editorialLines, 'istanbul', officialLine)?.id, 101);
});

test('treats empty category markup as no information tab content', async () => {
  const directoryModule = await import('./minibusDirectory.ts') as unknown as Record<string, unknown>;
  assert.equal(typeof directoryModule.hasMeaningfulMinibusInfo, 'function');
  const hasMeaningfulInfo = directoryModule.hasMeaningfulMinibusInfo as (html: string | null | undefined) => boolean;

  assert.equal(hasMeaningfulInfo('<p> &nbsp; </p>'), false);
  assert.equal(hasMeaningfulInfo('<p>Hat hakkında bilgi.</p>'), true);
});

test('reads minibüs information from the matching standard WordPress category response', async () => {
  const directoryModule = await import('./minibusDirectory.ts') as unknown as Record<string, unknown>;
  assert.equal(typeof directoryModule.parseMinibusCategoryInfoPayload, 'function');
  const parseCategoryInfo = directoryModule.parseMinibusCategoryInfoPayload as (
    payload: unknown,
    slug: string,
  ) => string;

  assert.equal(
    parseCategoryInfo([
      {
        id: 146,
        name: 'A19 Bakırköy-Hastane-Esenler-Atışalanı',
        slug: 'a19-bakirkoy-hastane-esenler-atisalani',
        parent: 78,
        description: '<p>A19 hattı hakkında bilgi.</p>',
      },
    ], 'a19-bakirkoy-hastane-esenler-atisalani'),
    '<p>A19 hattı hakkında bilgi.</p>',
  );
  assert.equal(
    parseCategoryInfo([
      {
        id: 147,
        slug: 'baska-hat',
        description: '<p>Başka hat bilgisi.</p>',
      },
    ], 'a19-bakirkoy-hastane-esenler-atisalani'),
    '',
  );
});

test('filters official lines only by source identity, never by words in the route name', () => {
  const districts = parseMinibusDirectoryPayload(validPayload);
  const kadikoy = findMinibusDistrict(districts, 'istanbul', 'kadikoy');
  assert.ok(kadikoy);

  const lines = parseMinibusLinesPayload({
    d: JSON.stringify([
      {
        Value: '{FC8193A4-E0A1-4091-9146-F0C8EEE2A0A4}',
        Text: 'C55 - Kadıköy-Yenisahra-Batı Ataşehir',
        Status: 'MİNİBÜS',
      },
      {
        Value: '{187F9301-AC1B-4F24-BEEE-080711CF6C70}',
        Text: 'C50 - Adında ilçe geçmeyen doğrulanmış hat',
        Status: 'MİNİBÜS',
      },
      {
        Value: '{AB5CECBB-4E3D-4EAD-97B8-E34AF2DEB8AA}',
        Text: 'BL322 - Selimpaşa-Ortaköy-Kadıköy',
        Status: 'MİNİBÜS',
      },
    ]),
  });

  assert.deepEqual(
    filterMinibusLinesForDistrict(lines, kadikoy).map((line) => line.code),
    ['C50', 'C55'],
  );
});

test('rejects malformed CMS data instead of publishing a partial district catalog', () => {
  assert.throws(
    () => parseMinibusDirectoryPayload({
      ...validPayload,
      cities: [
        {
          ...validPayload.cities[0],
          districts: [
            {
              ...validPayload.cities[0].districts[0],
              sourceIds: ['not-a-source-id'],
            },
          ],
        },
      ],
    }),
    (error) => error instanceof MinibusDirectoryError && /kaynak kimliği/i.test(error.message),
  );
});

test('rejects duplicate district slugs inside the same city to keep route resolution deterministic', () => {
  assert.throws(
    () => parseMinibusDirectoryPayload({
      ...validPayload,
      cities: [
        {
          ...validPayload.cities[0],
          districts: [
            validPayload.cities[0].districts[0],
            { ...validPayload.cities[0].districts[0], id: 999 },
          ],
        },
      ],
    }),
    (error) => error instanceof MinibusDirectoryError && /yinelenen ilçe slug/i.test(error.message),
  );
});

test('rejects non-administrative child categories such as Metro from the Istanbul directory', () => {
  assert.throws(
    () => parseMinibusDirectoryPayload({
      ...validPayload,
      cities: [{
        ...validPayload.cities[0],
        districts: [{
          id: 999,
          name: 'Metro',
          slug: 'metro',
          sourceIds: [],
          lineIds: [],
        }],
      }],
    }),
    (error) => error instanceof MinibusDirectoryError && /idari ilçe/i.test(error.message),
  );
});

test('resolves an explicit district before a line at the same URL level', () => {
  const districts = parseMinibusDirectoryPayload(validPayload);
  const lines = parseMinibusLinesPayload({
    d: JSON.stringify([
      {
        Value: '{99999999-9999-9999-9999-999999999999}',
        Text: 'KADIKOY - Slug çakışması örneği',
        Status: 'MİNİBÜS',
      },
    ]),
  });
  const collidingLine = { ...lines[0], slug: 'kadikoy' };

  assert.equal(
    resolveMinibusDirectoryRoute(districts, [collidingLine], 'istanbul', 'kadikoy').kind,
    'district',
  );
  assert.equal(
    resolveMinibusDirectoryRoute(districts, [collidingLine], 'istanbul', 'olmayan').kind,
    'not-found',
  );
});

test('keeps a catalog rejection distinct from a legitimate empty district catalog', () => {
  const failure = new MinibusDirectoryError('snapshot da geçersiz');
  const rejected = resolveMinibusDistrictLoad({ status: 'rejected', reason: failure });
  const empty = resolveMinibusDistrictLoad({ status: 'fulfilled', value: [] });

  assert.equal(rejected.status, 'error');
  assert.equal(rejected.error, failure);
  assert.deepEqual(empty, { status: 'ready', districts: [] });
});

test('accepts a real district with no lines so all Istanbul districts remain linkable', () => {
  const districts = parseMinibusDirectoryPayload({
    ...validPayload,
    cities: [{
      ...validPayload.cities[0],
      districts: [{
        id: 80,
        name: 'Adalar',
        slug: 'adalar',
        sourceIds: [],
        lineIds: [],
      }],
    }],
  });

  assert.deepEqual(districts[0].sourceIds, []);
  assert.equal(districts[0].slug, 'adalar');
});

test('overlays CMS relations per district without hiding districts missing from a partial CMS catalog', () => {
  const snapshot = parseMinibusDirectoryPayload({
    ...validPayload,
    cities: [{
      ...validPayload.cities[0],
      districts: [
        validPayload.cities[0].districts[0],
        {
          id: 80,
          name: 'Üsküdar',
          slug: 'uskudar',
          sourceIds: ['{AAAAAAAA-0000-0000-0000-000000000000}'],
          lineIds: [],
        },
      ],
    }],
  });
  const cms = parseMinibusDirectoryPayload({
    ...validPayload,
    cities: [{
      ...validPayload.cities[0],
      districts: [{
        ...validPayload.cities[0].districts[0],
        sourceIds: ['{BBBBBBBB-0000-0000-0000-000000000000}'],
      }],
    }],
  });

  const merged = mergeMinibusDistrictCatalogs(snapshot, cms);
  assert.deepEqual(merged.map((district) => district.slug), ['kadikoy', 'uskudar']);
  assert.deepEqual(merged[0].sourceIds, ['{BBBBBBBB-0000-0000-0000-000000000000}']);
  assert.deepEqual(merged[1].sourceIds, ['{AAAAAAAA-0000-0000-0000-000000000000}']);
});

test('does not let newly created empty CMS categories erase verified snapshot relations', () => {
  const snapshot = parseMinibusDirectoryPayload(validPayload);
  const cms = parseMinibusDirectoryPayload({
    ...validPayload,
    cities: [{
      ...validPayload.cities[0],
      districts: [{
        ...validPayload.cities[0].districts[0],
        sourceIds: [],
        lineIds: [],
      }],
    }],
  });

  const merged = mergeMinibusDistrictCatalogs(snapshot, cms);
  assert.deepEqual(merged[0].sourceIds, snapshot[0].sourceIds);
  assert.deepEqual(merged[0].lineIds, snapshot[0].lineIds);
});

test('keeps all verified relations when WordPress exposes all 39 newly created empty categories', () => {
  const snapshot = parseMinibusDirectoryPayload(districtSnapshotPayload);
  const emptyCms = snapshot.map((district) => ({ ...district, sourceIds: [], lineIds: [] }));

  const merged = mergeMinibusDistrictCatalogs(snapshot, emptyCms);
  assert.equal(merged.length, 39);
  assert.equal(
    merged.reduce((total, district) => total + district.sourceIds.length, 0),
    snapshot.reduce((total, district) => total + district.sourceIds.length, 0),
  );
});

test('keeps zero-line districts in the city directory with an explicit zero count', () => {
  const districts = parseMinibusDirectoryPayload({
    ...validPayload,
    cities: [{
      ...validPayload.cities[0],
      districts: [{
        id: 80,
        name: 'Adalar',
        slug: 'adalar',
        sourceIds: [],
        lineIds: [],
      }],
    }],
  });

  assert.deepEqual(buildMinibusDistrictEntries([], districts), [{
    district: districts[0],
    lineCount: 0,
  }]);
});

test('keeps district links with an unknown count when the official line source is unavailable', () => {
  const districts = parseMinibusDirectoryPayload(validPayload);

  assert.deepEqual(buildMinibusDistrictEntries(null, districts), [{
    district: districts[0],
    lineCount: null,
  }]);
});
