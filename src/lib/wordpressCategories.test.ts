import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import test from 'node:test';

import { fetchAllWordPressCategories } from './wordpressCategories.ts';

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
