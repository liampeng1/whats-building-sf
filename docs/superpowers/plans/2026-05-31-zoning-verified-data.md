# Verified Zoning-Rules Data (Phase 1: Residential) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the residential zoning-rules records with values transcribed from the official SF Planning summary table, each field carrying a verbatim source quote and a correct code deep-link, guarded by mechanical invariant tests.

**Architecture:** Additive, non-breaking schema migration. We extend `CodeCitation` with an optional `quote`, add new value fields + a `verified` flag to `ZoningRecord`, and introduce a `sourced()` helper that builds citations with real amlegal URLs from a verified `SECTION_URL` map. The existing 39 non-residential records stay untouched (they read as `verified !== true`); only the ~13 residential records are rewritten with verified data. Invariant tests and the panel operate over verified records.

**Tech Stack:** TypeScript, Next.js App Router, Jest, tsx (build scripts).

**Spec:** `docs/superpowers/specs/2026-05-31-zoning-rules-verified-data-design.md`

**Migration note (refines spec §B):** the spec described removing `setbacks`/`lot_coverage_max_pct` and renaming `far`. To keep the build green without rewriting 39 legacy records in this phase, we instead **deprecate** those fields (keep them optional) and stop populating them in verified records. Phase 2 deletes them once every record is migrated.

---

## File Structure

- `__fixtures__/zoning/residential-summary.txt` — **Create.** Verbatim text of the official SF Planning residential summary table (the transcription source-of-truth, committed for reviewer diffing).
- `lib/zoning-sources.ts` — **Create.** `SECTION_URL` opaque-ID map + `sourced(section, quote)` helper. Isolated so the amlegal-ID artifact has one home.
- `lib/zoning-rules.ts` — **Modify.** Extend `CodeCitation`/`ZoningRecord` types; add `verified` flag; rewrite the residential records.
- `__tests__/zoning-rules.test.ts` — **Modify.** Add the four invariant tests; keep existing schema tests.
- `__tests__/zoning-sources.test.ts` — **Create.** Assert every cited `§` has a `SECTION_URL` entry and URL shape.
- `scripts/build-cross-stats.ts:320-333` — **Modify.** Remove now-transcribed residential codes from `KNOWN_NO_RULES`.
- `components/ZoningDistrictPanel.tsx` — **Modify.** Render verified records richly (new rows, verbatim quotes, correct source links); unverified records keep current rendering.

---

## Task 1: Capture source artifacts (PDF fixture + verified section-ID map)

**Files:**
- Create: `__fixtures__/zoning/residential-summary.txt`
- Create: `lib/zoning-sources.ts`
- Test: `__tests__/zoning-sources.test.ts`

- [ ] **Step 1: Save the source table as a fixture**

The official PDF was already downloaded and read during design. Paste its full
extracted table text (RH-1(D) … RTO rows, including the NOTES block) verbatim into
`__fixtures__/zoning/residential-summary.txt`. Prepend a 2-line provenance header:

```
# Source: SF Planning — Summary of Planning Code Standards for Residential Districts (rev. 09/2008)
# URL: https://default.sfplanning.org/publications_reports/residential_districts_controls_summary_table.pdf
```

- [ ] **Step 2: Capture + verify amlegal section IDs (browser)**

For each section the residential records cite (`§121`, `§124`, `§132`, `§134`,
`§135`, `§206.1`, `§206.2`, `§206.3`, `§206.4`, `§207`, `§207.6`, `§209.1`,
`§209.2`, `§813`, `§151.1`, `§261`), navigate the Playwright browser to candidate
amlegal URLs and record the opaque ID whose **page title matches the section**.
Known-good (verified during design): `§207 → 0-0-0-19952`, `§209.2 → 0-0-0-56337`.
Use the on-page search / the elaws mirror to find the rest, then confirm each by
loading `…/sf_planning/0-0-0-<id>` and reading the title.

- [ ] **Step 3: Write `lib/zoning-sources.ts`**

