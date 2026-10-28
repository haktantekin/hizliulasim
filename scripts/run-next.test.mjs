import assert from 'node:assert/strict';
import test from 'node:test';

import * as runNext from './run-next.mjs';

test('does not pass the system CA as a worker-incompatible Node flag', () => {
  assert.deepEqual(
    runNext.buildNextNodeArgs({
      supportsSystemCa: true,
      nextBin: 'next-bin',
      command: 'build',
      args: ['--webpack'],
    }),
    ['next-bin', 'build', '--webpack'],
  );
});

test('enables the system CA through the environment for runtime commands', () => {
  assert.deepEqual(
    runNext.buildNextEnvironment({ command: 'dev', supportsSystemCa: true, env: { EXISTING: 'preserved' } }),
    { EXISTING: 'preserved', NODE_USE_SYSTEM_CA: '1' },
  );
});

test('leaves the environment unchanged for builds and unsupported Node versions', () => {
  assert.deepEqual(
    runNext.buildNextEnvironment({ command: 'build', supportsSystemCa: true, env: { EXISTING: 'preserved' } }),
    { EXISTING: 'preserved' },
  );
  assert.deepEqual(
    runNext.buildNextEnvironment({ command: 'dev', supportsSystemCa: false, env: { EXISTING: 'preserved' } }),
    { EXISTING: 'preserved' },
  );
});
