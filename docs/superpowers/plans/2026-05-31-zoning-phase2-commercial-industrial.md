# Phase 2 — Commercial + Industrial + Public (Verified) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Replace the unverified AI-generated Commercial (C-2, C-3-O/O(SD)/R/G/S), Industrial (M-1, M-2, SALI), and Public (P) records with values transcribed verbatim from the SF Planning Code, each field source-quoted with a real amlegal deep-link — reusing the Phase-1 machinery.

**Architecture:** Same as Phase 1. These districts are pure-scalar (reuse the existing `ZoningRecord` schema); the only schema addition is an optional `controls_note` for use-only districts like P. Transcribe from amlegal Tables 210.1 (C-2), 210.2 (C-3), 210.4 (M), §836 (SALI), §211 (P), and **§124 Table 124** for FAR. `verified: true` routes them through the existing `VerifiedPanel`.

**Source method:** amlegal blocks WebFetch (403) but its internal JSON API works inside the Playwright browser: `fetch('/api/render-section/san_francisco/latest/sf_planning/0-0-0-<ID>/<idx>/')` → `{doc_id,title,html}`, wrapped in a 5–6× retry. Use the `latest` tree. Section IDs are in the roadmap appendix (`docs/superpowers/specs/2026-05-31-zoning-verified-all-districts-roadmap.md`).

**Spec/roadmap:** `docs/superpowers/specs/2026-05-31-zoning-verified-all-districts-roadmap.md`

---

## File Structure
- `lib/zoning-sources.ts` — **Modify.** Add Phase-2 `SECTION_URL` entries (§210.1, §210.2, §210.4, §124, §123, §211, §211.1, §211.2, §836, §261, §263).
- `lib/zoning-rules.ts` — **Modify.** Add optional `controls_note?: string`; replace the 10 unverified records with verified ones.
- `__tests__/zoning-rules.test.ts` — **Modify.** Extend invariants to the new verified records + a C-3 FAR sanity check.
- `components/VerifiedZoningPanel.tsx` — **Modify.** Render `controls_note` (for near-empty P).
- `scripts/build-cross-stats.ts` — **Modify.** Remove `SALI` from `KNOWN_NO_RULES`.

---

## Task 1: Section IDs + `controls_note` schema field

**Files:** `lib/zoning-sources.ts`, `lib/zoning-rules.ts`, `__tests__/zoning-sources.test.ts`

- [ ] **Step 1:** In `lib/zoning-sources.ts`, add to `SECTION_URL` (from the roadmap appendix; re-confirm each by loading `…/0-0-0-<id>` in the Playwright browser and matching the page title):
  `§210.1`→`0-0-0-20117`, `§210.2`→`0-0-0-20120`, `§210.3`→`0-0-0-20123`, `§210.4`→`0-0-0-20132`, `§124`→`0-0-0-18102` (already present), `§123`→`0-0-0-18094`, `§211`→`0-0-0-50175`, `§211.1`→`0-0-0-50178`, `§211.2`→`0-0-0-50182`, `§836`→`0-0-0-67785`, `§202.1`→`0-0-0-49715`. Group under a `// Commercial / Industrial / Public (Phase 2)` comment. (Height §261 is already present.)
- [ ] **Step 2:** Run `npm test -- __tests__/zoning-sources.test.ts` → PASS (the id-shape invariant covers the new entries).
- [ ] **Step 3:** In `lib/zoning-rules.ts` `ZoningRecord`, add `controls_note?: string  // for use-only districts (e.g. P) with no FAR/density scalars`.
- [ ] **Step 4:** `npx tsc --noEmit` → only the 2 known pre-existing test errors. `npm test` → green.
- [ ] **Step 5:** Commit: `git add lib/zoning-sources.ts lib/zoning-rules.ts __tests__/zoning-sources.test.ts && git commit -m "feat(zoning): phase-2 section ids + controls_note field"`

---

## Task 2: Transcribe Commercial (C-2, C-3-O, C-3-O(SD), C-3-R, C-3-G, C-3-S)

**Files:** `lib/zoning-rules.ts`, `__tests__/zoning-rules.test.ts`

Fetch Table 210.1 (C-2, id 20117), Table 210.2 (C-3 all subdistricts, id 20120), and **§124 Table 124** (FAR, id 18102) via the Playwright JSON API. Replace the 6 existing unverified records with `verified: true` records using `sourced()`.

