import type { Toilet, ToiletEnvelope } from './contracts.ts';

const fixtureToilet: Toilet = {
  id: 'osm:node:1', name: 'Test WC', lat: 41, lng: 29, city: 'İstanbul', district: null,
  kind: 'public', fee: 'unknown', access: 'customers', wheelchair: 'unknown', openingHours: null,
  changingTable: 'unknown', source: 'osm', sourceUrl: 'https://www.openstreetmap.org/node/1', status: 'unknown',
};

export function fixtureEnvelope(): ToiletEnvelope {
  return {
    schemaVersion: 1, updatedAt: '2026-11-23T08:00:00Z',
    sources: {
      ibb: { updatedAt: '2026-11-23T08:00:00Z', status: 'current', count: 1 },
      osm: { updatedAt: '2026-11-23T08:00:00Z', status: 'current', count: 1 },
    },
    toilets: [
      { ...fixtureToilet, id: 'ibb:test', source: 'ibb', sourceUrl: 'https://data.ibb.gov.tr/dataset/sehir-tuvaletleri-veri-seti' },
      { ...fixtureToilet },
    ],
  };
}
