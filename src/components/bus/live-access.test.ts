import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const callers = [
  'src/components/bus/BusRouteDetailClient.tsx',
  'src/components/bus/NearestStopAssistant.tsx',
  'src/components/home/HomeBusFinder.tsx',
];

test('every live vehicle caller checks authenticated state before polling', async () => {
  for (const filename of callers) {
    const source = await readFile(filename, 'utf8');
    assert.match(source, /api\/iett\/konum/);
    assert.match(source, /if \([^)]*!isAuthenticated[^)]*\) return;/, filename);
    assert.match(source, /credentials: 'include'/, filename);
  }
});

test('session restoration asks the server because the auth cookie is httpOnly', async () => {
  const source = await readFile('src/components/providers/ReduxProvider.tsx', 'utf8');
  assert.doesNotMatch(source, /document\.cookie/);
  assert.match(source, /fetch\('\/api\/auth\/me', \{ credentials: 'include' \}\)/);
});
