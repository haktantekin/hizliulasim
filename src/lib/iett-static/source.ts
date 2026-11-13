import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import * as zlib from 'node:zlib';
import { SnapshotCache } from '../transit/snapshot-cache.ts';
import {
  normalizeIettStaticCode,
  parseIettStaticDirectory,
  parseIettStaticLine,
  parseIettStaticManifest,
  parseIettStaticPointer,
  parseIettStaticStop,
  type IettStaticDirectory,
  type IettStaticFileMetadata,
  type IettStaticLine,
  type IettStaticManifest,
  type IettStaticPointer,
  type IettStaticStop,
} from './contracts.ts';

const mib = 1024 ** 2;
const maxPointerBytes = 4 * 1024;
const maxManifestBytes = 16 * mib;
const maxCompressedShardBytes = 16 * mib;
const maxExpandedShardBytes = 64 * mib;
const maxJsonDepth = 64;
const maxJsonContainers = 250_000;
const maxJsonCommas = 2_000_000;
const maxJsonStringLength = 64 * 1024;
const httpTimeoutMs = 10_000;
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const inflateRaw = promisify(zlib.inflateRaw);
const manifestCache = new SnapshotCache<Buffer>(4, 8 * mib);
const compressedCache = new SnapshotCache<Buffer>(32, 64 * mib);
const expandedCache = new SnapshotCache<Buffer>(16, 64 * mib);
const storageSymbol = Symbol('iettStaticStorage');

type PointerName = 'current' | 'previous';
type ErrorCode = 'DATA_UNAVAILABLE' | 'INVALID_STORAGE_CONFIGURATION' | 'READ_FAILED' | 'SIZE_LIMIT'
  | 'INVALID_POINTER' | 'MANIFEST_HASH' | 'INVALID_MANIFEST' | 'UNDECLARED_SHARD' | 'SHARD_HASH'
  | 'INVALID_GZIP' | 'INVALID_SHARD' | 'JSON_COMPLEXITY';

const errorMessages: Partial<Record<ErrorCode, string>> = {
  DATA_UNAVAILABLE: 'İETT static data is unavailable',
  INVALID_STORAGE_CONFIGURATION: 'İETT static storage is misconfigured',
};

export class IettStaticSourceError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode) {
    super(errorMessages[code] ?? `İETT static validation failed (${code})`);
    this.name = 'IettStaticSourceError';
    this.code = code;
  }
}

interface StaticStorage {
  readonly cacheScope: string;
  read(path: string, limit: number, immutable: boolean): Promise<Buffer>;
}

export interface LoadedIettStaticPackage {
  readonly pointer: Readonly<IettStaticPointer>;
  readonly manifest: IettStaticManifest;
  readonly version: string;
  readonly usedFallback: boolean;
  readonly [storageSymbol]: StaticStorage;
}

