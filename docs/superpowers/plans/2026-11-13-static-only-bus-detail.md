# Static-Only Bus Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the bus line detail page use only the synchronized static package and perform no live İETT vehicle request.

**Architecture:** Move the four static detail fetches behind a small injected loader, remove the detail-only live vehicle state/UI/polling, and keep location utility by deriving the nearest stop from static stop coordinates. Leave the global live endpoint and unrelated consumers unchanged.

**Tech Stack:** Next.js 16.4.6, React 19, TypeScript, Node test runner

**Spec:** `docs/superpowers/designs/2026-11-13-static-only-bus-detail.md`

## Global Constraints

- The detail page must not request `/api/iett/konum`.
- Hat, schedules, stops and route paths must come from the existing static endpoints.
- The global live endpoint and other pages remain unchanged.
- Do not run React Doctor.

## Review Focus

- A line code containing special characters must be URL encoded for all four requests.
- One failed optional response must not discard successful responses.
- Missing stop coordinates must not break nearest-stop selection.
- Location permission failure must keep the existing retry UI.
- Removing live state must not break favorites or the login modal used by favorites.

---

### Task 1: Static-only bus detail

**Files:**
- Create: `src/components/bus/bus-route-detail-data.ts`
- Create: `src/components/bus/bus-route-detail-data.test.ts`
- Create: `src/components/bus/nearest-stop.ts`
- Create: `src/components/bus/nearest-stop.test.ts`
- Modify: `src/components/bus/BusRouteDetailClient.tsx`
- Modify: `src/components/bus/NearestStopAssistant.tsx`
- Modify: `src/components/bus/live-access.test.ts`

**Interfaces:**
- Produces: `loadBusRouteDetailResponses(hatKodu, fetcher)` returning the four `PromiseSettledResult<Response>` values.
- Produces: `findNearestStop(duraklar, direction, location)` returning the closest valid stop and its distance or `null`.

- [x] **Step 1: Write failing loader and nearest-stop tests**

Test that the loader calls exactly `/api/iett/hatlar`, `/api/iett/sefer-saatleri`, `/api/iett/durak-detay`, and `/api/iett/guzergah` with the encoded line code. Test that nearest-stop selection ignores invalid coordinates and returns the hand-checked closest stop.

- [x] **Step 2: Run tests to verify RED**

Run: `node --test --experimental-strip-types src/components/bus/bus-route-detail-data.test.ts src/components/bus/nearest-stop.test.ts`

Expected: FAIL because the production modules do not exist.

- [x] **Step 3: Implement the two helpers and consume them from the detail components**

Remove live vehicle imports, state, polling, tab, map/list UI and route stop vehicle decoration. Reduce `NearestStopAssistant` props to static stops plus user location and render only nearest-stop information.

- [x] **Step 4: Update the existing live-access contract and run focused tests**

Run: `node --test --experimental-strip-types src/components/bus/bus-route-detail-data.test.ts src/components/bus/nearest-stop.test.ts src/components/bus/live-access.test.ts src/components/bus/route-path.test.ts`

Expected: PASS.

- [x] **Step 5: Verify the application**

Run: `npx tsc --noEmit`, `npm run lint -- src/components/bus`, `npm run build`, and HTTP checks against port 3000.

Expected: no TypeScript or build errors; detail page responds and no live vehicle request is initiated by its source/runtime.

- [x] **Step 6: Commit**

Commit message: `refactor: make bus detail fully static`
