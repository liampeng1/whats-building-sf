# Phase 3 — PDR + Mixed-Use (Verified) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Replace the unverified PDR (PDR-1-B/D/G, PDR-2) and Mixed-Use (UMU, MUG, MUO, MUR, WMUG, WMUO, RED-MX, CMUO) records with source-verified ones, adding the two schema accommodations the POC identified: **banded FAR** (FAR keyed to height district) and **form-based density** (envelope-governed, no DU/lot cap).

**Architecture:** Reuse Phase-1/2 machinery. Two non-breaking schema additions:
`DensityRule.model?: 'form-based' | 'unit-based'` and `far_non_residential` gains optional
`banded?: string` + `basis?: string` (with `max` made optional). Transcribe from amlegal
§210.3 (PDR) and Art. 8 §§830–840 (Mixed-Use) via the proven `/api/render-section` method.

**Source IDs (roadmap appendix; re-confirm by title):** §210.3 `0-0-0-20123` (already mapped),
§830 CMUO `0-0-0-67565`, §831 MUG `0-0-0-67718`, §832 MUO `0-0-0-67732`, §833 MUR `0-0-0-67745`,
§835 RED-MX `0-0-0-67772`, §838 UMU `0-0-0-67810`, §839 WMUG `0-0-0-70715`, §840 WMUO `0-0-0-67836`.

**Roadmap:** `docs/superpowers/specs/2026-05-31-zoning-verified-all-districts-roadmap.md`

---

## Task 1: Section IDs + schema tweaks (banded FAR + form-based density)

**Files:** `lib/zoning-sources.ts`, `lib/zoning-rules.ts`, `__tests__/zoning-rules.test.ts`

- [ ] **Step 1:** Add the 8 Mixed-Use IDs (§830–840) to `SECTION_URL` under a `// Mixed-Use Art. 8 (Phase 3)` comment, each re-confirmed by page title via the amlegal browser (navigate `…/0-0-0-<id>` or `fetch('/api/render-section/.../0-0-0-<id>/0/')` → `{title}`). Also add `§208` (Group/form-based density — find + confirm its id) if a record cites it. Mark any unconfirmable id `// UNRESOLVED` and report — do not guess.
- [ ] **Step 2:** `npm test -- __tests__/zoning-sources.test.ts` → PASS.
- [ ] **Step 3:** In `lib/zoning-rules.ts`: extend `DensityRule` with `model?: 'form-based' | 'unit-based'`. Change `far_non_residential?` from `{ max: number; note?: string }` to `{ max?: number; banded?: string; basis?: string; note?: string }` (make `max` optional; `banded` holds e.g. "3.0 to 1 (40-48ft) … 7.5 to 1 (>85ft)"; `basis` holds e.g. "per §124, by height district"). All existing records keep compiling (they set `max`).
- [ ] **Step 4:** `npx tsc --noEmit` (only the 2 known pre-existing errors) + `npm test` (green — confirm the value-in-quote test still passes: it reads `far_non_residential?.max`, which is `undefined`→skipped for banded records).
- [ ] **Step 5:** Commit: `git add lib/zoning-sources.ts lib/zoning-rules.ts __tests__/zoning-sources.test.ts && git commit -m "feat(zoning): phase-3 mixed-use ids + banded-FAR/form-based-density schema"`

---

## Task 2: Transcribe PDR (PDR-1-B, PDR-1-D, PDR-1-G, PDR-2) — banded FAR

**Files:** `lib/zoning-rules.ts`, `__tests__/zoning-rules.test.ts`

Fetch Table 210.3 (`0-0-0-20123`) via the browser API. Replace the 4 unverified PDR records.

- [ ] **Step 1:** Write a sanity test FIRST: PDR records have NO scalar `far_non_residential.max` but DO have a `banded` FAR string and `verified: true`:
```ts
it('PDR records use banded FAR (no scalar max)', () => {
  for (const c of ['PDR-1-B','PDR-1-D','PDR-1-G','PDR-2']) {
    expect(ZONING_RULES[c].verified).toBe(true)
    expect(ZONING_RULES[c].far_non_residential?.max).toBeUndefined()
    expect(ZONING_RULES[c].far_non_residential?.banded).toMatch(/to 1/)
  }
})
```
Run → FAIL.
- [ ] **Step 2:** Transcribe each PDR record from Table 210.3 verbatim:
  - `far_non_residential: { banded: '<verbatim ramp, e.g. "3.0 to 1 in a 40, 45, or 48-foot height district; 4.0 to 1 in a 50, 55, or 58-foot height district; 5.0 to 1 in a 65 or 68-foot height district; 6.0 in an 80 or 85-foot height district; or 7.5 to 1 in a height district over 85 feet">', basis: 'per height district (§124)' }`, `source.far_non_residential: sourced('§124', '<same verbatim ramp>')`.
  - `density: { model: 'unit-based', note: 'Residential not permitted (PDR)' }` if Table 210.3 shows dwellings NP — quote it in `source.density: sourced('§210.3','<verbatim NP language>')`.
  - `principal_uses`/`conditional_uses` from the Table 210.3 use matrix (summary), `parking_text` ("None Required. Maximums set in §151.1"), `name` (PDR-1-G "Production, Distribution & Repair — General", etc.), `classification: sourced('§210.3','PDR DISTRICTS')`, `verified: true`, `document_url` = §210.3 URL.
