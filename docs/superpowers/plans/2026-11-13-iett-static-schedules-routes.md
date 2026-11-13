# İETT Static Schedules and Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish İETT planned timetables and bus route paths in the verified static package and eliminate request-time İETT fallback for public bus data.

**Architecture:** The WordPress worker downloads schedules per line in resumable bounded batches, joins them with ordered stops and verified transit shapes, and atomically publishes manifest schema 2. The Next.js reader validates the new contract and serves current/previous packages only; unavailable packages fail closed with a sanitized 503.

**Tech Stack:** PHP 8 WordPress worker and tests, SOAP/XML/JSON, immutable gzip/JSON packages, TypeScript 6, Next.js 16 route handlers, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-13-iett-static-schedules-routes-design.md`

## Global Constraints

- No public line, stop, timetable, nearest-stop, or route-path request may call İETT at runtime.
- Preserve whole-package current-to-previous fallback; never mix shards across versions.
- Preserve the existing member-only live vehicle behavior.
- Keep the existing verified current package active until a complete replacement publishes atomically.
- Do not run React Doctor.

## Review Focus

- A schedule response for the wrong line must be rejected before publication.
- Partial batch completion must resume without redownloading verified artifacts.
- Empty or malformed schedule results must retain the previous published package.
- Missing exact geometry must produce only a marked approximate stop path.
- Package unavailability must return 503 without invoking any legacy provider.

---

### Task 1: Resumable İETT timetable source

**Files:**
- Modify: `D:/git/cmshizliulasim/transit-data/iett-static-source.php`
- Modify: `D:/git/cmshizliulasim/transit-data/checkpoint.php`
- Modify: `D:/git/cmshizliulasim/transit-data/iett-static-worker.php`
- Test: `D:/git/cmshizliulasim/tests/transit-data-iett-static-source.test.php`
- Test: `D:/git/cmshizliulasim/tests/transit-data-checkpoint.test.php`

**Interfaces:**
- Consumes: normalized line records with `SHATKODU`.
- Produces: `hizliulasim_iett_static_parse_schedules_response(string $xml, string $lineCode, array $options = []): array|WP_Error` and durable `download_schedules` batch state/artifacts.

- [x] **Step 1: Write failing source tests** for valid normalization, required line match, duplicate/conflicting records, invalid time/day/direction, empty response, and bounded response size/count.
- [x] **Step 2: Run** `php D:/git/cmshizliulasim/tests/transit-data-iett-static-source.test.php` and confirm the new assertions fail.
- [x] **Step 3: Implement** the line-parameterized SOAP source and strict schedule parser; persist one verified response and metadata artifact per normalized line code.
- [x] **Step 4: Write failing checkpoint tests** for batch cursor, verified-artifact reuse, resume, and transition only after every line completes.
- [x] **Step 5: Implement** `download_schedules` as bounded worker batches that retain per-line SHA-256/byte provenance and refuse incomplete completion.
- [x] **Step 6: Run** the two focused PHP tests and confirm PASS.

### Task 2: Static route geometry and manifest schema 2

**Files:**
- Modify: `D:/git/cmshizliulasim/transit-data/iett-static-materializer.php`
- Modify: `D:/git/cmshizliulasim/transit-data/iett-static-contracts.php`
- Modify: `D:/git/cmshizliulasim/transit-data/iett-static-publisher.php`
- Modify: `D:/git/cmshizliulasim/transit-data/iett-static-worker.php`
- Test: `D:/git/cmshizliulasim/tests/transit-data-iett-static-materializer.test.php`
- Test: `D:/git/cmshizliulasim/tests/transit-data-iett-static-publisher.test.php`

**Interfaces:**
- Consumes: normalized schedules, route stops, and the active verified transit manifest/shape shards.
- Produces: line shards with `paths: Array<{ direction: 'D'|'G'; quality: 'exact'|'approximate'; coordinates: [number, number][] }>` and schema-2 source provenance.

- [x] **Step 1: Write failing materializer tests** for schedule grouping, exact direction geometry, approximate ordered-stop fallback, unknown references, and conflicting paths.
- [x] **Step 2: Run** the materializer test and confirm FAIL.
- [x] **Step 3: Replace** GTFS timetable derivation with parsing of verified İETT schedule artifacts; add bounded transit shape resolution and approximate fallback.
- [x] **Step 4: Write failing contract/publisher tests** for schema 2, schedule provenance, path inventory validation, counts, hashes, and cross-line/direction rejection.
- [x] **Step 5: Implement** schema-2 contract, staging, verification, and atomic publication updates.
- [x] **Step 6: Run** the focused materializer and publisher tests and confirm PASS.

### Task 3: Fail-closed Next.js static reader

**Files:**
- Modify: `src/lib/iett-static/contracts.ts`
- Modify: `src/lib/iett-static/source.ts`
- Modify: `src/services/iett-static.ts`
- Modify: `src/app/api/iett/static-routes.test.ts`
- Test: `src/lib/iett-static/contracts.test.ts`
- Test: `src/lib/iett-static/source.test.ts`
- Test: `src/services/iett-static.test.ts`

**Interfaces:**
- Consumes: schema-2 current/previous packages.
- Produces: verified static results including line paths, or `IettStaticUnavailableError`; no legacy provider dependency.

- [x] **Step 1: Write failing TypeScript tests** for schema-2 paths/provenance and rejection of malformed, cross-line, oversized, or duplicate paths.
- [x] **Step 2: Write failing service/route tests** proving unavailable packages never call legacy line, stop, schedule, route-stop, passing-line, or nearest-stop providers and map to sanitized 503 responses.
- [x] **Step 3: Run** `node --test src/lib/iett-static/contracts.test.ts src/lib/iett-static/source.test.ts src/services/iett-static.test.ts src/app/api/iett/static-routes.test.ts` and confirm FAIL.
- [x] **Step 4: Implement** schema-2 parsing and remove the shared legacy fallback/cache from public static service methods.
- [x] **Step 5: Update** public route handlers to map local package unavailability to `503 {"error":"DATA_UNAVAILABLE"}` while preserving current/previous freshness headers.
- [x] **Step 6: Run** the focused TypeScript tests and confirm PASS.

### Task 4: Bus detail map and freshness presentation

**Files:**
- Modify: `src/components/bus/BusRouteDetailClient.tsx`
- Modify: `src/components/bus/RouteMap.tsx`
- Modify: `src/lib/iett-static/presentation.ts`
- Test: `src/lib/iett-static/presentation.test.ts`
- Test: `src/components/bus/route-path.test.ts`

**Interfaces:**
- Consumes: stored line `paths`, ordered stops, and current/previous metadata.
- Produces: a direction-aware path model rendered by `RouteMap`, with approximate geometry explicitly dashed.

- [x] **Step 1: Write failing tests** selecting the matching direction path, falling back only to stored ordered stops, and removing the legacy freshness label.
- [x] **Step 2: Run** the focused tests and confirm FAIL.
- [x] **Step 3: Implement** path selection/presentation and pass the stored geometry to the existing map component without changing live vehicle behavior.
- [x] **Step 4: Run** the focused tests and confirm PASS.

### Task 5: Admin progress, operations, and verification

**Files:**
- Modify: `D:/git/cmshizliulasim/transit-data/sync-admin.php`
- Modify: `D:/git/cmshizliulasim/tests/transit-data-sync-admin.test.php`
- Modify: `docs/iett-static-operations.md`

**Interfaces:**
- Consumes: schedule batch cursor/counts and schema-2 manifest.
- Produces: operator-visible schedule progress and deployment/runbook instructions.

- [x] **Step 1: Write failing admin tests** for schedule batch progress, safe resume, cancellation before publication, and no runtime fallback copy.
- [x] **Step 2: Implement** progress/status mapping and update the runbook with weekly sync, resume, strict failure, and first-production-package checks.
- [x] **Step 3: Run** all focused PHP tests for source, checkpoint, materializer, publisher, and admin; confirm PASS.
- [x] **Step 4: Run** all focused TypeScript tests, `npx tsc --noEmit`, focused ESLint, and `npm run build`; confirm PASS.
- [x] **Step 5: Record** the known sandbox-only localhost WordPress category test failure separately if the full Node suite still cannot bind/fetch loopback; do not misreport it as a feature failure or PASS.