```ts
/** Verified amlegal opaque-ID map for SF Planning Code sections. Each ID was
 *  confirmed by loading the page and matching its title to the section number.
 *  See docs/superpowers/specs/2026-05-31-zoning-rules-verified-data-design.md §D. */
export interface CodeCitation {
  section: string   // e.g. "§207"
  url: string
  quote: string     // verbatim source sentence (may be "" for legacy/unverified)
  article?: string  // legacy field, retained for old records
}

const AMLEGAL = 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning'

// section → amlegal opaque ID (filled from Step 2; example entries shown)
export const SECTION_URL: Record<string, string> = {
  '§207': '0-0-0-19952',
  '§209.2': '0-0-0-56337',
  // …§121, §124, §132, §134, §135, §206.1-4, §207.6, §209.1, §813, §151.1, §261
}

/** Build a verified citation: real amlegal URL + verbatim quote.
 *  IDs are stored with their full `0-0-0-<n>` form, so the URL is a plain join. */
export function sourced(section: string, quote: string): CodeCitation {
  const id = SECTION_URL[section]
  return { section, quote, url: id ? `${AMLEGAL}/${id}` : AMLEGAL }
}
```

- [ ] **Step 4: Write the link-integrity test**

```ts
// __tests__/zoning-sources.test.ts
import { SECTION_URL, sourced } from '../lib/zoning-sources'

describe('zoning sources', () => {
  it('every SECTION_URL id has the amlegal opaque-id shape', () => {
    for (const [section, id] of Object.entries(SECTION_URL)) {
      expect(section).toMatch(/^§/)
      expect(id).toMatch(/^0-0-0-\d+$/)
    }
  })
  it('sourced() builds a full amlegal url for known sections', () => {
    const c = sourced('§207', 'one dwelling unit per 600 sq.ft. of lot area')
    expect(c.url).toBe('https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/0-0-0-19952')
    expect(c.quote).toContain('600')
  })
})
```

- [ ] **Step 5: Run the test**

Run: `npm test -- __tests__/zoning-sources.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add __fixtures__/zoning/residential-summary.txt lib/zoning-sources.ts __tests__/zoning-sources.test.ts
git commit -m "feat(zoning): source fixture + verified amlegal section-id map"
```

---

## Task 2: Extend the record schema (non-breaking)

**Files:**
- Modify: `lib/zoning-rules.ts:14-37` (interfaces)
- Test: `__tests__/zoning-rules.test.ts`

- [ ] **Step 1: Add a typecheck-only failing expectation**

Add this test (it will fail to compile until the types exist):

```ts
// in __tests__/zoning-rules.test.ts
import type { ZoningRecord } from '../lib/zoning-rules'
it('ZoningRecord supports verified fields', () => {
  const r = ZONING_RULES['RH-1'] as ZoningRecord
  // these property accesses must typecheck
  void r.verified; void r.name; void r.open_space_per_unit; void r.min_lot
  expect(true).toBe(true)
})
```

- [ ] **Step 2: Run typecheck to verify it fails**

Run: `npx tsc --noEmit`
Expected: FAIL — `Property 'verified' does not exist on type 'ZoningRecord'`.

- [ ] **Step 3: Extend the interfaces in `lib/zoning-rules.ts`**

Replace the `CodeCitation` import/definition and `ZoningRecord` interface. Import the
shared `CodeCitation` from `lib/zoning-sources.ts` and extend `ZoningRecord`:

```ts
import { type CodeCitation, sourced, SECTION_URL } from './zoning-sources'

export interface DensityRule {
  units_per_lot?: number
  sqft_per_unit?: number
  du_per_acre?: number        // retained for legacy NCT records
  max_units?: number
  cu_pathway?: string
  note?: string
}

export interface ZoningRecord {
  code: string
  name?: string                              // NEW
  classification?: CodeCitation              // NEW (§206.x)
  verified?: boolean                         // NEW — true once transcribed from source

  density: DensityRule
  far?: { max: number; note?: string }                 // legacy (deprecated; non-resi only)
  far_non_residential?: { max: number; note?: string } // NEW (PDF "Other than Dwellings")
  min_lot?: { width_ft: number; area_sqft: number }    // NEW
  open_space_per_unit?: { private_sqft: number; note?: string } // NEW
  principal_uses: string[]
  conditional_uses?: string[]                // NEW
  front_setback_text?: string                // NEW (verbatim)
  rear_yard_text?: string                    // NEW (verbatim)
  dwelling_unit_mix_text?: string            // NEW
  parking_text?: string                      // NEW

  // legacy fields (deprecated — Phase 2 removes; kept so old records compile)
  parking_min?: { residential?: string; commercial?: string }
  setbacks?: { front_ft?: number; rear_ft?: number; side_ft?: number }
  lot_coverage_max_pct?: number

  source: {
    density: CodeCitation
    far?: CodeCitation
    far_non_residential?: CodeCitation
    min_lot?: CodeCitation
    open_space?: CodeCitation
    principal_uses: CodeCitation
    conditional_uses?: CodeCitation
    front_setback?: CodeCitation
    rear_yard?: CodeCitation
    dwelling_unit_mix?: CodeCitation
    parking?: CodeCitation
    parking_min?: CodeCitation              // legacy alias used by old records
    setbacks?: CodeCitation
    lot_coverage_max_pct?: CodeCitation
    retrieved_at: string
    document?: string
    document_url?: string
  }
}
```

