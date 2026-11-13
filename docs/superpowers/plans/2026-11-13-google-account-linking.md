# Google Account Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authenticated password user securely connect the Google identity with the same verified email and then use Google sign-in for the existing account.

**Architecture:** A new Next.js route verifies the GIS credential, combines it with the current httpOnly JWT, and sends the existing HMAC-signed identity assertion to a new authenticated WordPress bridge endpoint. WordPress owns conflict checks and stores the provider subject; the profile UI reads a boolean status and reuses the official Google button.

**Tech Stack:** Next.js 16.4 App Router, React 19, Google Identity Services, `google-auth-library`, WordPress REST API, PHP HMAC, existing JWT cookies.

**Spec:** `docs/superpowers/specs/2026-11-13-google-account-linking-design.md`

## Global Constraints

- Do not add a Google Client Secret, redirect URI, new OAuth origin, or new shared secret.
- Never expose or trust the Google `sub` in the browser.
- Require both a valid site JWT and a freshly verified Google credential.
- Link only when the verified Google email equals the signed-in WordPress email case-insensitively.
- Never overwrite a Google identity already linked to either the current user or another user.
- Preserve the existing profile, favorites, preferences, comments, username, and JWT session.
- Do not add unlinking in this version.

## Review Focus

- A request without `auth_token` must stop before Google verification and CMS access.
- A Google email differing only in case must link; any other mismatch must be rejected.
- A provider subject owned by another user must never move to the current user.
- Repeating the same link must be idempotent, while a different subject on an already-linked user must fail.
- CMS/network/config failures must not show a false linked state in the profile.

---

### Task 1: WordPress account-link mutation and status

**Files:**
- Modify: `D:/git/cmshizliulasim/tests/google-auth.test.php`
- Modify: `D:/git/cmshizliulasim/google-auth-bridge.php`
- Modify: `D:/git/cmshizliulasim/jwt-auth-v2.php`

**Interfaces:**
- Consumes: authenticated `WP_REST_Request`, verified bridge claims, `_hizliulasim_google_sub` metadata.
- Produces: `POST /wp-json/hizliulasim/v1/auth/google/link` returning `{ linked: true, email }`; `hizliulasim_format_user()` adds `google_linked: bool`.

- [x] **Step 1: Write failing CMS assertions** for matching email, case-insensitive matching, email mismatch, provider subject owned by another user, idempotent same-sub linking, and different-sub overwrite rejection.
- [x] **Step 2: Run** `php D:/git/cmshizliulasim/tests/google-auth.test.php` and confirm failure because the linking function is missing.
- [x] **Step 3: Implement** `hizliulasim_google_link_from_claims($user, $claims)`, `hizliulasim_auth_google_link($request)`, the REST route, and `google_linked` formatting.
- [x] **Step 4: Run** the focused test plus `php -l` for both modified CMS modules and confirm PASS.

### Task 2: Authenticated Next.js linking boundary

**Files:**
- Create: `src/app/api/auth/google/link/handler.ts`
- Create: `src/app/api/auth/google/link/route.ts`
- Create: `src/app/api/auth/google/link/route.test.ts`

**Interfaces:**
- Consumes: `{ credential: string }`, `auth_token` httpOnly cookie, existing Google verifier and bridge signer.
- Produces: `POST /api/auth/google/link` returning `{ linked: true, email }` without changing auth cookies.

- [x] **Step 1: Write failing route tests** for missing session short-circuit, valid signed/authenticated CMS exchange, malformed credential, safe conflict mapping, and invalid CMS response.
- [x] **Step 2: Run** `node --test src/app/api/auth/google/link/route.test.ts` and confirm failure because the handler is missing.
- [x] **Step 3: Implement** `createGoogleLinkPost()` and a Next.js 16 route wrapper reading `request.cookies`.
- [x] **Step 4: Run** the focused route tests and confirm PASS.

### Task 3: Profile account-connections card

