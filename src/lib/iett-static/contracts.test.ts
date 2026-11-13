import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  normalizeIettStaticCode,
  parseIettStaticDirectory,
  parseIettStaticLine,
  parseIettStaticManifest,
  parseIettStaticPointer,
  parseIettStaticStop,
} from './contracts.ts';

const version = '20261113T090000Z_abcdef0123456789';
const digest = 'a'.repeat(64);
const codeOneHash = '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b';
const directoryPath = 'directory.json.gz';
const linePath = `lines/${codeOneHash}.json.gz`;
const stopPath = `stops/${codeOneHash}.json.gz`;

const line = {
  SHATKODU: '1',
  SHATADI: 'KİRAZLITEPE - ACIBADEM - KADIKÖY',
  TARIFE: 'İNDİRİMLİ',
  HAT_UZUNLUGU: 15.42,
  SEFER_SURESI: 75,
};

const schedule = {
  SHATKODU: '1',
  HATADI: line.SHATADI,
  SGUZERAH: '1_D_pattern',
  SYON: 'D',
  SGUNTIPI: 'C',
  GUZERGAH_ISARETI: null,
  SSERVISTIPI: 'Planlanan',
  DT: '06:15',
};

const routeStop = {
  HATKODU: '1',
  YON: 'D',
  YON_ADI: 'KİRAZLITEPE',
  SIRANO: 1,
  DURAKKODU: '1',
  DURAKADI: 'KADIKÖY',
  XKOORDINATI: 29.024045,
  YKOORDINATI: 40.992889,
  DURAKTIPI: 'CCMODERN',
  ISLETMEBOLGE: 'Anadolu2',
  ISLETMEALTBOLGE: 'Kadıköy',
  ILCEADI: 'Kadıköy',
};

const stop = {
  SDPICARETNO: '1',
  SDURAKADI: 'KADIKÖY',
  KOORDINAT: '40.992889,29.024045',
  ILCEADI: 'Kadıköy',
  SPICARETNO: '1',
  YKOORDINATI: 40.992889,
  XKOORDINATI: 29.024045,
  DURAKTIPI: 'CCMODERN',
  ENGELLIKULLANIMI: 'UYGUN',
  AKPICARETNO: '',
  BOLESSION: 'Anadolu2',
};

function manifestFixture() {
  return {
    schemaVersion: 1,
    version,
    generatedAt: '2026-11-13T09:00:00+03:00',
    serviceDateRange: { start: '2026-11-13', end: '2027-05-31' },
    source: {
      lines: {
        url: 'https://api.ibb.gov.tr/iett/UlasimAnaVeri/HatDurakGuzergah.asmx',
        retrievedAt: '2026-11-13T08:50:00+03:00', bytes: 1024, sha256: '1'.repeat(64),
      },
      stops: {
        url: 'https://api.ibb.gov.tr/iett/ibb/ibb.asmx',
        retrievedAt: '2026-11-13T08:51:00+03:00', bytes: 2048, sha256: '2'.repeat(64),
      },
      transit: { version: 'transit_v1', manifestSha256: '3'.repeat(64) },
    },
    counts: { lines: 1, schedules: 1, lineStops: 1, stops: 1 },
    files: {
      [directoryPath]: { bytes: 128, sha256: '4'.repeat(64) },
      [linePath]: { bytes: 256, sha256: '5'.repeat(64) },
      [stopPath]: { bytes: 192, sha256: '6'.repeat(64) },
    } as Record<string, { bytes: number; sha256: string }>,
    indexes: {
      directory: directoryPath,
      lines: { 1: linePath },
      stops: { 1: stopPath },
    },
  };
}

function manifestV2Fixture() {
  const fixture = manifestFixture();
  return {
    ...fixture,
    schemaVersion: 2,
    source: {
      ...fixture.source,
      schedules: [{
        lineCode: '1',
        artifact: {
          url: 'https://api.ibb.gov.tr/iett/UlasimAnaVeri/PlanlananSeferSaati.asmx',
          retrievedAt: '2026-11-13T08:52:00+03:00', bytes: 4096, sha256: '7'.repeat(64),
        },
      }],
    },
    counts: { ...fixture.counts, paths: 1 },
  };
}

const routePath = {
  direction: 'D' as const,
  quality: 'exact' as const,
  coordinates: [[40.992889, 29.024045], [41.001, 29.031]] as [number, number][],
};

test('normalizes safe İETT codes without allowing raw path input', () => {
  assert.equal(normalizeIettStaticCode(' 15çk '), '15ÇK');
  assert.equal(normalizeIettStaticCode('500-t'), '500-T');
  for (const value of ['', ' ../1 ', '1/2', 'A B', 'x'.repeat(33), 'İ\0ETT']) {
    assert.equal(normalizeIettStaticCode(value), null, value);
  }
});

test('accepts only an exact pointer with a safe version and sha256', () => {
  assert.deepEqual(parseIettStaticPointer({ version, manifestSha256: digest }), { version, manifestSha256: digest });
  assert.throws(() => parseIettStaticPointer({ version, manifestSha256: digest, extra: true }));
  assert.throws(() => parseIettStaticPointer({ version: '../bad', manifestSha256: digest }));
  assert.throws(() => parseIettStaticPointer({ version, manifestSha256: digest.toUpperCase() }));
});