- [ ] **Step 1:** Write a FAR sanity test FIRST in `__tests__/zoning-rules.test.ts` (the POC found the current data wrong — guard against regressions):
```ts
it('C-3 FAR matches Table 124 (the POC-corrected values)', () => {
  expect(ZONING_RULES['C-3-O'].far_non_residential?.max).toBe(9.0)
  expect(ZONING_RULES['C-3-R'].far_non_residential?.max).toBe(6.0)
  expect(ZONING_RULES['C-3-G'].far_non_residential?.max).toBe(6.0)   // was wrongly 9.0
  expect(ZONING_RULES['C-3-S'].far_non_residential?.max).toBe(5.0)   // was wrongly 4.5
  expect(ZONING_RULES['C-2'].far_non_residential?.max).toBe(3.6)
})
```
- [ ] **Step 2:** Run it → FAIL (current values wrong/unverified).
- [ ] **Step 3:** Transcribe each record. Required values (verify verbatim against the fetched tables; FAR from Table 124): C-2 FAR 3.6; C-3-O 9.0; C-3-O(SD) 6.0; C-3-R 6.0; C-3-G 6.0; C-3-S 5.0. Density for C/C-3 = "1 unit per 800 sq.ft. of lot area, or the density of the nearest R District, whichever is greater" (`density: { sqft_per_unit: 800, note }`, cite §207). Cite FAR to **§124** (not §210.2). Uses: summarize the P entries → `principal_uses`, C entries → `conditional_uses` (top items; the full P/C/NP matrix is deferred to the NC phase). `parking_text` = "None required; maximum per §151.1." `dwelling_unit_mix_text` from §207.7 where present. `classification` → `sourced('§210.1', …)` for C-2, `sourced('§210.2', …)` for C-3-*. Set `name` (e.g. "Downtown Office"), `verified: true`, full `source` block with document = "SF Planning Code (amlegal, latest)" and `document_url` = the §210.2 amlegal URL.
- [ ] **Step 4:** `npm test -- __tests__/zoning-rules.test.ts` → PASS (FAR sanity + value-in-quote + every-section-resolves all green).
- [ ] **Step 5:** `npx tsc --noEmit` + `npm test` (full) → green.
- [ ] **Step 6:** Commit: `git add lib/zoning-rules.ts __tests__/zoning-rules.test.ts && git commit -m "feat(zoning): verified Commercial records (C-2, C-3-*) + fix C-3 FAR errors"`

---

## Task 3: Transcribe Industrial + Public (M-1, M-2, SALI, P)

**Files:** `lib/zoning-rules.ts`, `scripts/build-cross-stats.ts`

Fetch Table 210.4 (M, id 20132), §836 (SALI, id 67785), §211/§211.1/§211.2 (P, ids 50175/50178/50182).

- [ ] **Step 1:** Transcribe M-1, M-2 (FAR 5.0 both per Table 210.4; parking "None required, max per §151.1"; height "Varies, see Height & Bulk maps"; principal/conditional uses from the M use table) and SALI (§836; residential/office NP). `verified: true`, `sourced()` quotes, classification `sourced('§210.4',…)` for M, `sourced('§836',…)` for SALI.
- [ ] **Step 2:** Transcribe P (Public): no FAR/density/open-space scalars. Set `name: 'Public'`, `classification: sourced('§211', …)`, `principal_uses` from §211.1, `conditional_uses` from §211.2 (each `sourced('§211.1'|'§211.2', verbatim)`), and `controls_note: 'Public lands — uses governed by §211; no FAR, density, or open-space controls.'` `verified: true`, `source.density` may be omitted-not-allowed → if the schema requires `source.density`, set it to `sourced('§211', '<verbatim use/none language>')` with a `density.note` instead of numeric. (Check the type: `source.density` is required; provide it.)
- [ ] **Step 3:** In `scripts/build-cross-stats.ts`, remove `'SALI'` from `KNOWN_NO_RULES`.
- [ ] **Step 4:** `npm test -- __tests__/zoning-rules.test.ts` → PASS. The `verified()` set now includes these; value-in-quote applies only to digit-form fields (P has none → fine).
- [ ] **Step 5:** `npx tsc --noEmit` + `npm test` → green.
- [ ] **Step 6:** Commit: `git add lib/zoning-rules.ts scripts/build-cross-stats.ts && git commit -m "feat(zoning): verified Industrial (M-1/M-2/SALI) + Public (P) records"`

---

## Task 4: Panel — render `controls_note`; verify near-empty P

**Files:** `components/VerifiedZoningPanel.tsx`, `__tests__/ZoningDistrictPanel.test.tsx`

- [ ] **Step 1:** Write a failing test: rendering `zoningSim="P"` shows the controls note and does NOT crash on absent FAR/density/min-lot:
```ts
it('renders Public (P) with a controls note and no blank metric rows', () => {
  render(<ZoningDistrictPanel zoningSim="P" gen="Public" districtName="P" onClose={() => {}} />)
  expect(screen.getByText(/uses governed by §211/i)).toBeInTheDocument()
})
```
- [ ] **Step 2:** Run → FAIL (note not rendered).
- [ ] **Step 3:** In `VerifiedZoningPanel`, render `rec.controls_note` (when present) as a muted line near the top of the controls block. Confirm the existing rows already no-op when their fields are absent (they're all guarded) so P shows the note + uses + sources, no blank metrics.
- [ ] **Step 4:** `npm test -- __tests__/ZoningDistrictPanel.test.tsx` → PASS.
- [ ] **Step 5:** `npx tsc --noEmit` + `npm test` → green.
- [ ] **Step 6:** Commit: `git add components/VerifiedZoningPanel.tsx __tests__/ZoningDistrictPanel.test.tsx && git commit -m "feat(zoning): render controls_note for use-only districts (P)"`

---

## Task 5: Full verification

- [ ] **Step 1:** `npx tsc --noEmit && npm run lint && npm test` → all green (only the 2 known pre-existing tsc errors).
- [ ] **Step 2:** `npm run build` → succeeds. (Do NOT run `npm run dev` concurrently — it churns `.next` and corrupts smoke tests.)
- [ ] **Step 3:** `npm run cross-stats` → coverage count rises (SALI no longer fallback); no "missing transcription".
- [ ] **Step 4:** Dev smoke (build must be finished first): `?mode=zoning&district=C-3-O` (FAR 9.0, uses, §124 + §210.2 links), `&district=M-1`, `&district=P` (controls note, no blank metrics), `&district=SALI`. Confirm an unverified district still shows fallback.
- [ ] **Step 5:** Final commit if any cleanup.
