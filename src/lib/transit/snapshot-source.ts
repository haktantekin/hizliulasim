import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import * as zlib from 'node:zlib';
import {
  parseManifest,
  parseSnapshotPointer,
  TRANSIT_SCHEMA_VERSION,
  type TransitFileMetadata,
  type TransitManifest,
  type TransitSnapshotPointer,
} from './contracts.ts';
import { SnapshotCache } from './snapshot-cache.ts';

const mib = 1024 ** 2;
const maxPointerBytes = 4 * 1024;
const maxManifestBytes = 12 * mib;
const maxCompressedShardBytes = 24 * mib;
const maxUncompressedShardBytes = 64 * mib;
const maxJsonDepth = 64;
const maxJsonContainers = 500_000;
// Even a 64 MiB connection bucket with minimum-width fields has fewer than 3M commas.
const maxJsonCommas = 3_000_000;
const maxJsonStringLength = 64 * 1024;
const httpTimeoutMs = 10_000;
const contentLinksPath = 'content-links.json.gz';
const sha256Pattern = /^[a-f0-9]{64}$/;
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const inflateRaw = promisify(zlib.inflateRaw);
const manifestBytesCache = new SnapshotCache<Buffer>(4, 32 * mib);
const shardCache = new SnapshotCache<Buffer>(128, 64 * mib);
const snapshotStorage = Symbol('snapshotStorage');

type PointerName = 'current' | 'previous';
type StartupShardSelector = (manifest: TransitManifest) => readonly string[];

type SnapshotErrorCode = 'DATA_UNAVAILABLE' | 'INVALID_STORAGE_CONFIGURATION' | 'READ_FAILED' | 'SIZE_LIMIT' | 'INVALID_POINTER'
  | 'MANIFEST_HASH' | 'INVALID_MANIFEST' | 'UNDECLARED_SHARD' | 'SHARD_HASH' | 'INVALID_GZIP' | 'INVALID_SHARD'
  | 'JSON_COMPLEXITY';

const snapshotErrorMessages: Partial<Record<SnapshotErrorCode, string>> = {
  DATA_UNAVAILABLE: 'Transit snapshot data is unavailable',
  INVALID_STORAGE_CONFIGURATION: 'Transit snapshot storage is misconfigured',
};

export class TransitSnapshotError extends Error {
  readonly code: SnapshotErrorCode;

  constructor(code: SnapshotErrorCode) {
    super(snapshotErrorMessages[code] ?? `Transit snapshot validation failed (${code})`);
    this.name = 'TransitSnapshotError';
    this.code = code;
  }
}

interface SnapshotStorage {
  readonly cacheScope: string;
  readonly checkTime?: () => void;
  read(path: string, limit: number, immutable: boolean): Promise<Buffer>;
}

interface SnapshotReadOptions {
  checkTime?: () => void;
  signal?: AbortSignal;
}

interface SnapshotPreflightOptions extends SnapshotReadOptions {
  onFallback?: (reason: SnapshotErrorCode) => void;
}

export interface LoadedSnapshot {
  readonly pointer: Readonly<TransitSnapshotPointer>;
  readonly manifest: TransitManifest;
  readonly version: string;
  readonly usedFallback: boolean;
  readonly [snapshotStorage]: SnapshotStorage;
}

