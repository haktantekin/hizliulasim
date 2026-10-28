import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function buildNextNodeArgs({ nextBin, command, args }) {
  return [nextBin, command, ...args];
}

export function buildNextEnvironment({ command, supportsSystemCa, env }) {
  return {
    ...env,
    ...(supportsSystemCa && command !== 'build' ? { NODE_USE_SYSTEM_CA: '1' } : {}),
  };
}

async function run() {
  const command = process.argv[2];
  if (!['dev', 'build', 'start'].includes(command)) {
    throw new Error('Kullanım: node scripts/run-next.mjs <dev|build|start> [...next args]');
  }

  const nextBin = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
  const nodeArgs = buildNextNodeArgs({
    nextBin,
    command,
    args: process.argv.slice(3),
  });
  const supportsSystemCa = process.allowedNodeEnvironmentFlags.has('--use-system-ca');

  const exitCode = await new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, nodeArgs, {
      stdio: 'inherit',
      env: buildNextEnvironment({ command, supportsSystemCa, env: process.env }),
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }
      resolveExit(code ?? 1);
    });
  });
  process.exitCode = exitCode;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  await run();
}
