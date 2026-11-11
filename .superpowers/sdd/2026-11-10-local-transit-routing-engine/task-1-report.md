# Task 1 — Transit snapshot and itinerary contracts

Implemented the shared transit contracts and dependency-free runtime parsers in `src/lib/transit/contracts.ts`.

- The pointer accepts exactly `version` and `manifestSha256`. The manifest accepts schema 1, checks metadata and the shard inventory, and verifies that index paths point to declared files. Service classes preserve GTFS weekday flags, date exceptions, numeric IDs as string keys, and after-midnight connection buckets.
- The manifest accepts historical source metadata without a provenance marker. When the producer declares provenance version 2, the parser requires source digests, byte sizes and core table counts and checks that primary source fields match `stop_times`.
- Route requests use inclusive İstanbul coordinate bounds, a timezone-qualified ISO departure and one of the three public preferences. Departure is returned as a `Date`. Each required parameter appears once and is limited to 64 characters. The optional clock argument makes the seven-day horizon deterministic, and the snapshot calendar can independently decide whether the requested departure has service.
- Itinerary types use discriminated walk and ride steps, all requested modes, `exact` and `approximate` geometry, and the producer's `{ title, canonicalUrl }` pair for optional boarding-point links.

The reduced TypeScript fixture follows the JSON emitted by `D:/git/cmshizliulasim/transit-data/snapshot-builder.php`, the producer metadata validators in `transit-data/contracts.php` and the numeric-ID, after-midnight and exception cases in `tests/transit-data-snapshot-builder.test.php`. Its file sizes and hashes are placeholders because these parsers validate metadata. Reading files and verifying their actual digests belongs to the snapshot reader.

## Verification

| Check | Result |
| --- | --- |
| `node --test src/lib/transit/contracts.test.ts` before implementation | Exit 1, `ERR_MODULE_NOT_FOUND` for the absent contract module. [RED output](task-1-red.log) |
| `node --test src/lib/transit/contracts.test.ts` after implementation | 21 passed, 0 failed. [GREEN output](task-1-green.log) |
| `npx tsc --noEmit` | Exit 0. [TypeScript output](task-1-typecheck.log) |
| `npx eslint src/lib/transit` | Exit 0. |
| `node --test` | 70 passed, 2 failed. The tracked-test rerun reproduced both failures. [Suite output](task-1-suite.log) |

The two baseline failures are the cache source-text assertion in `src/lib/minibusDirectory.test.ts` and the `fetch failed` error in `src/lib/wordpressCategories.test.ts`. Node 22 reports the repository's package-module warning during direct TypeScript tests.