test('validates manifest inventory, provenance, counts, and hashed indexes', () => {
  const parsed = parseIettStaticManifest(manifestFixture());
  assert.equal(parsed.version, version);
  assert.equal(parsed.indexes.lines['1'], linePath);
  assert.equal(parsed.indexes.stops['1'], stopPath);

  const unknownFile = manifestFixture();
  unknownFile.files['orphan.json.gz'] = { bytes: 2, sha256: '7'.repeat(64) };
  assert.throws(() => parseIettStaticManifest(unknownFile));

  const wrongPath = manifestFixture();
  wrongPath.indexes.lines['1'] = 'lines/not-the-code-hash.json.gz';
  assert.throws(() => parseIettStaticManifest(wrongPath));

  const wrongCount = manifestFixture();
  wrongCount.counts.lines = 2;
  assert.throws(() => parseIettStaticManifest(wrongCount));

  const unsafeSource = manifestFixture();
  unsafeSource.source.lines.url = 'http://api.ibb.gov.tr/iett/lines';
  assert.throws(() => parseIettStaticManifest(unsafeSource));

  const current = parseIettStaticManifest(manifestV2Fixture());
  assert.equal(current.schemaVersion, 2);
  assert.equal(current.source.schedules?.[0]?.lineCode, '1');

  const foreignSchedule = manifestV2Fixture();
  foreignSchedule.source.schedules[0].lineCode = '2';
  assert.throws(() => parseIettStaticManifest(foreignSchedule));

  const duplicateSchedule = manifestV2Fixture();
  duplicateSchedule.source.schedules.push({ ...duplicateSchedule.source.schedules[0] });
  assert.throws(() => parseIettStaticManifest(duplicateSchedule));
});

test('parses a directory with unique legacy-compatible line records', () => {
  assert.deepEqual(parseIettStaticDirectory({
    schemaVersion: 1, generatedAt: '2026-11-13T09:00:00+03:00', lines: [line], stops: [stop],
  }).lines, [line]);
  assert.throws(() => parseIettStaticDirectory({
    schemaVersion: 1, generatedAt: '2026-11-13T09:00:00+03:00', lines: [line, { ...line }], stops: [stop],
  }));
  assert.throws(() => parseIettStaticDirectory({
    schemaVersion: 1, generatedAt: '2026-11-13T09:00:00+03:00', lines: [{ ...line, HAT_UZUNLUGU: Number.NaN }], stops: [stop],
  }));
  assert.throws(() => parseIettStaticDirectory({
    schemaVersion: 1, generatedAt: '2026-11-13T09:00:00+03:00', lines: [{ ...line, extra: true }], stops: [stop],
  }));
  assert.throws(() => parseIettStaticDirectory({
    schemaVersion: 1, generatedAt: '2026-11-13T09:00:00+03:00', lines: [line], stops: [stop, { ...stop }],
  }));
  assert.throws(() => parseIettStaticDirectory({
    schemaVersion: 1, generatedAt: '2026-11-13T09:00:00+03:00', lines: [line], stops: [{ ...stop, XKOORDINATI: 180 }],
  }));
  assert.equal(parseIettStaticDirectory({
    schemaVersion: 2, generatedAt: '2026-11-13T09:00:00+03:00', lines: [line], stops: [stop],
  }).schemaVersion, 2);
});

test('parses one line shard and rejects inconsistent schedules, stops, and coordinates', () => {
  const payload = {
    schemaVersion: 1, generatedAt: '2026-11-13T09:00:00+03:00', line, schedules: [schedule], stops: [routeStop],
  };
  assert.deepEqual(parseIettStaticLine(payload), payload);
  assert.throws(() => parseIettStaticLine({ ...payload, schedules: [{ ...schedule, SHATKODU: '2' }] }));
  assert.throws(() => parseIettStaticLine({ ...payload, schedules: [{ ...schedule, DT: '99:00' }] }));
  assert.throws(() => parseIettStaticLine({ ...payload, stops: [{ ...routeStop, HATKODU: '2' }] }));
  assert.throws(() => parseIettStaticLine({ ...payload, stops: [{ ...routeStop, XKOORDINATI: 180 }] }));
  assert.throws(() => parseIettStaticLine({ ...payload, stops: [{ ...routeStop, SIRANO: 0 }] }));

  const currentPayload = {
    ...payload, schemaVersion: 2, paths: [routePath],
  };
  assert.deepEqual(parseIettStaticLine(currentPayload), currentPayload);
  assert.throws(() => parseIettStaticLine({
    ...currentPayload, paths: [routePath, { ...routePath }],
  }));
  assert.throws(() => parseIettStaticLine({
    ...currentPayload, paths: [{ ...routePath, coordinates: [[40.99, 29.02]] }],
  }));
  assert.throws(() => parseIettStaticLine({
    ...currentPayload, paths: [{ ...routePath, coordinates: [[40.99, 29.02], [41, 180]] }],
  }));
});

test('parses a stop shard and rejects duplicate or mismatched passing lines', () => {
  const passingLine = { hatKodu: '1', hatAdi: line.SHATADI, yon: 'D', sirano: 1 };
  const payload = {
    schemaVersion: 1, generatedAt: '2026-11-13T09:00:00+03:00', stop, lines: [passingLine],
  };
  assert.deepEqual(parseIettStaticStop(payload), payload);
  assert.throws(() => parseIettStaticStop({ ...payload, lines: [passingLine, { ...passingLine }] }));
  assert.throws(() => parseIettStaticStop({ ...payload, stop: { ...stop, SDPICARETNO: '../2' } }));
  assert.throws(() => parseIettStaticStop({ ...payload, stop: { ...stop, YKOORDINATI: -10 } }));
  assert.throws(() => parseIettStaticStop({ ...payload, lines: [{ ...passingLine, yon: 'X' }] }));
  assert.equal(parseIettStaticStop({ ...payload, schemaVersion: 2 }).schemaVersion, 2);
});
