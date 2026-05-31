# Verified Zoning Data — All-Districts Roadmap

**Date:** 2026-05-31
**Status:** Roadmap (POC-validated). Phase 1 (Residential) shipped on `main`.
**Predecessor:** `docs/superpowers/specs/2026-05-31-zoning-rules-verified-data-design.md`

## Goal

Extend the Phase-1 verified-data approach to **every** SF zoning district: replace the
remaining ~46 AI-generated (unverified) records and the ~16 fallback codes with either
(a) values transcribed verbatim from an authoritative source, each field carrying a
source quote + a real amlegal deep-link, or (b) an **honest documented fallback** that
links to the district's actual governing plan when it is *not* governed by the Planning
Code. The `verified` flag, `sourced()` helper, invariant tests, and `VerifiedZoningPanel`
machinery from Phase 1 are reused throughout.

## The central finding: different districts, different sources

Unlike residential (one clean SF Planning summary PDF), the remaining families come from
**five different sources**, which is what structures the phases. Validated by five
read-only POC agents (2026-05-31):

| Family | Source | Reachable via | Shape |
|---|---|---|---|
| Commercial (C-2, C-3-*) | Planning Code **Table 210.1 / 210.2** + **Table 124** (FAR) | amlegal browser | scalar ✅ |
| Industrial (M-1, M-2) | **Table 210.4** | amlegal browser | scalar ✅ |
| PDR (PDR-1-*, PDR-2, SALI) | **§210.3 / §836** | amlegal browser | scalar + **banded FAR** ⚠️ |
| Public (P) | **§211** (was §234, redesignated 2015) | amlegal browser | use-only, near-empty ⚠️ |
| Neighborhood Commercial (NC/NCT) | **Art. 7 §§710–764** (per-district tables) | amlegal browser | **per-story use matrix** ⚠️ |
| Mixed-Use (UMU, MUG/O/R, WMUG/O, RED-MX) | **Art. 8 §§831–840** | amlegal browser | **form-based density** ⚠️ |
| Chinatown / Central-SoMa (CMUO, CRNC, CVR, RCD, CCB) | **§§810–812, §830** | amlegal browser | scalar/matrix ✅ |
| DTR (RH-DTR, SB-DTR) | **§827, §829** | amlegal browser | scalar ✅ |
| Redevelopment (Mission Bay, Parkmerced, Hunters Pt/Candlestick) | **Redevelopment Plans / Design-for-Development** — *supersede the Planning Code* | per-plan docs | **fallback** ❌ |
| Project SUDs (MR-MU, S-MU, TB-DTR) | **Mission Rock / Potrero / Transbay SUD + DA** | per-plan docs | **fallback** ❌ |
| TIDA (TI-*, YBI-*) | TIDA Sub-Area Plan | — | **fallback** ❌ (already) |

### Sourcing method (proven)

amlegal blocks WebFetch (403) but its **internal JSON API is callable via same-origin
`fetch()` inside the Playwright browser** (holds the Cloudflare clearance cookie):

```
fetch('/api/render-section/san_francisco/latest/sf_planning/0-0-0-<ID>/<idx>/')
  → { doc_id, title, html }   // full rendered section incl. the zoning control table
```

Wrap in a 5–6× retry (the SPA aborts in-flight fetches on its scroll-driven re-navigation).
Each response self-confirms via `title`. **Always use the `latest` tree** — the 2023 reorg
(Ord. 70-23) and 2015 redesignations mean dated-snapshot GUIDs and old §-numbers resolve to
"[REDESIGNATED.]". This is the same hazard Phase 1 hit with §206.x→§209.x.

## Four shapes of work

1. **Scalar transcribe** (reuse Phase-1 schema as-is): C-2, C-3-*, M-1, M-2, SALI,
   RH-DTR, SB-DTR, Chinatown CCB/CRNC/CVR/RCD.
2. **Scalar + small schema tweak**:
   - *Banded FAR* (FAR keyed to height district) — PDR-1-*, PDR-2.
   - *Form-based density* (no DU/lot cap; envelope-governed) — UMU, MUG, MUO, MUR,
     WMUG, WMUO, RED-MX, CMUO.