export interface LoadedIettStaticResource<T> {
  readonly data: T;
  readonly version: string;
  readonly generatedAt: string;
  readonly usedFallback: boolean;
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function checkJsonComplexity(text: string): void {
  let depth = 0;
  let containers = 0;
  let commas = 0;
  let stringStart = -1;
  for (let offset = 0; offset < text.length; offset++) {
    const character = text[offset];
    if (stringStart !== -1) {
      if (offset - stringStart > maxJsonStringLength) throw new IettStaticSourceError('JSON_COMPLEXITY');
      if (character === '\\') offset++;
      else if (character === '"') stringStart = -1;
      continue;
    }
    if (character === '"') stringStart = offset + 1;
    else if (character === '[' || character === '{') {
      depth++;
      containers++;
      if (depth > maxJsonDepth || containers > maxJsonContainers) {
        throw new IettStaticSourceError('JSON_COMPLEXITY');
      }
    } else if (character === ']' || character === '}') depth--;
    else if (character === ',' && ++commas > maxJsonCommas) throw new IettStaticSourceError('JSON_COMPLEXITY');
  }
}

function parseJson(bytes: Buffer): unknown {
  const text = decoder.decode(bytes);
  checkJsonComplexity(text);
  return JSON.parse(text);
}

async function readLocalFile(root: string, path: string, limit: number): Promise<Buffer> {
  const filename = resolve(root, path);
  const fromRoot = relative(root, filename);
  if (fromRoot === '' || fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new IettStaticSourceError('READ_FAILED');
  }
  const candidate = await lstat(filename, { bigint: true });
  if (!candidate.isFile() || candidate.ino === BigInt(0) || relative(filename, await realpath(filename)) !== '') {
    throw new IettStaticSourceError('READ_FAILED');
  }
  const file = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const opened = await file.stat({ bigint: true });
    if (!opened.isFile() || opened.dev !== candidate.dev || opened.ino !== candidate.ino || opened.size !== candidate.size) {
      throw new IettStaticSourceError('READ_FAILED');
    }
    if (opened.size > BigInt(limit)) throw new IettStaticSourceError('SIZE_LIMIT');
    const expected = Number(opened.size);
    const bytes = Buffer.allocUnsafe(expected + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await file.read(bytes, offset, bytes.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset !== expected) throw new IettStaticSourceError('SIZE_LIMIT');
    return bytes.subarray(0, offset);
  } finally {
    await file.close();
  }
}

async function readHttpFile(base: URL, path: string, limit: number, immutable: boolean): Promise<Buffer> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), httpTimeoutMs);
  try {
    const response = await fetch(new URL(path, base), {
      cache: immutable ? 'default' : 'no-store',
      ...(immutable && { next: { revalidate: 0 } }),
      headers: {
        'Accept-Encoding': 'identity',
        'Cache-Control': immutable ? 'max-age=31536000' : 'no-cache',
      },
      redirect: 'error',
      signal: abort.signal,
    });
    const encoding = response.headers.get('content-encoding');
    if (!response.ok || !response.body || (encoding !== null && encoding !== 'identity')) {
      throw new IettStaticSourceError('READ_FAILED');
    }
    const contentLength = response.headers.get('content-length');
    if (contentLength !== null && Number(contentLength) > limit) throw new IettStaticSourceError('SIZE_LIMIT');
    const reader = response.body.getReader();
    let bytes = Buffer.allocUnsafe(Math.min(limit, 64 * 1024));
    let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return bytes.subarray(0, length);
        const nextLength = length + value.byteLength;
        if (nextLength > limit) throw new IettStaticSourceError('SIZE_LIMIT');
        if (nextLength > bytes.length) {
          const grown = Buffer.allocUnsafe(Math.min(limit, Math.max(nextLength, bytes.length * 2)));
          bytes.copy(grown, 0, 0, length);
          bytes = grown;
        }
        bytes.set(value, length);
        length = nextLength;
      }
    } finally {
      reader.releaseLock();
    }
  } finally {
    clearTimeout(timer);
    abort.abort();
  }
}

async function getStorage(): Promise<StaticStorage> {
  const local = process.env.IETT_STATIC_STORAGE_PATH?.trim();
  if (local && process.env.NODE_ENV === 'production') {
    throw new IettStaticSourceError('INVALID_STORAGE_CONFIGURATION');
  }
  try {
    if (local) {
      const root = await realpath(resolve(local));
      return { cacheScope: `file:${root}`, read: (path, limit) => readLocalFile(root, path, limit) };
    }
    const base = new URL(process.env.IETT_STATIC_BASE_URL ?? '');
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
      throw new IettStaticSourceError('DATA_UNAVAILABLE');
    }
    if (!base.pathname.endsWith('/')) base.pathname += '/';
    return { cacheScope: base.href, read: (path, limit, immutable) => readHttpFile(base, path, limit, immutable) };
  } catch (error) {
    if (error instanceof IettStaticSourceError) throw error;
    throw new IettStaticSourceError('DATA_UNAVAILABLE');
  }
}

async function readAsset(storage: StaticStorage, path: string, limit: number, immutable: boolean): Promise<Buffer> {
  try {
    return await storage.read(path, limit, immutable);
  } catch (error) {
    if (error instanceof IettStaticSourceError) throw error;
    throw new IettStaticSourceError('READ_FAILED');
  }
}

