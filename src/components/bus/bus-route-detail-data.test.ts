import assert from 'node:assert/strict';
import test from 'node:test';
import { loadBusRouteDetailResponses } from './bus-route-detail-data.ts';

test('bus detail loader requests only the four static package endpoints', async () => {
  const requestedUrls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    requestedUrls.push(String(input));
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  const responses = await loadBusRouteDetailResponses('500 T', fetcher);

  assert.deepEqual(requestedUrls, [
    '/api/iett/hatlar?kod=500%20T',
    '/api/iett/sefer-saatleri?hatKodu=500%20T',
    '/api/iett/durak-detay?hatKodu=500%20T',
    '/api/iett/guzergah?hatKodu=500%20T',
  ]);
  assert.equal(responses.hatRes.status, 'fulfilled');
  assert.equal(responses.seferRes.status, 'fulfilled');
  assert.equal(responses.durakRes.status, 'fulfilled');
  assert.equal(responses.pathRes.status, 'fulfilled');
});

test('bus detail loader preserves successful static responses when one endpoint fails', async () => {
  const fetcher = (async (input: RequestInfo | URL) => {
    if (String(input).includes('sefer-saatleri')) throw new Error('schedule unavailable');
    return new Response('[]', { status: 200 });
  }) as typeof fetch;

  const responses = await loadBusRouteDetailResponses('1', fetcher);

  assert.equal(responses.hatRes.status, 'fulfilled');
  assert.equal(responses.seferRes.status, 'rejected');
  assert.equal(responses.durakRes.status, 'fulfilled');
  assert.equal(responses.pathRes.status, 'fulfilled');
});