- [ ] **Step 3:** `npm test -- __tests__/zoning-rules.test.ts` → PASS.
- [ ] **Step 4:** `npx tsc --noEmit` + `npm test` + `npx eslint lib/zoning-rules.ts` → green.
- [ ] **Step 5:** Commit: `git add lib/zoning-rules.ts __tests__/zoning-rules.test.ts && git commit -m "feat(zoning): verified PDR records with banded FAR"`

---

## Task 3: Transcribe Mixed-Use (UMU, MUG, MUO, MUR, WMUG, WMUO, RED-MX, CMUO) — form-based density

**Files:** `lib/zoning-rules.ts`, `scripts/build-cross-stats.ts`

Fetch §830–840 tables via the browser API. Replace/add the 8 records.

- [ ] **Step 1:** Transcribe each verbatim. Common shape:
  - `density: { model: 'form-based', note: 'Form-Based Density — governed by building envelope (height/bulk), not a DU/lot cap' }`, `source.density: sourced('§207'|'§208','<verbatim "Form-Based Density" line>')`. (WMUO has no residential density: `density: { model: 'form-based', note: 'Residential not permitted' }` with the verbatim NP quote.)
  - `far_non_residential: { basis: 'per §124, by height district', note: '<verbatim, e.g. "Section 124 sets forth the Basic FAR, based on height">' }`, `source.far_non_residential: sourced('§124','<verbatim>')`. (No `max`, no `banded` unless the table gives a number.)
  - `dwelling_unit_mix_text` from §207.6 where cited (Eastern Neighborhoods MU districts are in §207.6's list) → `source.dwelling_unit_mix: sourced('§207.6','<verbatim>')`.
  - `principal_uses`/`conditional_uses` (summary), `parking_text`, `name` (UMU "Urban Mixed Use", MUG "Mixed Use — General", MUO "Mixed Use — Office", MUR "Mixed Use — Residential", WMUG/WMUO "Western SoMa Mixed Use — General/Office", RED-MX "Residential Enclave — Mixed", CMUO "Central SoMa Mixed Use — Office"), `classification: sourced('§83x','<title>')`, `verified: true`, `document_url` = that section's URL.
- [ ] **Step 2:** In `scripts/build-cross-stats.ts`, remove `'UMU'` and `'WMUO'` from `KNOWN_NO_RULES` (now transcribed). Leave `S-MU`, `SPD` (Phase 5 / not in scope).
- [ ] **Step 3:** `npm test -- __tests__/zoning-rules.test.ts` → PASS (value-in-quote skips form-based density + basis-only FAR; every-section-resolves covers the §83x ids).
- [ ] **Step 4:** `npx tsc --noEmit` + `npm test` + `npx eslint lib/zoning-rules.ts` → green.
- [ ] **Step 5:** Commit: `git add lib/zoning-rules.ts scripts/build-cross-stats.ts && git commit -m "feat(zoning): verified Mixed-Use records with form-based density"`

---

## Task 4: Panel — render banded FAR + form-based density

**Files:** `components/VerifiedZoningPanel.tsx`, `__tests__/ZoningDistrictPanel.test.tsx`

- [ ] **Step 1:** Failing test:
```ts
it('renders banded FAR for PDR and form-based density for UMU', () => {
  const { rerender } = render(<ZoningDistrictPanel zoningSim="PDR-1-G" gen="Industrial" districtName="PDR-1-G" onClose={() => {}} />)
  expect(screen.getByText(/FAR \(non-residential\):/i).textContent).toMatch(/to 1/)   // banded string
  rerender(<ZoningDistrictPanel zoningSim="UMU" gen="Mixed Use" districtName="UMU" onClose={() => {}} />)
  expect(screen.getAllByText(/form-based density/i).length).toBeGreaterThan(0)
})
```
Run → FAIL (banded FAR not rendered; max-only path).
- [ ] **Step 2:** In `VerifiedZoningPanel`, where the FAR row is built, handle the banded/basis case: if `rec.far_non_residential?.max != null` show `FAR (non-residential): {max}`; else if `banded` show `FAR (non-residential): {banded}`; else if `basis` show `FAR (non-residential): {basis}`. (Form-based density already renders via the existing `d.note` fallback — confirm UMU shows "Form-Based Density".) Update both the controls row and the "At a glance" bar to use the same logic (or omit banded from the glance bar to keep it short).
- [ ] **Step 3:** `npm test -- __tests__/ZoningDistrictPanel.test.tsx` → PASS.
- [ ] **Step 4:** `npx tsc --noEmit` + `npm test` + `npx eslint components/VerifiedZoningPanel.tsx` → green.
- [ ] **Step 5:** Commit: `git add components/VerifiedZoningPanel.tsx __tests__/ZoningDistrictPanel.test.tsx && git commit -m "feat(zoning): render banded FAR + form-based density in panel"`

---

## Task 5: Full verification

- [ ] **Step 1:** `npx tsc --noEmit && npm test` → green (only 2 known pre-existing tsc errors). `npm run lint` — confirm our files clean (repo-wide pre-existing problems unchanged).
- [ ] **Step 2:** `npm run build` → succeeds. (Do NOT run dev concurrently.)
- [ ] **Step 3:** `npm run cross-stats` → coverage rises (UMU, WMUO out of fallback); no "missing transcription".
- [ ] **Step 4:** Dev smoke (after build finishes): `?mode=zoning&district=PDR-1-G` (banded FAR string), `&district=UMU` (form-based density, §838 link), `&district=CMUO`, `&district=WMUO` (no resi density). Confirm a still-unverified district (e.g. NC-1) shows fallback.
- [ ] **Step 5:** Final cleanup commit if needed.