async function readPointer(storage: StaticStorage, name: PointerName): Promise<IettStaticPointer> {
  try {
    return parseIettStaticPointer(parseJson(await readAsset(storage, `${name}.json`, maxPointerBytes, false)));
  } catch (error) {
    if (error instanceof IettStaticSourceError) throw error;
    throw new IettStaticSourceError('INVALID_POINTER');
  }
}

function freezeDeep<T>(root: T): T {
  const pending: object[] = [];
  if (root !== null && typeof root === 'object') pending.push(root);
  while (pending.length > 0) {
    const value = pending.pop()!;
    Object.freeze(value);
    for (const child of Object.values(value)) {
      if (child !== null && typeof child === 'object' && !Object.isFrozen(child)) pending.push(child);
    }
  }
  return root;
}

async function readManifest(storage: StaticStorage, pointer: IettStaticPointer): Promise<IettStaticManifest> {
  const cacheKey = JSON.stringify([storage.cacheScope, pointer.version, pointer.manifestSha256]);
  let bytes = manifestCache.get(cacheKey);
  if (!bytes) {
    bytes = await readAsset(storage, `versions/${pointer.version}/manifest.json`, maxManifestBytes, true);
    if (sha256(bytes) !== pointer.manifestSha256) throw new IettStaticSourceError('MANIFEST_HASH');
    manifestCache.set(cacheKey, bytes, bytes.length + cacheKey.length * 2 + 128);
  }
  try {
    const manifest = parseIettStaticManifest(parseJson(bytes));
    if (manifest.version !== pointer.version
      || Object.values(manifest.files).some((file) => file.bytes > maxCompressedShardBytes)) {
      throw new IettStaticSourceError('INVALID_MANIFEST');
    }
    return freezeDeep(manifest);
  } catch (error) {
    if (error instanceof IettStaticSourceError) throw error;
    throw new IettStaticSourceError('INVALID_MANIFEST');
  }
}

