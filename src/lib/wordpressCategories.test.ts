import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import test from 'node:test';

import * as wordpressFetch from './wordpressCategories.ts';
import { fetchWordPressProxyPayload } from './wordpressProxy.ts';

const { fetchAllWordPressCategories } = wordpressFetch;

test('retries a poisoned cached WordPress response with a fresh request', async () => {
  const fetchJsonWithFreshRetry = (
    wordpressFetch as typeof wordpressFetch & {
      fetchWordPressJsonWithFreshRetry?: <T>(options: {
        url: string;
        revalidateSeconds: number;
        fetchImpl: typeof fetch;
        validate?: (value: unknown) => value is T;
      }) => Promise<T>;
    }
  ).fetchWordPressJsonWithFreshRetry;

  assert.equal(typeof fetchJsonWithFreshRetry, 'function');

  let requestCount = 0;
  const fetchImpl: typeof fetch = async (_input, init) => {
    requestCount += 1;
    if (init?.cache === 'no-store') {
      return Response.json([{ id: 27710, slug: 'zonguldak-filyos-tren-saatleri' }]);
    }

    return new Response('{"truncated":', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const posts = await fetchJsonWithFreshRetry!<Array<{ id: number; slug: string }>>({
    url: 'https://cms.example.test/wp-json/wp/v2/posts?slug=zonguldak-filyos-tren-saatleri',
    revalidateSeconds: 3600,
    fetchImpl,
  });

  assert.deepEqual(posts, [{ id: 27710, slug: 'zonguldak-filyos-tren-saatleri' }]);
  assert.equal(requestCount, 2);
});

test('retries a parseable cached WordPress payload that fails validation', async () => {
  const fetchJsonWithFreshRetry = (
    wordpressFetch as typeof wordpressFetch & {
      fetchWordPressJsonWithFreshRetry?: <T>(options: {
        url: string;
        revalidateSeconds: number;
        fetchImpl: typeof fetch;
        validate?: (value: unknown) => value is T;
      }) => Promise<T>;
    }
  ).fetchWordPressJsonWithFreshRetry;

  assert.equal(typeof fetchJsonWithFreshRetry, 'function');

  let requestCount = 0;
  const fetchImpl: typeof fetch = async (_input, init) => {
    requestCount += 1;
    return init?.cache === 'no-store'
      ? Response.json([{ id: 27309, slug: 'kentpark-avm' }])
      : Response.json({ code: 'corrupt-cache-shape' });
  };

  const isPostList = (value: unknown): value is Array<{ id: number; slug: string }> => (
    Array.isArray(value)
    && value.every((item) => (
      typeof item === 'object'
      && item !== null
      && typeof item.id === 'number'
      && typeof item.slug === 'string'
    ))
  );

  const posts = await fetchJsonWithFreshRetry!<Array<{ id: number; slug: string }>>({
    url: 'https://cms.example.test/wp-json/wp/v2/posts?slug=kentpark-avm',
    revalidateSeconds: 3600,
    fetchImpl,
    validate: isPostList,
  });

  assert.deepEqual(posts, [{ id: 27309, slug: 'kentpark-avm' }]);
  assert.equal(requestCount, 2);
});

test('loads every WordPress category through bounded 50-item pages', async (t) => {
  const requests: string[] = [];
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host}`);
    requests.push(url.search);

    if (url.searchParams.get('per_page') !== '50') {
      response.writeHead(502, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ message: 'large category request rejected' }));
      return;
    }

    response.setHeader('content-type', 'application/json');
    response.setHeader('X-WP-TotalPages', '2');
    const page = url.searchParams.get('page');
    response.end(JSON.stringify(page === '1'
      ? [{ id: 10, name: 'Ulaşım Rehberi', slug: 'ulasim-rehberi', description: '', count: 1, parent: 0 }]
      : [{ id: 11, name: 'İlçeler', slug: 'ilceler', description: '', count: 1, parent: 10 }]));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const categories = await fetchAllWordPressCategories({
    endpoint: `http://127.0.0.1:${address.port}/categories`,
  });

  assert.deepEqual(requests, [
    '?per_page=50&page=1&hide_empty=true&_fields=id%2Cname%2Cslug%2Cdescription%2Ccount%2Cparent',
    '?per_page=50&page=2&hide_empty=true&_fields=id%2Cname%2Cslug%2Cdescription%2Ccount%2Cparent',
  ]);
  assert.deepEqual(categories.map((category) => category.id), [10, 11]);
});

test('retries a poisoned cached category page with no-store before returning an empty category list', async () => {
  const requestModes: string[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    requestModes.push(init?.cache === 'no-store' ? 'fresh' : 'cached');

    if (init?.cache !== 'no-store') {
      return new Response('{"truncated":', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-WP-TotalPages': '1',
        },
      });
    }

    return Response.json([
      {
        id: 37,
        name: 'Ulaşım Rehberi',
        slug: 'ulasim-rehberi',
        description: '',
        count: 335,
        parent: 0,
      },
      {
        id: 38,
        name: 'AVMler',
        slug: 'avmler',
        description: '',
        count: 75,
        parent: 37,
      },
    ], {
      headers: { 'X-WP-TotalPages': '1' },
    });
  };

  const categories = await fetchAllWordPressCategories({
    endpoint: 'https://cms.example.test/wp-json/wp/v2/categories',
    fetchImpl,
    requestInit: { next: { revalidate: 3600 } },
  });

  assert.deepEqual(requestModes, ['cached', 'fresh']);
  assert.deepEqual(categories.map(({ id, parent }) => ({ id, parent })), [
    { id: 37, parent: 0 },
    { id: 38, parent: 37 },
  ]);
});

test('bypasses the Next data cache for WordPress upstream and preserves pagination metadata', async () => {
  let upstreamInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (_input, init) => {
    upstreamInit = init;
    return Response.json([
      { id: 37, name: 'Ulaşım Rehberi', slug: 'ulasim-rehberi', count: 335, parent: 0 },
    ], {
      headers: {
        'X-WP-Total': '28',
        'X-WP-TotalPages': '1',
      },
    });
  };

  const result = await fetchWordPressProxyPayload(
    'https://cms.example.test/wp-json/wp/v2/categories?per_page=50&page=1',
    fetchImpl,
  );

  assert.deepEqual(result, {
    data: [{ id: 37, name: 'Ulaşım Rehberi', slug: 'ulasim-rehberi', count: 335, parent: 0 }],
    total: '28',
    totalPages: '1',
  });
  assert.equal(upstreamInit?.cache, 'no-store');
  assert.equal('next' in (upstreamInit || {}), false);
});
