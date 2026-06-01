# Phase 4 — Neighborhood Commercial + Chinatown (Verified) Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Verify NC/NCT + Chinatown districts (NC-1, NC-2, NC-3, NC-S, NCD, NCT, NCT-1, NCT-2, NCT-3, CCB, CVR, CRNC, RCD) from the live Planning Code — key scalar controls (FAR, height, density, use-size, parking) + principal/conditional use summaries, each source-quoted with a real §-deep-link.

**Scope decision (transparent):** NC districts have a ~70-row floor-by-floor use matrix. The **exhaustive per-floor matrix is DEFERRED** to a future enhancement (it needs a new schema + panel UI). This phase transcribes the verified scalar controls + use summaries (noting key floor restrictions inline, e.g. "Bar — P ground floor, NP above"), exactly like the Commercial records. No schema or panel change needed; reuse existing fields.

**Source:** Art. 7 §§710–764 (NC/NCT), Art. 8 §§810–812 (Chinatown), via the amlegal `/api/render-section` browser method. IDs in the roadmap appendix.

**Roadmap:** `docs/superpowers/specs/2026-05-31-zoning-verified-all-districts-roadmap.md`

---

## Task 1: NC + Chinatown section IDs

**Files:** `lib/zoning-sources.ts`

- [ ] Add to `SECTION_URL` (confirm each by page title via the amlegal browser/API), under `// Neighborhood Commercial + Chinatown (Phase 4)`:
  `§710`→`0-0-0-25492` (NC-1), `§711`→`0-0-0-25507` (NC-2), `§712`→`0-0-0-25522` (NC-3), `§713`→`0-0-0-25536` (NC-S), `§750`→`0-0-0-57016` (NCT-1), `§751`→`0-0-0-57028` (NCT-2), `§752`→`0-0-0-57664` (NCT-3), `§758`→`0-0-0-57126` (RCD?), `§810`→ find (Chinatown CCB), `§811`→ find (CVR), `§812`→`0-0-0-26729` (CRNC). Find/confirm the generic NCT (§754? or the NCT umbrella) and NCD ids as needed.
- [ ] **Resolve the RCD ambiguity:** one POC said RCD = §758 "Regional Commercial District"; another said RCD = Chinatown Residential/Commercial. Determine which by checking the live DataSF `districtna` for `RCD` (it's in the zoning dataset) and the matching §-section title. Record the correct one.
- [ ] `npm test -- __tests__/zoning-sources.test.ts` → PASS. Commit `feat(zoning): phase-4 NC + Chinatown section ids`.

---

## Task 2: Transcribe NC + NCT (NC-1, NC-2, NC-3, NC-S, NCD, NCT, NCT-1, NCT-2, NCT-3)

**Files:** `lib/zoning-rules.ts`, `__tests__/zoning-rules.test.ts`

- [ ] Fetch each §710–713/§750–752 table via the browser API. Replace the unverified records. Per record (verbatim, `sourced()`):
  - `far_non_residential: { max: <Table value, usually 1.8 to 1> }` cite §124 or the §-the-table-cites (quote must contain the digit). If form-based, use `basis`.
  - `density`: NC = `{ sqft_per_unit: 800, note }` ("1 unit per 800 sq.ft. or nearest R District, whichever greater", §207). **NCT = `{ model: 'form-based', note }`** (transit, envelope-governed).
  - `controls_note`: height "Varies. See Height and Bulk Maps." + `use_size` limit (e.g. "P up to 3,000 sq ft; C above" §121.2).
  - `parking_text`: NC "No car parking required; max per §151.1"; NCT adds resi caps. `dwelling_unit_mix_text` for NCT (§207.6).
  - `principal_uses`/`conditional_uses`: summarize key uses; where a use has a notable floor restriction, note it inline (e.g. "Bar (P 1st floor, NP above)"). `source.*` verbatim quotes.
  - `name`, `classification: sourced('§71x'|'§75x', '<title>')`, `verified: true`, `document_url`.
- [ ] `npm test -- __tests__/zoning-rules.test.ts` → PASS. `npx tsc --noEmit` + `npm test` + eslint. Commit `feat(zoning): verified NC + NCT records`.

---

## Task 3: Transcribe Chinatown (CCB, CVR, CRNC, RCD)

**Files:** `lib/zoning-rules.ts`

- [ ] Fetch §810 (CCB Chinatown Community Business), §811 (CVR Chinatown Visitor Retail), §812 (CRNC Chinatown Residential Neighborhood Commercial), and RCD's resolved section. Transcribe scalar + use summaries the same way. Disambiguate CCB (Chinatown) from any other use. `verified: true`.
- [ ] `npm test` + `npx tsc --noEmit` + eslint → green. Commit `feat(zoning): verified Chinatown NC records (CCB/CVR/CRNC/RCD)`.

---

## Task 4: Verification

- [ ] `npx tsc --noEmit && npm test` green (2 known pre-existing). Our files eslint-clean.
- [ ] `npm run build` succeeds; `npm run cross-stats` no "missing transcription".
- [ ] Dev smoke: `?mode=zoning&district=NC-3` (FAR, uses, §712 link), `&district=NCT-3` (form-based density), `&district=CRNC`. Confirm a Phase-5 district (e.g. MB-RA) still shows fallback.