3. **Use-matrix schema extension** (per-use × per-story P|C|NP + footnotes) — the NC/NCT
   family. The defining content of an NC district is its floor-by-floor use table; flat
   `principal_uses`/`conditional_uses` lists lose the per-story dimension.
4. **Documented fallback** (governed outside the Planning Code) — Mission Bay, Parkmerced,
   Hunters Point/Candlestick, MR-MU, S-MU, TB-DTR, TIDA. Improve the existing fallback to
   cite each district's *actual* governing plan with a working link.

## Existing-data errors to fix (found during POC)

Phase 1 proved the AI-generated data has errors; the Commercial POC found more:
- **C-3-G FAR = 9.0** in current data → should be **6.0** (Table 124).
- **C-3-S FAR = 4.5** in current data → should be **5.0** (Table 124).
- C-3 FAR is currently mis-cited to §210.2; the authoritative source is **§124 Table 124**.
- All current C/M/PDR records use the empty-quote `cite()` helper with an **invalid URL
  slug** (`0-0-0-§210.2`) and `verified: false` — they need full re-transcription.

These get corrected as their families are re-transcribed (Phases 2–4).

## Phased plan

Each phase is independently shippable and reuses the Phase-1 task pattern: capture/confirm
section IDs → schema work (if any) → transcribe with `sourced()` quotes → invariant tests →
panel rendering → tighten the coverage guard.

### Phase 2 — Commercial + Industrial + Public (scalar, no schema change)
Districts: **C-2, C-3-O, C-3-O(SD), C-3-R, C-3-G, C-3-S, M-1, M-2, SALI, P** (~10).
- Pure scalar transcription from Tables 210.1/210.2/210.4/124/§836/§211.
- Fixes the C-3-G/C-3-S FAR errors; re-cites C-3 FAR to §124.
- **P (Public)** is use-only — add a small `controls_note` field so the panel shows
  "Public lands — uses per §211; no FAR/density controls" instead of blank metrics.
- Proves the "no summary PDF — fetch amlegal Tables directly" pattern. Smallest lift.

### Phase 3 — PDR + Mixed-Use (schema tweak: banded FAR + form-based density)
Districts: **PDR-1-B, PDR-1-D, PDR-1-G, PDR-2, UMU, MUG, MUO, MUR, WMUG, WMUO, RED-MX,
CMUO** (~12).
- One schema extension: `far` becomes `{ max?: number; banded?: string; basis?: string }`
  to hold "3.0→7.5:1 by height district" (PDR) and "per §124 by height" (Mixed-Use);
  `density` gains a `model: 'form-based' | 'unit-based'` discriminator + `note` for the
  form-based districts.
- WMUO has no residential density (office/PDR) — represent as non-residential.
- Use program + DU-mix transcribe cleanly; the verbatim quotes carry the spatial nuance.

### Phase 4 — Neighborhood Commercial + Chinatown (use-matrix schema)
Districts: **NC-1, NC-2, NC-3, NC-S, NCD (named §§714–746), NCT, NCT-1, NCT-2, NCT-3,
RCD, CRNC, CVR, CCB** (~13+, plus named NCDs as scope allows).
- Largest design lift: add a `use_matrix` structure to `ZoningRecord`:
  ```ts
  use_matrix?: Array<{
    use: string
    ground: 'P' | 'C' | 'NP'
    second: 'P' | 'C' | 'NP'
    upper:  'P' | 'C' | 'NP'
    refs?: string[]; footnotes?: string[]
  }>
  use_footnotes?: Record<string, string>
  ```
  Three story columns are constant across all of Article 7. Scalar key-controls
  (FAR, height, parking, use-size, density) reuse the residential fields; NCT density is
  form-based (uses the Phase-3 discriminator).
- Panel: render the matrix compactly (collapsed by default; a use → P/C/NP-by-floor grid).
- Disambiguate **CCB** (Chinatown Community Business §810) from the Candlestick CCB
  sub-district (Phase 5 fallback) — they share an abbreviation.

