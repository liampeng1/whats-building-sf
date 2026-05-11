export interface GlossaryEntry {
  term: string
  definition: string
  source?: { article: string; section: string; url: string }
}

const AMLEGAL = 'https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning'

export const GLOSSARY: Record<string, GlossaryEntry> = {
  'FAR': {
    term: 'FAR',
    definition: 'Floor Area Ratio — the building floor area divided by the lot area. A FAR of 3.6 on a 5,000 sf lot allows up to 18,000 sf of building.',
    source: { article: 'Article 1.2', section: '§123', url: `${AMLEGAL}/0-0-0-123` },
  },
  'density': {
    term: 'density',
    definition: 'How many dwelling units are allowed on a lot. Expressed as either units-per-lot (e.g. RH-1 = 1) or units-per-acre (e.g. NCT-3 = 174 DU/acre).',
  },
  'setback': {
    term: 'setback',
    definition: 'Required clear distance between a building and a lot line. Front, rear, and side setbacks each have their own rules per district.',
    source: { article: 'Article 2', section: '§132', url: `${AMLEGAL}/0-0-0-132` },
  },
  'lot coverage': {
    term: 'lot coverage',
    definition: 'Maximum percentage of the lot area that can be covered by buildings. RH-1 caps at 45%, leaving 55% for yards.',
  },
  'principal use': {
    term: 'principal use',
    definition: 'The use type permitted by-right (no special hearing) in a zoning district. Marked "P" in the use tables. Compare with conditional ("C") and not-permitted ("NP").',
  },
  'ADU': {
    term: 'ADU',
    definition: 'Accessory Dwelling Unit — a small secondary home on the same lot. California state law (Gov. Code §65852.2) allows up to 2 ADUs on any residential lot, overriding stricter local zoning.',
  },
  'bulk control': {
    term: 'bulk control',
    definition: "Limits on a building's size beyond height — e.g. maximum diagonal dimension, plan dimension, or volume. Encoded as a letter on the height-bulk district code: \"240-S\" = 240 ft height, bulk control S.",
  },
}

export function getGlossaryEntry(term: string): GlossaryEntry | undefined {
  const lower = term.toLowerCase()
  for (const [key, entry] of Object.entries(GLOSSARY)) {
    if (key.toLowerCase() === lower) return entry
  }
  return undefined
}