interface ShardMetadata extends TransitFileMetadata {
  uncompressedBytes?: number;
  uncompressedSha256?: string;
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function checkJsonComplexity(text: string): void {
  let depth = 0;
  let containers = 0;
  let commas = 0;
  let stringStart = -1;

  // Count containers and member separators. JSON.parse handles syntax.
  for (let offset = 0; offset < text.length; offset++) {
    const character = text[offset];
    if (stringStart !== -1) {
      if (offset - stringStart > maxJsonStringLength) throw new TransitSnapshotError('JSON_COMPLEXITY');
      if (character === '\\') offset++;
      else if (character === '"') stringStart = -1;
      continue;
    }
    switch (character) {
      case '"':
        stringStart = offset + 1;
        break;
      case '[':
      case '{':
        depth++;
        containers++;
        if (depth > maxJsonDepth || containers > maxJsonContainers) throw new TransitSnapshotError('JSON_COMPLEXITY');
        break;
      case ']':
      case '}':
        depth--;
        break;
      case ',':
        commas++;
        if (commas > maxJsonCommas) throw new TransitSnapshotError('JSON_COMPLEXITY');
        break;
    }
  }
}

function parseJson(bytes: Buffer): unknown {
  const text = decoder.decode(bytes);
  checkJsonComplexity(text);
  return JSON.parse(text);
}

async function readLocalFile(root: string, path: string, limit: number, checkTime?: () => void): Promise<Buffer> {
  // The local adapter assumes a trusted development/test tree. These checks catch aliases and file swaps.
  const filename = resolve(root, path);
  const fromRoot = relative(root, filename);
  if (fromRoot === '' || fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new TransitSnapshotError('READ_FAILED');
  }
  // Use bigint identities to retain the full inode/file ID on Windows and POSIX.
  checkTime?.();
  const candidate = await lstat(filename, { bigint: true });
  checkTime?.();
  if (!candidate.isFile() || candidate.ino === BigInt(0) || relative(filename, await realpath(filename)) !== '') {
    throw new TransitSnapshotError('READ_FAILED');
  }
  checkTime?.();
  const file = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    checkTime?.();
    const opened = await file.stat({ bigint: true });
    if (!opened.isFile() || opened.dev !== candidate.dev || opened.ino !== candidate.ino || opened.size !== candidate.size) {
      throw new TransitSnapshotError('READ_FAILED');
    }
    if (opened.size > BigInt(limit)) throw new TransitSnapshotError('SIZE_LIMIT');
    const size = Number(opened.size);
    const bytes = Buffer.allocUnsafe(size + 1);
    let offset = 0;
    while (offset < bytes.length) {
      checkTime?.();
      const { bytesRead } = await file.read(bytes, offset, bytes.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset !== size) throw new TransitSnapshotError('SIZE_LIMIT');
    return bytes.subarray(0, offset);
  } finally {
    await file.close();
  }
}

async function readHttpFile(base: URL, path: string, limit: number, immutable: boolean,
  { checkTime, signal }: SnapshotReadOptions): Promise<Buffer> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), httpTimeoutMs);
  try {
    checkTime?.();
    const response = await fetch(new URL(path, base), {
      cache: immutable ? 'default' : 'no-store',
      // Next's Data Cache buffers response clones before validation. Preserve origin/CDN caching for
      // versioned files and let the validated process cache reuse shard data within this instance.
      ...(immutable && { next: { revalidate: 0 } }),
      headers: { 'Accept-Encoding': 'identity', 'Cache-Control': immutable ? 'max-age=31536000' : 'no-cache' },
      redirect: 'error',
      signal: signal ? AbortSignal.any([abort.signal, signal]) : abort.signal,
    });
    const contentEncoding = response.headers.get('content-encoding');
    if (!response.ok || !response.body || (contentEncoding !== null && contentEncoding !== 'identity')) {
      throw new TransitSnapshotError('READ_FAILED');
    }
    const contentLength = response.headers.get('content-length');
    if (contentLength !== null && Number(contentLength) > limit) throw new TransitSnapshotError('SIZE_LIMIT');

    const reader = response.body.getReader();
    let bytes = Buffer.allocUnsafe(Math.min(limit, 64 * 1024));
    let length = 0;
    try {
      for (;;) {
        checkTime?.();
        const { done, value } = await reader.read();
        if (done) return bytes.subarray(0, length);
        const nextLength = length + value.byteLength;
        if (nextLength > limit) throw new TransitSnapshotError('SIZE_LIMIT');
        if (nextLength > bytes.length) {
          const grown = Buffer.allocUnsafe(Math.min(limit, Math.max(nextLength, bytes.length * 2)));
          bytes.copy(grown, 0, 0, length);
          bytes = grown;
        }
        bytes.set(value, length);
        length = nextLength;
      }
    } catch (error) {
      void reader.cancel().catch(() => {});
      throw error;
    } finally {
      reader.releaseLock();
    }
  } finally {
    clearTimeout(timer);
    abort.abort();
  }
}

// This module uses Node-only filesystem, crypto, and zlib imports and is a server entry point.
async function getStorage(options: SnapshotReadOptions = {}): Promise<SnapshotStorage> {
  const { checkTime } = options;
  checkTime?.();
  const local = process.env.TRANSIT_DATA_STORAGE_PATH?.trim();
  if (local && process.env.NODE_ENV === 'production') {
    throw new TransitSnapshotError('INVALID_STORAGE_CONFIGURATION');
  }
  try {
    if (local) {
      const root = await realpath(resolve(local));
      return { cacheScope: `file:${root}`, checkTime, read: (path, limit) => readLocalFile(root, path, limit, checkTime) };
    }
    const base = new URL(process.env.TRANSIT_DATA_BASE_URL ?? '');
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
      throw new TransitSnapshotError('DATA_UNAVAILABLE');
    }
    if (!base.pathname.endsWith('/')) base.pathname += '/';
    return {
      cacheScope: base.href,
      checkTime,
      read: (path, limit, immutable) => readHttpFile(base, path, limit, immutable, options),
    };
  } catch {
    throw new TransitSnapshotError('DATA_UNAVAILABLE');
  }
}

