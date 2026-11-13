import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { gzipSync } from 'node:zlib';
import {
  clearIettStaticCacheForTests,
  loadActiveIettStaticPackage,
  loadIettStaticDirectory,
  loadIettStaticLine,
  loadIettStaticStop,
} from './source.ts';

const mib = 1024 ** 2;

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function lineRecord(code: string, name: string) {
  return {
    SHATKODU: code,
    SHATADI: name,
    TARIFE: 'İNDİRİMLİ',
    HAT_UZUNLUGU: 15.42,
    SEFER_SURESI: 75,
  };
}

function linePayload(code: string, name: string) {
  return {
    schemaVersion: 1,
    generatedAt: '2026-11-13T09:00:00+03:00',
    line: lineRecord(code, name),
    schedules: [{
      SHATKODU: code,
      HATADI: name,
      SGUZERAH: `${code}_D_pattern`,
      SYON: 'D',
      SGUNTIPI: 'C',
      GUZERGAH_ISARETI: null,
      SSERVISTIPI: 'Planlanan',
      DT: '06:15',
    }],
    stops: [{
      HATKODU: code,
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
    }],
  };
}

function stopPayload(code: string, lineCode: string, lineName: string) {
  return {
    schemaVersion: 1,
    generatedAt: '2026-11-13T09:00:00+03:00',
    stop: {
      SDPICARETNO: code,
      SDURAKADI: 'KADIKÖY',
      KOORDINAT: '40.992889,29.024045',
      ILCEADI: 'Kadıköy',
      SPICARETNO: code,
      YKOORDINATI: 40.992889,
      XKOORDINATI: 29.024045,
      DURAKTIPI: 'CCMODERN',
      ENGELLIKULLANIMI: 'UYGUN',
      AKPICARETNO: '',
      BOLESSION: 'Anadolu2',
    },
    lines: [{ hatKodu: lineCode, hatAdi: lineName, yon: 'D', sirano: 1 }],
  };
}

interface VersionOptions {
  lineCode?: string;
  lineName?: string;
  stopCode?: string;
  linePayloadOverride?: unknown;
  expandedDirectoryBytes?: Buffer;
  corruptLineHash?: boolean;
}

async function stageVersion(root: string, version: string, options: VersionOptions = {}) {
  const lineCode = options.lineCode ?? '1';
  const lineName = options.lineName ?? `HAT ${version}`;
  const stopCode = options.stopCode ?? '1';
  const directory = {
    schemaVersion: 1,
    generatedAt: '2026-11-13T09:00:00+03:00',
    lines: [lineRecord(lineCode, lineName)],
    stops: [stopPayload(stopCode, lineCode, lineName).stop],
  };
  const payloads: Record<string, Buffer> = {
    'directory.json.gz': gzipSync(options.expandedDirectoryBytes ?? Buffer.from(JSON.stringify(directory))),
    [`lines/${sha256(lineCode)}.json.gz`]: gzipSync(JSON.stringify(
      options.linePayloadOverride ?? linePayload(lineCode, lineName),
    )),
    [`stops/${sha256(stopCode)}.json.gz`]: gzipSync(JSON.stringify(stopPayload(stopCode, lineCode, lineName))),
  };
  const files = Object.fromEntries(Object.entries(payloads).map(([path, bytes]) => [
    path,
    { bytes: bytes.length, sha256: sha256(bytes) },
  ]));
  if (options.corruptLineHash) files[`lines/${sha256(lineCode)}.json.gz`].sha256 = '0'.repeat(64);
  const manifest = {
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
    files,
    indexes: {
      directory: 'directory.json.gz',
      lines: { [lineCode]: `lines/${sha256(lineCode)}.json.gz` },
      stops: { [stopCode]: `stops/${sha256(stopCode)}.json.gz` },
    },
  };
  const versionRoot = join(root, 'versions', version);
  for (const [path, bytes] of Object.entries(payloads)) {
    const filename = join(versionRoot, path);
    await mkdir(dirname(filename), { recursive: true });
    await writeFile(filename, bytes);
  }
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  await writeFile(join(versionRoot, 'manifest.json'), manifestBytes);
  return { version, manifestSha256: sha256(manifestBytes) };
}

async function writePointer(root: string, name: 'current' | 'previous', pointer: {
  version: string;
  manifestSha256: string;
}) {
  await writeFile(join(root, `${name}.json`), JSON.stringify(pointer));
}

