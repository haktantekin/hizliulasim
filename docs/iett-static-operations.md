# İETT static bus data operations

The public bus catalogue uses a separate immutable package for lines, stops, planned departures, and route geometry. WordPress builds it after the verified transit package is published. Public reads use only `current.json` or the complete `previous.json` package; they never call an İETT runtime fallback.

## Data boundary

The package serves these public features without an İETT request on each visit:

- bus-line list, search, and line metadata;
- planned departures downloaded from İETT for every line;
- ordered route stops and direction-aware route geometry;
- stop detail, passing lines, and nearest-stop lookup;
- bus entries in site search, sitemap, and IndexNow.

`/api/iett/konum` remains a separate member-only live-vehicle endpoint. `/api/iett/duyurular` remains the live alerts endpoint. Planned departures are labelled **Planlanan**; they are not live arrivals.

## Package layout and integrity

```text
current.json
previous.json
versions/<version>/manifest.json
versions/<version>/directory.json.gz
versions/<version>/lines/<sha256(line-code)>.json.gz
versions/<version>/stops/<sha256(stop-code)>.json.gz
```

Schema 2 line shards contain `schedules`, ordered `stops`, and at most one `D` and one `G` path. Exact geometry comes from the matching verified transit shape. When no exact shape exists, the producer stores an explicitly `approximate` path made from the ordered İETT stops.

Every pointer identifies a manifest SHA-256. The manifest inventories every gzip shard with its exact byte count and SHA-256. It also records:

- the bulk line and stop SOAP artifacts;
- one bounded schedule artifact per exact line code;
- the verified transit-package pointer used for route geometry;
- total line, stop, schedule, line-stop, and path counts.

The frontend validates the pointer, manifest, provenance, gzip member, and payload contract. A broken current package causes the complete request to retry against `previous.json`; current and previous shards are never mixed. If neither package is valid, public static routes return `503 {"error":"DATA_UNAVAILABLE"}` and do not contact İETT.

## Configuration

Production frontend:

```dotenv
IETT_STATIC_BASE_URL=https://cms.hizliulasim.com/wp-content/uploads/hizliulasim-iett-static/
```

The variable is server-only. Do not expose it as `NEXT_PUBLIC_*`. Production requires HTTPS. Local development and tests may use `IETT_STATIC_STORAGE_PATH`; production deliberately rejects a local path.

CMS defaults to `wp_upload_dir()/hizliulasim-iett-static`. Optional overrides are:

- PHP constants `HIZLIULASIM_IETT_STATIC_STORAGE_PATH` and `HIZLIULASIM_IETT_STATIC_PUBLIC_BASE_URL`;
- environment variables `IETT_STATIC_STORAGE_PATH` and `IETT_STATIC_BASE_URL`.

The work directory and publication root must be on the same filesystem because installation uses atomic rename. Serve mutable pointers with `no-cache` or a very short TTL. Serve `versions/*` with long-lived immutable caching without modifying inventoried bytes.

## Refresh, resume, and cancellation

Run **Toplu Ulaşım Veri Eşitleme** once a week and after a known İETT timetable or route revision. A static refresh does not make live vehicles or alerts more current.

The bus stages are:

1. bulk line download;
2. bulk stop download;
3. line and stop normalization;
4. per-line planned-departure download in bounded batches;
5. exact or approximate route-path derivation;
6. schema-2 staging;
7. full validation;
8. atomic publication.

The panel shows the durable timetable cursor as `completed lines / total lines` and the number of parsed departures. It is normal for this phase to require many background worker invocations. **Sürdür** resumes from the saved cursor and reuses already verified artifacts; it does not restart completed lines.

Cancellation is safe before publication: the worker receives a cancellation marker, the unpublished work tree is cleaned, and `current.json` remains unchanged. Cancellation is disabled during bus publication. Never delete an active work directory or hand-edit a checkpoint.

## First schema-2 production run

Deploy the CMS producer first, then start one complete sync. Before deploying or enabling the new frontend reader, verify all of the following:

- the panel reaches `Tamamlandı` and the timetable cursor equals its total;
- the active bus manifest has `schemaVersion: 2`;
- `source.schedules` contains one unique entry for every line in the line index;
- counts for `lines`, `stops`, `schedules`, and `paths` are nonzero and plausible;
- representative D/G line shards contain planned departures and geometry;
- `current.json` and its manifest are accessible over the exact production HTTPS origin;
- a previous schema-1 package, if present, remains readable until schema 2 publishes.

Only after those checks set `IETT_STATIC_BASE_URL` and deploy the frontend. This order prevents a frontend deployment from depending on a package that does not yet exist.

## Publication and rollback

For rollback, with no active sync, run an operator script inside the real WordPress context that obtains `hizliulasim_iett_static_with_lock()`, verifies `previous` with `hizliulasim_iett_static_verify_pointer()`, and atomically installs it as `current` with `hizliulasim_iett_static_install_pointer()`. Check every `WP_Error`. Do not edit pointer JSON manually or modify immutable version directories.

After publication or rollback, verify:

- current and previous pointers resolve to complete, independently valid packages;
- manifest and representative line/stop shard hashes match;
- mutable and immutable cache headers are correct;
- `/api/iett/hatlar`, `/sefer-saatleri`, `/durak-detay`, `/guzergah`, `/durak`, `/durak-hatlar`, and `/yakin-durak` report `iett-current` or `iett-previous`;
- an unavailable package returns sanitized 503 instead of contacting İETT;
- `/api/iett/konum` remains a separate authenticated live call.

## Verification commands

Frontend focused checks:

```powershell
node --test src/lib/iett-static/contracts.test.ts src/lib/iett-static/source.test.ts src/services/iett-static.test.ts src/app/api/iett/static-routes.test.ts src/lib/iett-static/presentation.test.ts src/components/bus/route-path.test.ts
npx tsc --noEmit
npm run build
```

CMS focused checks, from a shell with the repository mounted at `/app`:

```sh
php tests/transit-data-iett-static-source.test.php
php tests/transit-data-iett-static-materializer.test.php
php tests/transit-data-iett-static-publisher.test.php
php tests/transit-data-checkpoint.test.php
php tests/transit-data-sync-admin.test.php
```

Fixture tests prove contracts and recovery behavior; they do not prove the live host's filesystem atomicity, cache headers, source availability, or first real schema-2 package. Record those checks separately during the production run.
