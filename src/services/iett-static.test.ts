import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { IETTDurak, IETTDurakDetay, IETTHat } from '../types/iett.ts';
import { IettStaticSourceError, type LoadedIettStaticResource } from '../lib/iett-static/source.ts';
import { createIettStaticService } from './iett-static.ts';

const line: IETTHat = {
  SHATKODU: '15ÇK', SHATADI: 'KADIKÖY - KİRAZLITEPE', TARIFE: 'İNDİRİMLİ',
  HAT_UZUNLUGU: 15.42, SEFER_SURESI: 75,
};
const stop: IETTDurak = {
  SDPICARETNO: '100', SDURAKADI: 'KADIKÖY', KOORDINAT: '40.992889,29.024045',
  ILCEADI: 'Kadıköy', SPICARETNO: '100', YKOORDINATI: 40.992889, XKOORDINATI: 29.024045,
  DURAKTIPI: 'CCMODERN', ENGELLIKULLANIMI: '', AKPICARETNO: '', BOLESSION: 'Anadolu2',
};
const routeStop: IETTDurakDetay = {
  HATKODU: '15ÇK', YON: 'D', YON_ADI: 'KİRAZLITEPE', SIRANO: 1,
  DURAKKODU: '100', DURAKADI: 'KADIKÖY', XKOORDINATI: 29.024045, YKOORDINATI: 40.992889,
  DURAKTIPI: 'CCMODERN', ISLETMEBOLGE: 'Anadolu2', ISLETMEALTBOLGE: 'Kadıköy', ILCEADI: 'Kadıköy',
};
const path = {
  direction: 'D' as const,
  quality: 'exact' as const,
  coordinates: [[40.992889, 29.024045], [41.001, 29.031]] as [number, number][],
};

function resource<T>(data: T, usedFallback = false): LoadedIettStaticResource<T> {
  return { data, version: usedFallback ? 'previous_v1' : 'current_v1', generatedAt: '2026-11-13T09:00:00Z', usedFallback };
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    loadDirectory: async () => resource({ schemaVersion: 1 as const, generatedAt: '2026-11-13T09:00:00Z', lines: [line], stops: [stop] }),
    loadLine: async (code: string) => code === '15ÇK' ? resource({
      schemaVersion: 2 as const, generatedAt: '2026-11-13T09:00:00Z', line,
      schedules: [{ SHATKODU: '15ÇK', HATADI: line.SHATADI, SGUZERAH: '15ÇK_D', SYON: 'D', SGUNTIPI: 'C', GUZERGAH_ISARETI: null, SSERVISTIPI: 'Planlanan', DT: '06:15' }],
      stops: [routeStop], paths: [path],
    }) : null,
    loadStop: async (code: string) => code === '100' ? resource({
      schemaVersion: 1 as const, generatedAt: '2026-11-13T09:00:00Z', stop,
      lines: [{ hatKodu: '15ÇK', hatAdi: line.SHATADI, yon: 'D' as const, sirano: 1 }],
    }) : null,
    ...overrides,
  };
}

test('serves line, schedule, route-stop, stop and passing-line data without legacy upstream calls', async () => {
  const service = createIettStaticService(dependencies());
  assert.deepEqual((await service.getHatlar({ code: ' 15çk ' })).data, [line]);
  assert.equal((await service.getHatlar({ query: 'kadıköykirazlıtepe' })).data[0].SHATKODU, '15ÇK');
  assert.equal((await service.getSchedules('15çk')).data[0].SSERVISTIPI, 'Planlanan');
  assert.equal((await service.getRouteStops('15çk')).data[0].DURAKKODU, '100');
  assert.deepEqual((await service.getPaths('15çk')).data, [path]);
  assert.equal((await service.getStop('100')).data?.SDURAKADI, 'KADIKÖY');
  assert.equal((await service.getLinesByStop('100')).data[0].hatKodu, '15ÇK');
});

test('preserves whole-package previous fallback metadata', async () => {
  const service = createIettStaticService(dependencies({
    loadLine: async () => resource({
      schemaVersion: 1 as const, generatedAt: '2026-11-13T09:00:00Z', line, schedules: [], stops: [routeStop],
    }, true),
  }));
  const result = await service.getRouteStops('15çk');
  assert.equal(result.metadata.source, 'previous');
  assert.equal(result.metadata.version, 'previous_v1');
});

