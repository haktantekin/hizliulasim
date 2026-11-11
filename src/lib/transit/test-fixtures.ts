const serviceClass = 'a'.repeat(64);
const cellHash = '1b1f1cd671eff152af1dba464fd11c1bdc652c748e596f02047a0da020b7eb6c';
const patternId = 'c'.repeat(64);
const shapeId = 'd'.repeat(64);
const routeHash = 'e'.repeat(64);
const stopPath = `stops-grid/${cellHash}.json.gz`;
const transferPath = `transfers/${cellHash}.json.gz`;
const routePath = `routes/${routeHash}.json.gz`;
const patternPath = `patterns/${patternId}.json.gz`;
const shapePath = `shapes/${shapeId}.json.gz`;
const connectionPath = `connections/${serviceClass}-25.json.gz`;

function resource(table: string) {
  return {
    packageId: 'iett-gtfs-verisi',
    resourceId: `fixture-${table}`,
    resourceUrl: `https://data.ibb.gov.tr/${table}.csv`,
    downloadedAt: '2026-11-10T12:00:00+03:00',
    etag: null,
    bytes: 128,
    sha256: 'f'.repeat(64),
  };
}

// Reduced from the producer's schema-1 snapshot builder and numeric-ID fixtures.
// Sizes and digests here stand in for the files. The parser only reads metadata.
export const snapshotPointerFixture = {
  version: 'fixture_v1',
  manifestSha256: '1'.repeat(64),
};

export const manifestFixture = {
  schemaVersion: 1,
  version: 'fixture_v1',
  createdAt: '2026-11-10T13:00:00Z',
  source: {
    ...resource('stop_times'),
    provenanceVersion: 2,
    resources: {
      stops: resource('stops'),
      routes: resource('routes'),
      trips: resource('trips'),
      stop_times: resource('stop_times'),
      calendar_dates: resource('calendar_dates'),
    },
    tableCounts: { stops: 2, routes: 1, trips: 1, stop_times: 2, calendar_dates: 1 },
  },
  serviceDateRange: { start: '2026-11-10', end: '2026-11-10' },
  boundingBox: {
    minLatitude: 41,
    maxLatitude: 41.001,
    minLongitude: 29,
    maxLongitude: 29.001,
  },
  counts: {
    stops: 2, routes: 1, trips: 1, patterns: 1, shapes: 1,
    connections: 1, transfers: 0, serviceClasses: 1, contentLinks: 0,
  },
  quality: { calendarExceptionsSupplied: true, approximateShapes: 1, reasons: {} },
  indexes: {
    stops: { '0': stopPath, '1': stopPath },
    stopGrid: { '4100_2900': stopPath },
    routes: { '0': routePath },
    patterns: { [patternId]: patternPath },
    shapes: { [shapeId]: shapePath },
    sourceShapes: {},
    transfers: { '4100_2900': transferPath },
    connectionBuckets: { [`${serviceClass}-25`]: connectionPath },
    serviceClasses: {
      [serviceClass]: {
        serviceIds: ['0'],
        calendar: {
          weekdays: [0, 0, 0, 0, 0, 0, 0],
          startDate: null,
          endDate: null,
          addedDates: ['2026-11-10'],
          removedDates: [],
        },
      },
    },
    calendarRules: { '0': serviceClass },
  },
  files: Object.fromEntries(
    [stopPath, transferPath, routePath, patternPath, shapePath, connectionPath, 'content-links.json.gz']
      .map((path) => [path, { bytes: 64, sha256: '2'.repeat(64) }]),
  ),
};