**Files:**
- Modify: `src/services/auth.ts`
- Modify: `src/hooks/useAuth.ts`
- Create: `src/components/auth/GoogleAccountLinkCard.tsx`
- Create: `src/components/auth/google-account-link-state.ts`
- Create: `src/components/auth/google-account-link-state.test.ts`
- Modify: `src/app/u/[username]/page.tsx`

**Interfaces:**
- Consumes: `AuthUser.google_linked`, official `GoogleSignInButton`, `POST /api/auth/google/link`.
- Produces: owner-only card with linked, pending, success, and safe error states.

- [x] **Step 1: Write failing state tests** for linked/unlinked copy and safe API error selection.
- [x] **Step 2: Run** `node --test src/components/auth/google-account-link-state.test.ts` and confirm failure because the state module is missing.
- [x] **Step 3: Add** `google_linked` to the auth contract, `googleLink()` service, `useGoogleLink()` mutation, and the owner-only profile card.
- [x] **Step 4: Run** the focused state and GIS tests, then TypeScript and targeted ESLint.

### Task 4: Regression and deployment handoff

**Files:**
- Modify: `docs/superpowers/plans/2026-11-13-google-account-linking.md`

**Interfaces:**
- Consumes: matching existing bridge secret in frontend and CMS.
- Produces: verified source bundle and exact upload/deploy list.

- [x] **Step 1: Run** the full frontend Node test suite and production build.
- [x] **Step 2: Run** the CMS Google auth suite and PHP syntax checks again.
- [ ] **Step 3: Verify** locally that an authenticated existing user sees the card, links a same-email Google identity, and remains logged in.
- [x] **Step 4: Record** verification results and the CMS/frontend files that must be deployed.

## Verification Record

- Baseline frontend: 475 passed, 0 failed before this feature.
- Final frontend: 482 passed, 0 failed; the latest focused Google login/link/state run passed 17/17; TypeScript PASS; targeted ESLint 0 errors and 0 warnings in the new/modified account-link modules.
- Production build: PASS on Next.js 16.4.6; `.next` manifests contain `/api/auth/google/link`. The existing redirect-manifest certificate interceptor warning used the checked-in 124-rule fallback and did not fail the build.
- CMS: 22 Google bridge assertions PASS on PHP 8.3; `google-auth-bridge.php` and `jwt-auth-v2.php` both pass `php -l`. The final review regressions cover failed metadata persistence and concurrent provider-subject binding.
- Deployed CMS boundary: after the final `google-auth-bridge.php` upload, unauthenticated `POST https://cms.hizliulasim.com/wp-json/hizliulasim/v1/auth/google/link` returns `401 no_token`, proving the uploaded route is active and authenticates before mutation.
- Authenticated profile UI: the owner-only account-connections card and official Google button are visible for the signed-in existing user; the final Google account-selection/link mutation remains a user-performed acceptance step.
- Local frontend boundary: unauthenticated `POST http://localhost:3000/api/auth/google/link` returns the intended safe `401` session message.
- Development copy: the focused 7 account-link tests and TypeScript pass in `D:/git/hizliulasim`; source hashes match the isolated worktree except for line-ending-only differences in the existing profile page.

## Deployment Handoff

### WordPress/CMS

- Upload `google-auth-bridge.php` and `jwt-auth-v2.php`. The final bridge upload and live endpoint check confirm the route is active; `jwt-auth-v2.php` supplies the `google_linked` profile flag.
- `tests/google-auth.test.php` is local verification only and is not required by WordPress at runtime.

### Frontend

- Deploy the modified profile/auth files plus `src/app/api/auth/google/link/` and `src/components/auth/GoogleAccountLinkCard.tsx` / `google-account-link-state.ts`.
- Include the two new account-link tests, `.gitignore` tracking exceptions, and this plan/spec in source control.
- No new Google Console origin, Client Secret, redirect URI, Vercel environment variable, or WordPress secret is required; this reuses the working Google Client ID and bridge secret.