async function readAsset(storage: SnapshotStorage, path: string, limit: number, immutable: boolean): Promise<Buffer> {
  storage.checkTime?.();
  const bytes = await storage.read(path, limit, immutable).catch((error: unknown) => {
    storage.checkTime?.();
    if (error instanceof TransitSnapshotError) throw error;
    throw new TransitSnapshotError('READ_FAILED');
  });
  storage.checkTime?.();
  return bytes;
}

async function readPointer(storage: SnapshotStorage, name: PointerName): Promise<TransitSnapshotPointer> {
  if (name !== 'current' && name !== 'previous') throw new TransitSnapshotError('INVALID_POINTER');
  const bytes = await readAsset(storage, `${name}.json`, maxPointerBytes, false);
  try {
    return parseSnapshotPointer(parseJson(bytes));
  } catch (error) {
    if (error instanceof TransitSnapshotError) throw error;
    throw new TransitSnapshotError('INVALID_POINTER');
  }
}

export async function loadSnapshotPointer(name: PointerName): Promise<TransitSnapshotPointer> {
  return readPointer(await getStorage(), name);
}

function hasValidShardMetadata(file: ShardMetadata): boolean {
  if (file.bytes > maxCompressedShardBytes) return false;
  const { uncompressedBytes, uncompressedSha256 } = file;
  // Schema 1 producer manifests publish the compressed digest and size. When expanded
  // integrity metadata is supplied, require the complete pair and apply the same hard cap.
  if (!Object.hasOwn(file, 'uncompressedBytes') && !Object.hasOwn(file, 'uncompressedSha256')) return true;
  return typeof uncompressedBytes === 'number' && Number.isSafeInteger(uncompressedBytes)
    && uncompressedBytes > 0 && uncompressedBytes <= maxUncompressedShardBytes
    && typeof uncompressedSha256 === 'string' && sha256Pattern.test(uncompressedSha256);
}

function freezeManifest(manifest: TransitManifest): TransitManifest {
  const pending: object[] = [manifest];
  while (pending.length > 0) {
    const value = pending.pop()!;
    Object.freeze(value);
    for (const child of Object.values(value)) {
      if (child !== null && typeof child === 'object') pending.push(child);
    }
  }
  return manifest;
}

async function readManifest(storage: SnapshotStorage, pointer: TransitSnapshotPointer): Promise<TransitManifest> {
  const cacheKey = JSON.stringify([storage.cacheScope, pointer.version, pointer.manifestSha256]);
  let bytes = manifestBytesCache.get(cacheKey);
  if (!bytes) {
    bytes = await readAsset(storage, `versions/${pointer.version}/manifest.json`, maxManifestBytes, true);
    if (sha256(bytes) !== pointer.manifestSha256) throw new TransitSnapshotError('MANIFEST_HASH');
    manifestBytesCache.set(cacheKey, bytes, bytes.byteLength + 2 * cacheKey.length + 128);
  }
  let manifest: TransitManifest;
  try {
    manifest = parseManifest(parseJson(bytes));
  } catch (error) {
    if (error instanceof TransitSnapshotError) throw error;
    throw new TransitSnapshotError('INVALID_MANIFEST');
  }
  if (manifest.version !== pointer.version || !Object.values(manifest.files).every(hasValidShardMetadata)) {
    throw new TransitSnapshotError('INVALID_MANIFEST');
  }
  return freezeManifest(manifest);
}

export async function loadManifest(pointer: TransitSnapshotPointer): Promise<TransitManifest> {
  let validated: TransitSnapshotPointer;
  try {
    validated = parseSnapshotPointer(pointer);
  } catch {
    throw new TransitSnapshotError('INVALID_POINTER');
  }
  return readManifest(await getStorage(), validated);
}