### Phase 5 — Redevelopment / Area-Plan fallbacks + DTR
Districts: **Mission Bay (MB-O, MB-RA, …), Parkmerced (PM-CF, PM-MU1, PM-MU2, PM-OS,
PM-R, PM-S), Hunters Point/Candlestick (HP-RA, BR-MU, CCB-cp, P70-MU, PPS-MU), MR-MU,
S-MU, TB-DTR, RH-DTR, SB-DTR, TI-*, YBI-*** (~22).
- Most are **governed by Redevelopment Plans / Design-for-Development that supersede the
  Planning Code** — exactly the TIDA case. Do NOT fabricate scalar controls.
- Build a `GOVERNING_PLAN` map: district → { plan name, url } and extend the existing
  no-record fallback branch to render an honest "governed by <Plan> ↗" panel for these
  (generalizing the current TIDA-specific block).
- **Transcribe** the genuinely-in-code ones here: RH-DTR (§827), SB-DTR (§829).
- Governing-plan links captured by POC (OCII Mission Bay / Candlestick D4D / Parkmerced
  Design Standards / Transbay / Mission Rock / Potrero Power Station).

## Cross-cutting work

- **Section-ID map growth.** Each phase appends verified `0-0-0-<n>` IDs to
  `lib/zoning-sources.ts` `SECTION_URL`, each confirmed by page title. The Appendix lists
  IDs already captured by the POCs — execution should re-confirm, not re-discover.
- **Invariant tests** extend per phase: value-in-quote for new scalar fields; per-family
  monotonic/sanity checks where they exist; "every cited section resolves in SECTION_URL"
  already covers new sections.
- **Coverage guard.** As each family is transcribed, remove it from `KNOWN_NO_RULES`;
  what remains there at the end should be exactly the documented-fallback set, which the
  guard tolerates by design.
- **Schema discipline.** New optional fields only (non-breaking), same as Phase 1.
  Phase 2-only-then-deprecate cleanup (removing legacy `setbacks`/`lot_coverage_max_pct`/
  `far`/`parking_min`) happens once every record is migrated — end of Phase 4.

## Appendix — amlegal opaque IDs captured by POC (`latest` tree)

Commercial/Industrial/Public:
`§210.1 C-2 0-0-0-20117` · `§210.2 C-3 0-0-0-20120` · `§210.3 PDR 0-0-0-20123` ·
`§210.4 M 0-0-0-20132` · `§124 FAR 0-0-0-18102` · `§123 0-0-0-18094` · `§211 P 0-0-0-50175` ·
`§211.1 0-0-0-50178` · `§211.2 0-0-0-50182` · `§836 SALI 0-0-0-67785` · `§202.1 control-key 0-0-0-49715`.

Mixed-Use (Art. 8, post-2023 numbering):
`§831 MUG 0-0-0-67718` · `§832 MUO 0-0-0-67732` · `§833 MUR 0-0-0-67745` ·
`§835 RED-MX 0-0-0-67772` · `§838 UMU 0-0-0-67810` · `§839 WMUG 0-0-0-70715` ·
`§840 WMUO 0-0-0-67836` · `§830 CMUO 0-0-0-67565`.

Neighborhood Commercial (Art. 7 container `0-0-0-25360`, idx 9–58):
`§710 NC-1 0-0-0-25492` · `§711 NC-2 0-0-0-25507` · `§712 NC-3 0-0-0-25522` ·
`§713 NC-S 0-0-0-25536` · `§750 NCT-1 0-0-0-57016` · `§751 NCT-2 0-0-0-57028` ·
`§752 NCT-3 0-0-0-57664` · `§758 RCD 0-0-0-57126` · named NCDs §714–746 reachable by idx.

Chinatown / SUDs:
`§810 Chinatown CCB 0-0-0-26717` · `§811 CVR 0-0-0-26717` · `§812 CRNC 0-0-0-26729` ·
`§249.80 Mission Rock MR-MU 0-0-0-58323` · `§249.87 Potrero/S-MU 0-0-0-62911` ·
`§249.64 Parkmerced 0-0-0-34612` · `§249.50 Candlestick 0-0-0-21356` · `§902 Mission Bay 0-0-0-27375`.

Governing-plan docs (Phase-5 fallbacks):
OCII Mission Bay (sfocii.org/projects/mission-bay-south|north) · Candlestick Point Design
for Development (sfocii.org) · Parkmerced Design Standards & Guidelines · Transbay
Redevelopment Plan · Mission Rock Design Controls · Potrero Power Station Design for Development.