test('fails closed for every public bus lookup when the package is unavailable', async () => {
  const service = createIettStaticService(dependencies({
    loadDirectory: async () => { throw new IettStaticSourceError('DATA_UNAVAILABLE'); },
    loadLine: async () => { throw new IettStaticSourceError('DATA_UNAVAILABLE'); },
    loadStop: async () => { throw new IettStaticSourceError('DATA_UNAVAILABLE'); },
  }));
  await assert.rejects(service.getHatlar({}), { code: 'DATA_UNAVAILABLE' });
  await assert.rejects(service.getSchedules('15çk'), { code: 'DATA_UNAVAILABLE' });
  await assert.rejects(service.getRouteStops('15çk'), { code: 'DATA_UNAVAILABLE' });
  await assert.rejects(service.getPaths('15çk'), { code: 'DATA_UNAVAILABLE' });
  await assert.rejects(service.getStop('100'), { code: 'DATA_UNAVAILABLE' });
  await assert.rejects(service.getLinesByStop('100'), { code: 'DATA_UNAVAILABLE' });
  await assert.rejects(service.getNearestStop(40.993, 29.024), { code: 'DATA_UNAVAILABLE' });
});

test('finds the nearest stop from the directory without loading every stop shard', async () => {
  const service = createIettStaticService(dependencies());
  const nearest = await service.getNearestStop(40.993, 29.024);
  assert.equal(nearest.data?.durakKodu, '100');
  assert.ok((nearest.data?.distanceMeters ?? 999) < 50);
});

test('repairs Turkish mojibake from an already-published static package', async () => {
  const brokenLine: IETTHat = {
    ...line,
    SHATKODU: '11G',
    SHATADI: 'NECÄ°P FAZIL METRO - YENÄ°DOÄžAN PERONLAR',
    TARIFE: 'Ä°NDÄ°RÄ°MLÄ°',
  };
  const brokenStop: IETTDurak = {
    ...stop,
    SDPICARETNO: '200',
    SDURAKADI: 'ÅžEHÄ°T EROL OLÃ‡OK',
    ILCEADI: 'Ãœmraniye',
  };
  const brokenRouteStop: IETTDurakDetay = {
    ...routeStop,
    HATKODU: '11G',
    YON_ADI: 'YENÄ°DOÄžAN',
    DURAKKODU: '200',
    DURAKADI: 'ÅžEHÄ°T EROL OLÃ‡OK',
    ILCEADI: 'Ãœmraniye',
  };
  const service = createIettStaticService({
    loadDirectory: async () => resource({
      schemaVersion: 1 as const,
      generatedAt: '2026-11-13T09:00:00Z',
      lines: [brokenLine],
      stops: [brokenStop],
    }),
    loadLine: async () => resource({
      schemaVersion: 2 as const,
      generatedAt: '2026-11-13T09:00:00Z',
      line: brokenLine,
      schedules: [{
        SHATKODU: '11G',
        HATADI: brokenLine.SHATADI,
        SGUZERAH: brokenLine.SHATADI,
        SYON: 'D',
        SGUNTIPI: 'C',
        GUZERGAH_ISARETI: 'GÄ°DÄ°Åž',
        SSERVISTIPI: 'Planlanan',
        DT: '06:45',
      }],
      stops: [brokenRouteStop],
      paths: [path],
    }),
    loadStop: async () => resource({
      schemaVersion: 1 as const,
      generatedAt: '2026-11-13T09:00:00Z',
      stop: brokenStop,
      lines: [{ hatKodu: '11G', hatAdi: brokenLine.SHATADI, yon: 'D', sirano: 1 }],
    }),
  });

  assert.equal((await service.getHatlar({ code: '11g' })).data[0].SHATADI, 'NECİP FAZIL METRO - YENİDOĞAN PERONLAR');
  assert.equal((await service.getHatlar({ query: 'yeni doğan' })).data[0].SHATKODU, '11G');
  assert.equal((await service.getSchedules('11g')).data[0].GUZERGAH_ISARETI, 'GİDİŞ');
  assert.equal((await service.getRouteStops('11g')).data[0].DURAKADI, 'ŞEHİT EROL OLÇOK');
  assert.equal((await service.getStop('200')).data?.ILCEADI, 'Ümraniye');
  assert.equal((await service.getLinesByStop('200')).data[0].hatAdi, 'NECİP FAZIL METRO - YENİDOĞAN PERONLAR');
  assert.equal((await service.getNearestStop(40.993, 29.024)).data?.durakAdi, 'ŞEHİT EROL OLÇOK');
});