Keep the existing `cite(article, section)` helper as-is (old records still call it);
its return now satisfies `CodeCitation` because `quote` is required on the interface —
so add a default: change `cite()` to return `{ article, section, url, quote: '' }`.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (all 52 old records still satisfy the widened interface; new test compiles).

- [ ] **Step 5: Run the full test suite (nothing should regress)**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/zoning-rules.ts __tests__/zoning-rules.test.ts
git commit -m "feat(zoning): non-breaking schema extension for verified records"
```

---

## Task 3: Transcribe & verify the residential records

**Files:**
- Modify: `lib/zoning-rules.ts` (residential records)
- Test: `__tests__/zoning-rules.test.ts`

Transcribe all residential rows from `__fixtures__/zoning/residential-summary.txt`:
`RH-1(D)`, `RH-1`, `RH-1(S)`, `RH-2`, `RH-3`, `RM-1`, `RM-2`, `RM-3`, `RM-4`,
`RC-3`, `RC-4`, `RED`, `RTO` (map `RTO` → DataSF `RTO-1`/`RTO-M`/`RTO-C` per the live
code set). Replace any existing record for these codes; add the missing ones. Every
field uses `sourced(section, "<verbatim quote from fixture>")` and sets `verified: true`.

- [ ] **Step 1: Write the invariant tests first**

```ts
// __tests__/zoning-rules.test.ts — add this block
import { ZONING_RULES } from '../lib/zoning-rules'
import { SECTION_URL } from '../lib/zoning-sources'

const verified = () =>
  Object.values(ZONING_RULES).filter((r) => r.verified === true)