function gzipCrc(bytes: Buffer): number {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(bytes);
  // Node 20 lacks zlib.crc32. Use the same IEEE CRC-32 polynomial for the gzip footer.
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
    table[index] = value;
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

async function expandShard(compressed: Buffer, metadata: ShardMetadata): Promise<Buffer> {
  // The PHP producer emits a fixed-size gzip header without optional fields and exactly one member.
  if (compressed.length < 20 || compressed.readUInt32BE() !== 0x1f8b0800) {
    throw new TransitSnapshotError('INVALID_GZIP');
  }
  const footer = compressed.length - 8;
  const deflateBytes = compressed.subarray(10, footer);
  const maxOutputLength = metadata.uncompressedBytes ?? maxUncompressedShardBytes;
  let expanded: Buffer;
  let consumed: number;
  try {
    // zlib returns the engine with info=true, but Node's inflateRaw declaration omits that overload.
    const result = await inflateRaw(deflateBytes, { info: true, maxOutputLength }) as unknown as {
      buffer: Buffer;
      engine: { bytesWritten: number };
    };
    expanded = result.buffer;
    consumed = result.engine.bytesWritten;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ERR_BUFFER_TOO_LARGE') {
      throw new TransitSnapshotError('SIZE_LIMIT');
    }
    throw new TransitSnapshotError('INVALID_GZIP');
  }
  if (consumed !== deflateBytes.length || expanded.length !== compressed.readUInt32LE(footer + 4)
    || gzipCrc(expanded) !== compressed.readUInt32LE(footer)) {
    throw new TransitSnapshotError('INVALID_GZIP');
  }
  if (metadata.uncompressedBytes !== undefined && expanded.length !== metadata.uncompressedBytes) {
    throw new TransitSnapshotError('SIZE_LIMIT');
  }
  if (metadata.uncompressedSha256 !== undefined && sha256(expanded) !== metadata.uncompressedSha256) {
    throw new TransitSnapshotError('SHARD_HASH');
  }
  return expanded;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function loadSnapshotShard<T>(snapshot: LoadedSnapshot, relativePath: string): Promise<T> {
  const storage = snapshot[snapshotStorage];
  storage.checkTime?.();
  // The captured manifest's own inventory keys have already passed the relative-path validator.
  if (!relativePath.endsWith('.json.gz') || !Object.hasOwn(snapshot.manifest.files, relativePath)) {
    throw new TransitSnapshotError('UNDECLARED_SHARD');
  }
  const key = JSON.stringify([storage.cacheScope, snapshot.version, snapshot.pointer.manifestSha256, relativePath]);
  const cached = shardCache.get(key);
  if (cached) return JSON.parse(decoder.decode(cached)) as T;

  const metadata = snapshot.manifest.files[relativePath];
  const compressed = await readAsset(storage, `versions/${snapshot.version}/${relativePath}`, metadata.bytes, true);
  if (compressed.length !== metadata.bytes) throw new TransitSnapshotError('SIZE_LIMIT');
  if (sha256(compressed) !== metadata.sha256) throw new TransitSnapshotError('SHARD_HASH');
  const expanded = await expandShard(compressed, metadata);
  storage.checkTime?.();
  let value: unknown;
  try {
    value = parseJson(expanded);
  } catch (error) {
    if (error instanceof TransitSnapshotError) throw error;
    throw new TransitSnapshotError('INVALID_SHARD');
  }
  if (!isRecord(value) || (relativePath === contentLinksPath
    && (value.schemaVersion !== TRANSIT_SCHEMA_VERSION || !isRecord(value.links)))) {
    throw new TransitSnapshotError('INVALID_SHARD');
  }
  // Cache private JSON buffers. Parsing again gives each caller its own mutable result.
  shardCache.set(key, expanded, expanded.buffer.byteLength + 2 * key.length + 128);
  return value as T;
}

async function readSnapshot(storage: SnapshotStorage, name: PointerName): Promise<LoadedSnapshot> {
  const pointer = Object.freeze(await readPointer(storage, name));
  const manifest = await readManifest(storage, pointer);
  return Object.freeze({
    pointer, manifest, version: pointer.version, usedFallback: name === 'previous', [snapshotStorage]: storage,
  });
}

function snapshotFailure(error: unknown): TransitSnapshotError {
  if (error instanceof TransitSnapshotError) return error;
  throw error;
}

async function attemptSnapshot(storage: SnapshotStorage, name: PointerName, selectShards: StartupShardSelector) {
  const snapshot = await readSnapshot(storage, name).catch(snapshotFailure);
  if (snapshot instanceof TransitSnapshotError) return snapshot;

  // The selector runs outside the storage error handling, even when it throws a snapshot error.
  const paths = new Set([contentLinksPath, ...selectShards(snapshot.manifest)]);
  try {
    for (const path of paths) await loadSnapshotShard(snapshot, path);
    return snapshot;
  } catch (error) {
    return snapshotFailure(error);
  }
}

/** Pin a snapshot after validating the shard paths needed to start this request. */
export async function loadActiveSnapshotWithPreflight(selectShards: StartupShardSelector,
  options: SnapshotPreflightOptions = {}): Promise<LoadedSnapshot> {
  const storage = await getStorage(options);
  const current = await attemptSnapshot(storage, 'current', selectShards);
  if (!(current instanceof TransitSnapshotError)) return current;

  const fallback = await attemptSnapshot(storage, 'previous', selectShards);
  if (fallback instanceof TransitSnapshotError) throw new TransitSnapshotError('DATA_UNAVAILABLE');
  if (options.onFallback) options.onFallback(current.code);
  else console.warn({ event: 'transit_snapshot_fallback', version: fallback.version, reason: current.code });
  return fallback;
}

export async function loadActiveSnapshot(): Promise<LoadedSnapshot> {
  return loadActiveSnapshotWithPreflight(() => []);
}

export function clearTransitSnapshotCacheForTests(): void {
  manifestBytesCache.clear();
  shardCache.clear();
}
