/**
 * Transcribed zoning-rule values per SF zoning_sim code. Source-of-truth
 * is the SF Planning Code; every field carries a per-record citation.
 *
 * Transcription is a one-time job. When the Planning Code is amended,
 * re-transcribe the affected sections and bump retrieved_at.
 *
 * Build-time validation in scripts/build-cross-stats.ts verifies that
 * every zoning_sim from DataSF has a matching record here.
 *
 * Schema reference: docs/superpowers/specs/2026-05-10-improvements-design.md §1a
 */

import type { FamilyLawEligibility } from './family-zoning'

export interface CodeCitation {
  article: string
  section: string
  url: string
}

export interface ZoningRecord {
  code: string
  density: { units_per_lot?: number; du_per_acre?: number; note?: string }
  far?: { max: number; note?: string }
  principal_uses: string[]
  parking_min: { residential?: string; commercial?: string }
  setbacks?: { front_ft?: number; rear_ft?: number; side_ft?: number }
  lot_coverage_max_pct?: number
  family_laws: FamilyLawEligibility[]
  source: {
    density: CodeCitation
    far?: CodeCitation
    principal_uses: CodeCitation
    parking_min: CodeCitation
    setbacks?: CodeCitation
    lot_coverage_max_pct?: CodeCitation
    retrieved_at: string
  }
}

const AMLEGAL = 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning'

function cite(article: string, section: string): CodeCitation {
  // The amlegal URL fragment for each section is unstable; we link to the
  // article-level page so readers can search by section. Acceptable trade-
  // off: stable links over deep-section anchors that the publisher rewrites.
  const sectionSlug = section.replace(/[§\s]/g, '')
  return {
    article,
    section,
    url: `${AMLEGAL}/0-0-0-${sectionSlug}`,
  }
}

const RETRIEVED = '2026-05-10'

export const ZONING_RULES: Record<string, ZoningRecord> = {
  'RH-1': {
    code: 'RH-1',
    density: { units_per_lot: 1 },
    far: { max: 1.8, note: 'See §123 for FAR controls' },
    principal_uses: ['Single-family dwelling', 'ADU (state law)'],
    parking_min: {
      residential: '1 space per dwelling (no min near transit per AB-2097)',
    },
    setbacks: { front_ft: 15, rear_ft: 25, side_ft: 0 },
    lot_coverage_max_pct: 45,
    family_laws: [],
    source: {
      density: cite('Article 2', '§209'),
      far: cite('Article 1.2', '§123'),
      principal_uses: cite('Article 2', '§209'),
      parking_min: cite('Article 1.5', '§151.1'),
      setbacks: cite('Article 2', '§132'),
      lot_coverage_max_pct: cite('Article 2', '§209'),
      retrieved_at: RETRIEVED,
    },
  },
  'RH-2': {
    code: 'RH-2',
    density: { units_per_lot: 2 },
    principal_uses: ['Two-family dwelling', 'ADU (state law)'],
    parking_min: {
      residential: '1 space per dwelling (no min near transit per AB-2097)',
    },
    setbacks: { front_ft: 15, rear_ft: 25, side_ft: 0 },
    lot_coverage_max_pct: 45,
    family_laws: [],
    source: {
      density: cite('Article 2', '§209'),
      principal_uses: cite('Article 2', '§209'),
      parking_min: cite('Article 1.5', '§151.1'),
      setbacks: cite('Article 2', '§132'),
      lot_coverage_max_pct: cite('Article 2', '§209'),
      retrieved_at: RETRIEVED,
    },
  },
  'RH-3': {
    code: 'RH-3',
    density: { units_per_lot: 3 },
    principal_uses: ['Three-family dwelling', 'ADU (state law)'],
    parking_min: {
      residential: '1 space per dwelling (no min near transit per AB-2097)',
    },
    setbacks: { front_ft: 15, rear_ft: 25, side_ft: 0 },
    lot_coverage_max_pct: 45,
    family_laws: [],
    source: {
      density: cite('Article 2', '§209'),
      principal_uses: cite('Article 2', '§209'),
      parking_min: cite('Article 1.5', '§151.1'),
      setbacks: cite('Article 2', '§132'),
      lot_coverage_max_pct: cite('Article 2', '§209'),
      retrieved_at: RETRIEVED,
    },
  },
  'NCT-3': {
    code: 'NCT-3',
    density: {
      du_per_acre: 174,
      note: 'Moderate-Scale Neighborhood Commercial Transit District',
    },
    far: { max: 3.6 },
    principal_uses: [
      'Residential',
      'Ground-floor retail / restaurant',
      'Personal service uses',
    ],
    parking_min: {
      residential: '0 (transit-oriented)',
      commercial: '0',
    },
    setbacks: { front_ft: 0, rear_ft: 25 },
    lot_coverage_max_pct: 75,
    family_laws: [],
    source: {
      density: cite('Article 7', '§754'),
      far: cite('Article 1.2', '§124'),
      principal_uses: cite('Article 7', '§754'),
      parking_min: cite('Article 1.5', '§151.1'),
      setbacks: cite('Article 7', '§754'),
      lot_coverage_max_pct: cite('Article 7', '§754'),
      retrieved_at: RETRIEVED,
    },
  },
  'C-3-O': {
    code: 'C-3-O',
    density: { note: 'No specific density cap; controlled by height + FAR' },
    far: { max: 9.0 },
    principal_uses: [
      'Office',
      'Retail',
      'Residential (conditional above 24th floor)',
    ],
    parking_min: {
      commercial: 'Maximum (not minimum) — §151.1',
    },
    family_laws: [],
    source: {
      density: cite('Article 8', '§210.2'),
      far: cite('Article 1.2', '§124'),
      principal_uses: cite('Article 8', '§210.2'),
      parking_min: cite('Article 1.5', '§151.1'),
      retrieved_at: RETRIEVED,
    },
  },
}

export function getZoningRecord(code: string): ZoningRecord | undefined {
  return ZONING_RULES[code]
}