describe('verified zoning records', () => {
  it('has at least the 13 residential records', () => {
    expect(verified().length).toBeGreaterThanOrEqual(13)
  })

  it('every numeric value appears verbatim in its own source quote', () => {
    for (const r of verified()) {
      const checks: Array<[number | undefined, string | undefined]> = [
        [r.density.sqft_per_unit, r.source.density.quote],
        [r.density.units_per_lot, r.source.density.quote],
        [r.far_non_residential?.max, r.source.far_non_residential?.quote],
        [r.open_space_per_unit?.private_sqft, r.source.open_space?.quote],
        [r.min_lot?.width_ft, r.source.min_lot?.quote],
        [r.min_lot?.area_sqft, r.source.min_lot?.quote],
      ]
      for (const [val, quote] of checks) {
        if (val == null) continue
        expect(quote, `${r.code}: value ${val} needs a quote`).toBeTruthy()
        expect(String(quote), `${r.code}: ${val} not found in quote "${quote}"`)
          .toContain(String(val))
      }
    }
  })

  it('density sqft_per_unit ramps down RM-1 ≥ RM-2 ≥ RM-3 ≥ RM-4', () => {
    const sf = (c: string) => ZONING_RULES[c].density.sqft_per_unit!
    expect(sf('RM-1')).toBeGreaterThanOrEqual(sf('RM-2'))
    expect(sf('RM-2')).toBeGreaterThanOrEqual(sf('RM-3'))
    expect(sf('RM-3')).toBeGreaterThanOrEqual(sf('RM-4'))
  })

  it('open space ramps down and FAR ramps up across RM density', () => {
    const os = (c: string) => ZONING_RULES[c].open_space_per_unit!.private_sqft
    const far = (c: string) => ZONING_RULES[c].far_non_residential!.max
    expect(os('RM-1')).toBeGreaterThanOrEqual(os('RM-4'))
    expect(far('RM-1')).toBeLessThanOrEqual(far('RM-4'))
  })

  it('every verified field with a value has a non-empty quote', () => {
    for (const r of verified()) {
      expect(r.name).toBeTruthy()
      expect(r.source.density.quote).not.toBe('')
      expect(r.source.document_url).toMatch(/^https?:\/\//)
    }
  })

  it('every cited section resolves in SECTION_URL', () => {
    for (const r of verified()) {
      for (const c of Object.values(r.source)) {
        if (c && typeof c === 'object' && 'section' in c) {
          expect(SECTION_URL[(c as { section: string }).section]).toBeDefined()
        }
      }
    }
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- __tests__/zoning-rules.test.ts`
Expected: FAIL (`has at least the 13 residential records` → 0 verified records).

- [ ] **Step 3: Transcribe the records**

Replace/add each residential record. Worked example (`RM-2`) — follow this exact
shape for every row, pulling quotes verbatim from the fixture:

```ts
'RM-2': {
  code: 'RM-2',
  name: 'Mixed (Apartments and Houses), Moderate Density',
  classification: sourced('§206.2', 'RM (Residential, Mixed) Districts'),
  verified: true,
  density: { units_per_lot: 3, sqft_per_unit: 600 },
  far_non_residential: { max: 1.8 },
  min_lot: { width_ft: 25, area_sqft: 2500 },
  open_space_per_unit: { private_sqft: 80 },
  principal_uses: ['Multi-family dwelling', 'Group housing, boarding', 'Group housing, religious orders'],
  conditional_uses: ['Group housing (medical/educational institutions)', 'Hotel up to 5 rooms'],
  front_setback_text: 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth',
  rear_yard_text: '45% of lot depth, except reductions based on average of adjacent buildings; if averaged, last 10 ft. limited to 30 ft. height and min 25% of lot depth, no less than 15 feet',
  source: {
    density: sourced('§207', 'Three dwelling units per lot or one dwelling unit per 600 sq.ft. of lot area'),
    far_non_residential: sourced('§124', '1.8 times lot area'),
    min_lot: sourced('§121', 'Width: 25 ft. Area: 2500 sq.ft.'),
    open_space: sourced('§135', '80 sq.ft. per unit if all private; common space substituted must be 1/3 greater'),
    principal_uses: sourced('§§209–209.9', 'Same uses as above, plus: Group housing, boarding; group housing, religious orders'),
    conditional_uses: sourced('§§209–209.9', 'Same uses as above, excluding those listed in previous column as principal uses'),
    front_setback: sourced('§132', 'Based upon average of adjacent buildings; up to 15 ft. or 15% of lot depth'),
    rear_yard: sourced('§134', '45% of lot depth, except of reductions based upon average of adjacent buildings…'),
    retrieved_at: '2026-05-31',
    document: 'SF Planning — Summary of Planning Code Standards for Residential Districts (rev. 09/2008)',
    document_url: 'https://default.sfplanning.org/publications_reports/residential_districts_controls_summary_table.pdf',
  },
},
```

Verified density/FAR/open-space values from the fixture (for the ramp tests):
`RM-1` 800 sf / FAR 1.8 / OS 100 · `RM-2` 600 / 1.8 / 80 · `RM-3` 400 / 3.6 / 60 ·
`RM-4` 200 / 4.8 / 36. `RC-3` 400 / 3.6 / 60 · `RC-4` 200 / 4.8 / 36. `RH-1` density
"1 per lot; up to 1 per 3000 sf, max 3, with CU" → `{ units_per_lot: 1, sqft_per_unit: 3000, max_units: 3, cu_pathway: '…with conditional use approval' }`.
Add `§§209–209.9` to `SECTION_URL` (use the §209.1 id as the anchor for the range).

- [ ] **Step 4: Run the invariant tests**

Run: `npm test -- __tests__/zoning-rules.test.ts`
Expected: PASS (any typo in a transcribed number fails "value appears in quote").

- [ ] **Step 5: Typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/zoning-rules.ts lib/zoning-sources.ts __tests__/zoning-rules.test.ts
git commit -m "feat(zoning): verified residential records with source quotes"
```

---

## Task 4: Update the build coverage guard

**Files:**
- Modify: `scripts/build-cross-stats.ts:320-333`

- [ ] **Step 1: Remove now-transcribed residential codes from `KNOWN_NO_RULES`**

Delete the residential entries that now have records: `RM-2`, `RM-3`, `RM-4`,
`RTO-1`, `RTO-M`, and `RH-1(D)`, `RH-1(S)` if present. Leave TIDA (`TI-*`, `YBI-*`)
and the still-untranscribed non-residential codes (`UMU`, `SALI`, `S-MU`, `SPD`,
`WMUO`, `SB-DTR`, etc.) for Phase 2.

- [ ] **Step 2: Run the coverage build (dry check)**

Run: `npm run cross-stats`
Expected: completes; logs `✓ zoning-rules coverage: N/M transcribed` with the
residential codes no longer counted as fallback. If it throws "missing transcription",
a residential `zoning_sim` variant wasn't added — reconcile the code name (e.g.
`RTO-1` vs `RTO`) against the live DataSF set and add it in Task 3.

- [ ] **Step 3: Commit**

```bash
git add scripts/build-cross-stats.ts
git commit -m "feat(zoning): require verified residential records in coverage guard"
```

---

## Task 5: Render verified records in the panel

**Files:**
- Modify: `components/ZoningDistrictPanel.tsx:126-205` (rule rows) and `:246-302` (sources)
- Test: `__tests__/components/directory/ZoningDirectory.test.tsx` (or add panel test)

- [ ] **Step 1: Write a failing render test**

```ts
// __tests__/ZoningDistrictPanel.test.tsx (create)
import { render, screen } from '@testing-library/react'
import { ZoningDistrictPanel } from '../components/ZoningDistrictPanel'

it('shows verified RM-2 rules, a verbatim quote, and a real amlegal link', () => {
  render(<ZoningDistrictPanel zoningSim="RM-2" gen="Residential" districtName="RM-2" onClose={() => {}} />)
  expect(screen.getByText(/600 sq\.ft\./i)).toBeInTheDocument()           // verbatim quote shown
  expect(screen.getByText(/80 sq\.ft\. per unit/i)).toBeInTheDocument()   // open space
  const link = screen.getByRole('link', { name: /§207/i }) as HTMLAnchorElement
  expect(link.href).toContain('/sf_planning/0-0-0-19952')                 // correct deep-link
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- __tests__/ZoningDistrictPanel.test.tsx`
Expected: FAIL (RM-2 currently renders the no-record fallback).

- [ ] **Step 3: Branch rendering on `verified`**

In `ZoningDistrictPanel`, after `const rec = ...`, when `rec?.verified` render the new
rows from the new fields: density (units/lot + `1 per N sf` + CU pathway), FAR
(labelled "FAR (non-residential)"), min lot, open space, principal + conditional uses,
and the verbatim `front_setback_text`/`rear_yard_text`. Under each rule row, render its
`source.<field>.quote` in a muted style (progressive disclosure: a `<details>` "what
the code says"). In the Sources block, link `rec.source.document` →
`rec.source.document_url`, and render one `§`-link per populated `source.<field>` using
its `.url`. Leave the existing unverified/`!rec` branches unchanged.

Replace the legacy reads (`rec.parking_min`, `rec.far?.max`, `rec.setbacks`,
`rec.lot_coverage_max_pct`) with the verified-field reads inside the `verified` branch;
keep them only in the unverified branch.

- [ ] **Step 4: Run the render test**

Run: `npm test -- __tests__/ZoningDistrictPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/ZoningDistrictPanel.tsx __tests__/ZoningDistrictPanel.test.tsx
git commit -m "feat(zoning): render verified rules, verbatim quotes, real source links"
```

---

## Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck, lint, tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all PASS.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: succeeds (App Router build typechecks the panel).

- [ ] **Step 3: Manual smoke (the original bug)**

Run: `npm run dev`, open `http://localhost:3000/?mode=zoning&district=RM-2`.
Expected: panel shows density (1 unit per 600 sf), FAR, min lot, open space, uses,
a "what the code says" quote, and a working `§207` link to amlegal `0-0-0-19952`.
Repeat for `RM-4` and `RTO-1`.

- [ ] **Step 4: Confirm no regression on an unverified district**

Open `?mode=zoning&district=UMU`. Expected: unchanged fallback panel (still
`verified !== true`).

- [ ] **Step 5: Final commit (if any cleanup)**

```bash
git add -A && git commit -m "chore(zoning): phase-1 verified residential data complete"
```

---

## Phase 2 (separate plan, not this one)

Re-verify and replace the remaining AI-generated records (NC/NCT, C, M, PDR,
mixed-use, redevelopment) from companion Commercial/Industrial summary tables or the
code mirror; then delete the deprecated `far`/`setbacks`/`lot_coverage_max_pct`/
`parking_min` fields and the legacy `cite()` helper once no record uses them.
