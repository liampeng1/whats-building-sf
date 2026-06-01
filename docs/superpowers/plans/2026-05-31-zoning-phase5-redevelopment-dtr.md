# Phase 5 — Redevelopment Fallbacks + DTR (Verified/Honest) Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Worktree: `.claude/worktrees/zoning` (branch `zoning-rest`).

**Goal:** Replace the fabricated AI-generated records for Redevelopment/Area-Plan districts with **honest documented fallbacks** that link each district's actual governing plan (they are governed by Redevelopment Plans / Design-for-Development that supersede the Planning Code — like TIDA, which we already handle). Transcribe the two genuinely-in-code DTR districts (RH-DTR §827, SB-DTR §829).

**Why:** The POC proved Mission Bay (§902 "supersedes the Planning Code in its entirety"), Candlestick/Bayview (§249.50 "superseded by the BVHP Redevelopment Plan"), Parkmerced (§249.64 → Design Standards & Guidelines), Mission Rock (§249.80), and Potrero/S-MU (§249.87) are NOT transcribable from the Planning Code. Their current AI-generated rule rows are fabricated and should be removed.

**Roadmap:** `docs/superpowers/specs/2026-05-31-zoning-verified-all-districts-roadmap.md`

## District disposition
- **Documented fallback** (remove fabricated record → render governing-plan link): MB-O, MB-RA (Mission Bay); PM-CF, PM-MU1, PM-MU2, PM-OS, PM-R, PM-S (Parkmerced); BR-MU, P70-MU, PPS-MU, HP-RA (Candlestick/Hunters Point); MR-MU (Mission Rock); Job Corps (federal). Already-fallback: TI-*, YBI-* (TIDA), S-MU (Potrero SUD), TB-DTR (Transbay), SPD.
- **Transcribe** (real Planning Code): RH-DTR (§827), SB-DTR (§829).
- **CCB collision note:** the Chinatown CCB (§810) is already verified in Phase 4; the Candlestick "CCB" sub-district is a *different* thing — but DataSF uses one `CCB` code for Chinatown, so no separate Candlestick CCB record exists. Leave the verified Chinatown CCB as-is.

---

## Task 1: GOVERNING_PLAN map + generalized fallback rendering

**Files:** `lib/zoning-sources.ts` (or new `lib/governing-plans.ts`), `components/ZoningDistrictPanel.tsx`, `__tests__/ZoningDistrictPanel.test.tsx`

- [ ] **Step 1:** Add a `GOVERNING_PLAN: Record<string, { plan: string; url: string }>` map (in `lib/zoning-sources.ts`), keyed by `zoning_sim`, with POC-captured plan docs:
  ```ts
  // Mission Bay
  'MB-O':  { plan: 'Mission Bay Redevelopment Plan (OCII)', url: 'https://sfocii.org/projects/mission-bay-south/overview' },
  'MB-RA': { plan: 'Mission Bay Redevelopment Plan (OCII)', url: 'https://sfocii.org/projects/mission-bay-south/overview' },
  // Parkmerced
  'PM-R': { plan: 'Parkmerced Design Standards & Guidelines (SUD §249.64)', url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-34612' },
  // …PM-CF, PM-MU1, PM-MU2, PM-OS, PM-S same
  // Candlestick / Hunters Point
  'BR-MU':  { plan: 'Candlestick Point Design for Development (BVHP Redevelopment Plan)', url: 'https://sfocii.org/projects/hunters-point-shipyard-candlestick-point-2/overview' },
  'P70-MU': { …same… }, 'PPS-MU': { …same… }, 'HP-RA': { plan: 'Hunters Point Shipyard (OCII)', url: 'https://sfocii.org/completed-project-areas/hunters-point' },
  // Mission Rock / Potrero / Transbay
  'MR-MU': { plan: 'Mission Rock Design Controls (SUD §249.80)', url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-58323' },
  'S-MU':  { plan: 'Potrero Power Station Design for Development (SUD §249.87)', url: 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-62911' },
  'TB-DTR':{ plan: 'Transbay Redevelopment Plan (OCII)', url: 'https://sfocii.org' },
  // Federal
  'Job Corps': { plan: 'Federal facility (Treasure Island Job Corps) — not under the SF Planning Code', url: 'https://sfgov.org/treasureisland/development-plan' },
  ```
  (TI-*/YBI-* keep their existing dedicated TIDA block in the panel; optionally fold into GOVERNING_PLAN too.)
- [ ] **Step 2 (TDD):** failing test — rendering `MB-RA` shows the governing-plan link:
  ```ts
  it('shows the governing-plan fallback for a redevelopment district', () => {
    render(<ZoningDistrictPanel zoningSim="MB-RA" gen="" districtName="MB-RA" onClose={() => {}} />)
    expect(screen.getByText(/Mission Bay Redevelopment Plan/i)).toBeInTheDocument()
  })
  ```
- [ ] **Step 3:** In `ZoningDistrictPanel`'s no-record (`!rec`) branch, look up `GOVERNING_PLAN[zoningSim]`; when present, render an honest block: "Governed by **{plan}** — this district's controls live in a Redevelopment Plan / Design-for-Development that supersedes the SF Planning Code." with the `{url}` link (generalize the existing TIDA block). Keep the existing TIDA-specific text for TI-*/YBI- if not folding in.
- [ ] **Step 4:** test PASS; `npx tsc --noEmit` + `npm test` + eslint green. Commit `feat(zoning): governing-plan fallback for redevelopment districts`.

---

## Task 2: Remove fabricated records → fallback; transcribe DTR

**Files:** `lib/zoning-rules.ts`, `scripts/build-cross-stats.ts`, `lib/zoning-sources.ts`

- [ ] **Step 1:** REMOVE the fabricated unverified records from `ZONING_RULES`: MB-O, MB-RA, PM-CF, PM-MU1, PM-MU2, PM-OS, PM-R, PM-S, BR-MU, P70-MU, PPS-MU, HP-RA, MR-MU, Job Corps. Add all of them to `KNOWN_NO_RULES` in `scripts/build-cross-stats.ts` so the coverage guard accounts for them (they now render the GOVERNING_PLAN fallback).
- [ ] **Step 2:** Add §827, §829 ids to SECTION_URL (confirm by title via amlegal browser). Transcribe RH-DTR (§827 "Rincon Hill DTR") and SB-DTR (§829 "South Beach DTR") as `verified: true` records from their amlegal tables (density form-based or DTR-specific, FAR, height, parking, uses), `sourced()` quotes. Remove `'RH DTR'`/`'SB-DTR'` from KNOWN_NO_RULES (note the code spelling in DataSF — confirm `RH DTR` vs `RH-DTR`).
- [ ] **Step 3:** `npm test` + `npx tsc --noEmit` + eslint green. Commit `feat(zoning): redevelopment districts → governing-plan fallback; verified RH/SB-DTR`.

---

## Task 3: Final verification + integration

- [ ] `npx tsc --noEmit && npm test` green (2 known pre-existing). Our files eslint-clean.
- [ ] `npm run build` succeeds.
- [ ] `npm run cross-stats` → no "missing transcription"; all remaining codes are either verified records or KNOWN_NO_RULES (documented fallbacks).
- [ ] Spot-check render logic (component tests) for MB-RA (plan link), RH-DTR (verified). Browser smoke optional (avoid dev-server clash with the concurrent session).
- [ ] Fast-forward `origin/main` to `zoning-rest` tip (clean, no transit commits): `git push origin zoning-rest:main`.
