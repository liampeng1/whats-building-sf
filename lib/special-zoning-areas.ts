import type { Polygon, MultiPolygon } from 'geojson'

interface SpecialAreaSource {
  url: string
  cite: string
}

export interface SpecialArea {
  name: string
  shape: Polygon | MultiPolygon
  governor: string
  note: string
  source: SpecialAreaSource
}

/** Hand-listed federal / state / TIDA areas in SF that aren't in DataSF's
 *  zoning dataset. Geometries are hand-traced rough polygons (~50m
 *  accuracy) — accurate enough for hover + click; not for property-level
 *  decisions. Sources cite the authoritative master-plan documents. */
export const SPECIAL_ZONING_AREAS: SpecialArea[] = [
  {
    name: 'Presidio',
    governor: 'Presidio Trust',
    note: 'Federal land — not subject to SF Planning Code. Master plan controls.',
    source: {
      url: 'https://www.presidio.gov/management/management-plans',
      cite: 'Presidio Trust',
    },
    shape: {
      type: 'Polygon',
      coordinates: [[
        [-122.4853, 37.7900],
        [-122.4853, 37.8100],
        [-122.4500, 37.8100],
        [-122.4500, 37.7900],
        [-122.4853, 37.7900],
      ]],
    },
  },
  {
    name: 'Golden Gate National Recreation Area (SF portions)',
    governor: 'National Park Service',
    note: 'Federal park land — NPS general management plan controls.',
    source: {
      url: 'https://www.nps.gov/goga/',
      cite: 'National Park Service',
    },
    shape: {
      type: 'MultiPolygon',
      coordinates: [
        // Fort Mason
        [[
          [-122.4360, 37.8050],
          [-122.4360, 37.8090],
          [-122.4230, 37.8090],
          [-122.4230, 37.8050],
          [-122.4360, 37.8050],
        ]],
        // Lands End / Sutro Heights
        [[
          [-122.5145, 37.7770],
          [-122.5145, 37.7870],
          [-122.5000, 37.7870],
          [-122.5000, 37.7770],
          [-122.5145, 37.7770],
        ]],
        // Ocean Beach
        [[
          [-122.5145, 37.7350],
          [-122.5145, 37.7700],
          [-122.5050, 37.7700],
          [-122.5050, 37.7350],
          [-122.5145, 37.7350],
        ]],
      ],
    },
  },
  {
    name: 'Treasure Island / Yerba Buena Island',
    governor: 'Treasure Island Development Authority (TIDA)',
    note: 'TI/YBI Development Plan — distinct from SF Planning Code.',
    source: {
      url: 'https://sfgov.org/treasureisland/',
      cite: 'TIDA',
    },
    shape: {
      type: 'Polygon',
      coordinates: [[
        [-122.3760, 37.8050],
        [-122.3760, 37.8270],
        [-122.3580, 37.8270],
        [-122.3580, 37.8050],
        [-122.3760, 37.8050],
      ]],
    },
  },
]