function updateCrc(value: number, bytes: Buffer): number {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(bytes, value);
  let crc = value ^ 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function expandGzip(compressed: Buffer): Promise<Buffer> {
  if (compressed.length < 20 || compressed.readUInt32BE() !== 0x1f8b0800) {
    throw new IettStaticSourceError('INVALID_GZIP');
  }
  const footer = compressed.length - 8;
  const deflated = compressed.subarray(10, footer);
  try {
    const result = await inflateRaw(deflated, {
      info: true,
      maxOutputLength: maxExpandedShardBytes,
    }) as unknown as { buffer: Buffer; engine: { bytesWritten: number } };
    const expanded = result.buffer;
    if (result.engine.bytesWritten !== deflated.length
      || expanded.length !== compressed.readUInt32LE(footer + 4)
      || updateCrc(0, expanded) !== compressed.readUInt32LE(footer)) {
      throw new IettStaticSourceError('INVALID_GZIP');
    }
    return expanded;
  } catch (error) {
    if (error instanceof IettStaticSourceError) throw error;
    if (error instanceof Error && 'code' in error && error.code === 'ERR_BUFFER_TOO_LARGE') {
      throw new IettStaticSourceError('SIZE_LIMIT');
    }
    throw new IettStaticSourceError('INVALID_GZIP');
  }
}

function shardKey(snapshot: LoadedIettStaticPackage, path: string): string {
  return JSON.stringify([
    snapshot[storageSymbol].cacheScope,
    snapshot.version,
    snapshot.pointer.manifestSha256,
    path,
  ]);
}

async function readShard(snapshot: LoadedIettStaticPackage, path: string): Promise<Buffer> {
  const metadata: IettStaticFileMetadata | undefined = snapshot.manifest.files[path];
  if (!path.endsWith('.json.gz') || metadata === undefined) throw new IettStaticSourceError('UNDECLARED_SHARD');
  const key = shardKey(snapshot, path);
  let expanded = expandedCache.get(key);
  if (expanded) return expanded;
  let compressed = compressedCache.get(key);
  if (!compressed) {
    compressed = await readAsset(
      snapshot[storageSymbol],
      `versions/${snapshot.version}/${path}`,
      metadata.bytes,
      true,
    );
    if (compressed.length !== metadata.bytes) throw new IettStaticSourceError('SIZE_LIMIT');
    if (sha256(compressed) !== metadata.sha256) throw new IettStaticSourceError('SHARD_HASH');
    compressedCache.set(key, compressed, compressed.length + key.length * 2 + 128);
  }
  expanded = await expandGzip(compressed);
  expandedCache.set(key, expanded, expanded.length + key.length * 2 + 128);
  return expanded;
}

function parseShard<T>(bytes: Buffer, parser: (value: unknown) => T): T {
  try {
    return freezeDeep(parser(parseJson(bytes)));
  } catch (error) {
    if (error instanceof IettStaticSourceError) throw error;
    throw new IettStaticSourceError('INVALID_SHARD');
  }
}

async function readPackage(storage: StaticStorage, name: PointerName): Promise<LoadedIettStaticPackage> {
  const pointer = Object.freeze(await readPointer(storage, name));
  const manifest = await readManifest(storage, pointer);
  return Object.freeze({
    pointer,
    manifest,
    version: pointer.version,
    usedFallback: name === 'previous',
    [storageSymbol]: storage,
  });
}

async function readDirectory(snapshot: LoadedIettStaticPackage): Promise<IettStaticDirectory> {
  return parseShard(await readShard(snapshot, snapshot.manifest.indexes.directory), parseIettStaticDirectory);
}

async function attempt<T>(storage: StaticStorage, name: PointerName,
  operation: (snapshot: LoadedIettStaticPackage) => Promise<T>): Promise<T | IettStaticSourceError> {
  try {
    return await operation(await readPackage(storage, name));
  } catch (error) {
    if (error instanceof IettStaticSourceError) return error;
    throw error;
  }
}

async function withFallback<T>(operation: (snapshot: LoadedIettStaticPackage) => Promise<T>): Promise<T> {
  const storage = await getStorage();
  const current = await attempt(storage, 'current', operation);
  if (!(current instanceof IettStaticSourceError)) return current;
  const previous = await attempt(storage, 'previous', operation);
  if (previous instanceof IettStaticSourceError) throw new IettStaticSourceError('DATA_UNAVAILABLE');
  console.warn({ event: 'iett_static_fallback', version: 'previous', reason: current.code });
  return previous;
}

function resource<T>(snapshot: LoadedIettStaticPackage, data: T): LoadedIettStaticResource<T> {
  return Object.freeze({
    data,
    version: snapshot.version,
    generatedAt: snapshot.manifest.generatedAt,
    usedFallback: snapshot.usedFallback,
  });
}

export async function loadActiveIettStaticPackage(): Promise<LoadedIettStaticPackage> {
  return withFallback(async (snapshot) => {
    await readDirectory(snapshot);
    return snapshot;
  });
}

export async function loadIettStaticDirectory(): Promise<LoadedIettStaticResource<IettStaticDirectory>> {
  return withFallback(async (snapshot) => resource(snapshot, await readDirectory(snapshot)));
}

export async function loadIettStaticLine(code: string): Promise<LoadedIettStaticResource<IettStaticLine> | null> {
  const normalized = normalizeIettStaticCode(code);
  if (normalized === null) return null;
  return withFallback(async (snapshot) => {
    await readDirectory(snapshot);
    const path = snapshot.manifest.indexes.lines[normalized];
    if (path === undefined) return null;
    const data = parseShard(await readShard(snapshot, path), parseIettStaticLine);
    if (data.line.SHATKODU !== normalized) throw new IettStaticSourceError('INVALID_SHARD');
    return resource(snapshot, data);
  });
}

export async function loadIettStaticStop(code: string): Promise<LoadedIettStaticResource<IettStaticStop> | null> {
  if (!/^[0-9]{1,12}$/.test(code)) return null;
  return withFallback(async (snapshot) => {
    await readDirectory(snapshot);
    const path = snapshot.manifest.indexes.stops[code];
    if (path === undefined) return null;
    const data = parseShard(await readShard(snapshot, path), parseIettStaticStop);
    if (data.stop.SDPICARETNO !== code) throw new IettStaticSourceError('INVALID_SHARD');
    return resource(snapshot, data);
  });
}

export function clearIettStaticCacheForTests(): void {
  manifestCache.clear();
  compressedCache.clear();
  expandedCache.clear();
}
