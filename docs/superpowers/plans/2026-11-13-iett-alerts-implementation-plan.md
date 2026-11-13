# İETT Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ortak cache'li İETT uyarılarını genel header ve tam eşleşen otobüs hat detaylarında göstermek.

**Architecture:** WordPress İETT SOAP kaynağını doğrular, beş dakika cache'ler ve last-known-good fallback ile public REST endpointinden yayınlar. Next route bu endpointi yeniden doğrular, sıralar/filtreler ve iki bağımsız client bileşenine sunar.

**Tech Stack:** PHP 8.3, WordPress REST/transient API, Next.js 16.4 Route Handlers, React 19, TypeScript, Node test runner, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-11-13-iett-alerts-design.md`

## Global Constraints

- Public static transit pages must remain usable when alerts are unavailable.
- Match line alerts only by normalized exact `HATKODU`.
- Cache successful upstream data for 300 seconds and retain last-known-good data without autoload.
- Never disable TLS verification or expose upstream response/error details.
- Do not run React Doctor.

## Review Focus

- İETT 500/timeout with and without a last-known-good payload.
- Malformed, oversized, duplicate or control-character source records.
- Midnight ordering and malformed `GUNCELLEME_SAATI` values.
- Exact Turkish line-code matching (`1` versus `10B`, lower/upper case).
- Empty alert list and long messages on desktop/mobile.

---

### Task 1: CMS cached alert endpoint

**Files:**
- Create: `D:\git\cmshizliulasim\iett-alerts.php`
- Modify: `D:\git\cmshizliulasim\functions.php`
- Create: `D:\git\cmshizliulasim\tests\iett-alerts.test.php`

**Interfaces:**
- Produces: `GET /wp-json/hizliulasim/v1/iett-alerts` → `{ data, status, fetchedAt }`.

- [ ] Write failing PHP tests for valid parsing, cache hit, stale fallback, no-data 503, bounded records, and refresh lock.
- [ ] Run the focused test in `php:8.3-cli` and verify RED.
- [ ] Implement the isolated module and optional include.
- [ ] Run focused and related PHP tests and verify GREEN.
- [ ] Commit or record the exact CMS files for upload.

### Task 2: Next alert contract and proxy route

**Files:**
- Modify: `src/types/iett.ts`
- Create: `src/services/iett-alerts.ts`
- Create: `src/services/iett-alerts.test.ts`
- Modify: `src/app/api/iett/duyurular/route.ts`
- Create: `src/app/api/iett/duyurular/route.test.ts`

**Interfaces:**
- Produces: `getIettAlerts({ lineCode?, limit? }, fetcher?)` and public `/api/iett/duyurular` array response.

- [ ] Write failing tests for CMS payload validation, Turkish normalization, time-descending stable order, exact line match, limit and unavailable source.
- [ ] Run tests and verify RED.
- [ ] Implement the minimal service and route with sanitized 503 plus cache headers.
- [ ] Run focused tests and verify GREEN.
- [ ] Commit the data layer.

### Task 3: Global rotating alert bar

**Files:**
- Create: `src/components/iett/IettAlertBar.tsx`
- Create: `src/components/iett/alert-presentation.ts`
- Create: `src/components/iett/alert-presentation.test.ts`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `/api/iett/duyurular?limit=5`.

- [ ] Write a failing presentation test for display time, line URL and long-message summary.
- [ ] Run and verify RED.
- [ ] Implement the rotator, hidden empty state and hover/focus pause.
- [ ] Run focused tests and verify GREEN.
- [ ] Commit the global UI.

### Task 4: Line-specific alert panel

**Files:**
- Create: `src/components/iett/IettLineAlerts.tsx`
- Modify: `src/components/bus/BusRouteDetailClient.tsx`
- Modify: `src/components/bus/bus-route-detail-data.test.ts` only if the static loader contract changes.

**Interfaces:**
- Consumes: `/api/iett/duyurular?hatKodu=<exact-code>`.

- [ ] Add a failing test around the display model/URL contract without changing the four-request static bus loader.
- [ ] Run and verify RED.
- [ ] Implement the independent line alert fetcher after info cards/freshness and before location/nearest stop.
- [ ] Run focused tests and verify GREEN.
- [ ] Commit the line UI.

### Task 5: Integrated verification

**Files:**
- Modify only files required by verified failures.

- [ ] Run every tracked Node test outside the sandbox if the known WordPress network test fails inside it.
- [ ] Run `npx tsc --noEmit --incremental false`.
- [ ] Run ESLint on changed files, then `npm run build` outside the sandbox if Windows returns `spawn/mkdir EPERM`.
- [ ] Verify localhost general header and one line with alerts; verify a line without alerts leaves no gap.
- [ ] Verify live/CMS endpoints and document any deployment-only blocker separately.
- [ ] Commit final adjustments and cherry-pick to `D:\git\hizliulasim` only after the branch is clean.
