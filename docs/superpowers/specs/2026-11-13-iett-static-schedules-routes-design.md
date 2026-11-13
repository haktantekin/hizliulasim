# İETT Static Schedules and Routes Design

## Goal

Serve public bus lines, stops, planned timetables, and route paths without any request-time İETT dependency. İETT is contacted only by the WordPress synchronization job; the frontend reads a verified, immutable package.

## Source boundary

- Lines come from the bulk `GetHat_json` SOAP response.
- Route stops and their order come from the bulk `DurakDetay_GYY_wYonAdi` SOAP response.
- Planned timetables come from `GetPlanlananSeferSaati_json`. The method requires a line code, so synchronization downloads one bounded artifact per normalized public line.
- Route geometry comes from the already verified transit snapshot's official shape shards. If no exact shape resolves to a line and direction, the ordered İETT stop coordinates remain an explicitly approximate path.
- Live vehicle positions and live alerts stay outside this package. Live vehicles keep their existing member-only policy.

## Synchronization

The CMS worker adds a resumable schedule-download phase after line and stop downloads. Each invocation processes a small bounded batch, writes immutable per-line response artifacts and metadata, and advances a durable cursor. Re-running the worker reuses artifacts only after size and SHA-256 verification.

Normalization rejects malformed SOAP, unknown line codes, conflicting duplicates, invalid directions/day types/times, unsafe files, and unbounded responses. The materializer joins schedules and route geometry to line shards. Only a complete package proceeds to staging, full verification, and atomic publication.

An incomplete or failed synchronization never changes `current.json`. The previous verified package continues serving users.

## Package contract

The manifest schema advances to version 2 and records provenance for line, stop, schedule, and transit-shape sources. Each line shard contains:

- normalized line metadata;
- İETT planned timetable records;
- ordered İETT route stops;
- zero or more direction-specific route paths with `exact` or `approximate` quality.

All compressed assets retain byte counts and SHA-256 digests. Current and previous packages are never mixed.

Readers and rollback verification remain compatible with an already-published schema-1 package during deployment. New synchronization jobs publish only schema 2.

## Frontend behavior

The public line, stop, timetable, nearest-stop, and route-path APIs read only the local static package. The legacy runtime İETT fallback is removed from those flows. If current is invalid, the reader retries the complete operation against previous. If neither is usable, the route returns a sanitized `503 DATA_UNAVAILABLE`; it never calls İETT.

The bus detail map uses the stored direction path when available. During schema-1 compatibility, a missing path falls back only to the shard's stored ordered stop coordinates and is labelled approximate with a dashed line. UI freshness labels expose current or previous package state but no longer expose a legacy state.

## Operations

Run the sync weekly and after known timetable revisions. The admin progress display includes schedule batch progress. Operators can safely stop and resume before publication. Existing current data remains available throughout downloading, validation, and failures.

## Acceptance criteria

- A public page request cannot reach the İETT line, stop, schedule, or route endpoints.
- A schedule sync interruption resumes from verified per-line artifacts.
- A missing, malformed, or incomplete schedule response prevents publication.
- Every published schedule belongs to its line shard and every route path resolves to that line and direction.
- Current corruption falls back only to the complete previous package.
- When both packages are unusable, the frontend returns a controlled 503 with no upstream call.