async function setupStorage(t: TestContext): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'iett-static-'));
  const env = process.env as NodeJS.Dict<string>;
  const previous = {
    nodeEnv: env.NODE_ENV,
    storage: env.IETT_STATIC_STORAGE_PATH,
    baseUrl: env.IETT_STATIC_BASE_URL,
  };
  env.NODE_ENV = 'test';
  env.IETT_STATIC_STORAGE_PATH = root;
  delete env.IETT_STATIC_BASE_URL;
  clearIettStaticCacheForTests();
  t.after(async () => {
    if (previous.nodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previous.nodeEnv;
    if (previous.storage === undefined) delete env.IETT_STATIC_STORAGE_PATH;
    else env.IETT_STATIC_STORAGE_PATH = previous.storage;
    if (previous.baseUrl === undefined) delete env.IETT_STATIC_BASE_URL;
    else env.IETT_STATIC_BASE_URL = previous.baseUrl;
    clearIettStaticCacheForTests();
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

test('loads the current directory, normalized line code, and stop code from one verified package', async (t) => {
  const root = await setupStorage(t);
  await writePointer(root, 'current', await stageVersion(root, 'current_v1', { lineCode: '15ÇK' }));

  const active = await loadActiveIettStaticPackage();
  assert.equal(active.version, 'current_v1');
  assert.equal(active.usedFallback, false);
  assert.equal((await loadIettStaticDirectory()).data.lines[0].SHATKODU, '15ÇK');
  assert.equal((await loadIettStaticLine(' 15çk '))?.data.line.SHATKODU, '15ÇK');
  assert.equal((await loadIettStaticStop('1'))?.data.stop.SDPICARETNO, '1');
});

test('falls back as a whole when the current line shard hash is corrupt', async (t) => {
  const root = await setupStorage(t);
  await writePointer(root, 'current', await stageVersion(root, 'current_v1', {
    lineName: 'BOZUK GÜNCEL', corruptLineHash: true,
  }));
  await writePointer(root, 'previous', await stageVersion(root, 'previous_v1', { lineName: 'SAĞLAM ÖNCEKİ' }));

  const line = await loadIettStaticLine('1');
  assert.equal(line?.data.line.SHATADI, 'SAĞLAM ÖNCEKİ');
  assert.equal(line?.version, 'previous_v1');
  assert.equal(line?.usedFallback, true);
});

test('falls back when the current manifest bytes do not match the pointer hash', async (t) => {
  const root = await setupStorage(t);
  const current = await stageVersion(root, 'current_v1');
  await writePointer(root, 'current', { ...current, manifestSha256: '0'.repeat(64) });
  await writePointer(root, 'previous', await stageVersion(root, 'previous_v1', { lineName: 'ÖNCEKİ' }));

  const directory = await loadIettStaticDirectory();
  assert.equal(directory.version, 'previous_v1');
  assert.equal(directory.data.lines[0].SHATADI, 'ÖNCEKİ');
});

test('does not resurrect a code from previous when the current package validly omits it', async (t) => {
  const root = await setupStorage(t);
  await writePointer(root, 'current', await stageVersion(root, 'current_v1', { lineCode: '1' }));
  await writePointer(root, 'previous', await stageVersion(root, 'previous_v1', { lineCode: '2' }));

  assert.equal(await loadIettStaticLine('2'), null);
});

test('rejects an indexed shard whose payload code does not match the requested code and falls back', async (t) => {
  const root = await setupStorage(t);
  await writePointer(root, 'current', await stageVersion(root, 'current_v1', {
    linePayloadOverride: linePayload('2', 'YANLIŞ HAT'),
  }));
  await writePointer(root, 'previous', await stageVersion(root, 'previous_v1', { lineName: 'DOĞRU HAT' }));

  const line = await loadIettStaticLine('1');
  assert.equal(line?.data.line.SHATADI, 'DOĞRU HAT');
  assert.equal(line?.usedFallback, true);
});

test('isolates immutable caches between storage roots that reuse a version name', async (t) => {
  const firstRoot = await setupStorage(t);
  await writePointer(firstRoot, 'current', await stageVersion(firstRoot, 'same_version', { lineName: 'BİRİNCİ' }));
  assert.equal((await loadIettStaticLine('1'))?.data.line.SHATADI, 'BİRİNCİ');

  const secondRoot = await mkdtemp(join(tmpdir(), 'iett-static-second-'));
  t.after(() => rm(secondRoot, { recursive: true, force: true }));
  await writePointer(secondRoot, 'current', await stageVersion(secondRoot, 'same_version', { lineName: 'İKİNCİ' }));
  process.env.IETT_STATIC_STORAGE_PATH = secondRoot;

  assert.equal((await loadIettStaticLine('1'))?.data.line.SHATADI, 'İKİNCİ');
});

test('fails closed when local storage is configured in production', async (t) => {
  const root = await setupStorage(t);
  await writePointer(root, 'current', await stageVersion(root, 'current_v1'));
  (process.env as NodeJS.Dict<string>).NODE_ENV = 'production';

  await assert.rejects(loadActiveIettStaticPackage(), {
    code: 'INVALID_STORAGE_CONFIGURATION',
    message: 'İETT static storage is misconfigured',
  });
});

test('rejects a gzip payload that expands beyond the hard limit', async (t) => {
  const root = await setupStorage(t);
  await writePointer(root, 'current', await stageVersion(root, 'current_v1', {
    expandedDirectoryBytes: Buffer.alloc(65 * mib, 0x20),
  }));

  await assert.rejects(loadActiveIettStaticPackage(), { code: 'DATA_UNAVAILABLE' });
});
