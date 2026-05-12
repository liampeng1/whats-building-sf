/**
 * Permit enrichment for /api/lens-stats.
 *
 * `lib/lens-stats.ts` consumes a permit shape with derived/camelCase fields
 * (`neighborhood`, `filedDate`, `issuedDate`, `netUnits`, `useCategory`,
 * `stage`) that aren't present on the raw DataSF `Permit`. This module is
 * the pure adapter between the two — given a permit and the SF Analysis
 * Neighborhoods polygons, it returns the lens-flavored object the
 * aggregator expects.
 *
 * Pure: no I/O. The route handler loads neighborhood GeoJSON server-side
 * and passes it through.
 */

import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import type { GeoPoint, Permit } from './types'
import { pointInGeometry } from './point-in-polygon'
import { permitStage, useCategory, type PermitStage, type UseCategory } from './permit-style'

// The SF Analysis Neighborhoods GeoJSON ships `nhood` as the canonical
// property (verified against /public/sf-neighborhoods.geojson). We also
// accept `name`/`nhood_name` defensively in case the asset is regenerated
// from an upstream source that renames the field.
export type NhoodProperties = {
  nhood?: string
  name?: string
  nhood_name?: string
}

export type NhoodFeatureCollection = FeatureCollection<
  Polygon | MultiPolygon,
  NhoodProperties
>

export interface EnrichedPermit {
  permit_number: string
  neighborhood: string | null
  filedDate: string | null
  issuedDate: string | null
  netUnits: number
  useCategory: UseCategory
  stage: PermitStage
  location: GeoPoint | null
}

function parseIntSafe(x: string | null | undefined): number {
  return parseInt(x ?? '', 10) || 0
}

function nhoodLabel(props: NhoodProperties | null | undefined): string | null {
  if (!props) return null
  return props.nhood ?? props.name ?? props.nhood_name ?? null
}

/**
 * Assign a neighborhood to a permit via point-in-polygon. Returns null when
 * the permit has no location or the point falls outside every feature.
 */
function neighborhoodFor(
  location: GeoPoint | null,
  nhoodFeatures: NhoodFeatureCollection,
): string | null {
  if (!location) return null
  const [lng, lat] = location.coordinates
  for (const f of nhoodFeatures.features) {
    if (pointInGeometry(lng, lat, f.geometry)) {
      return nhoodLabel(f.properties)
    }
  }
  return null
}

export function enrichPermit(
  permit: Permit,
  nhoodFeatures: NhoodFeatureCollection,
): EnrichedPermit {
  const proposed = parseIntSafe(permit.proposed_units)
  const existing = parseIntSafe(permit.existing_units)
  return {
    permit_number: permit.permit_number,
    neighborhood: neighborhoodFor(permit.location, nhoodFeatures),
    filedDate: permit.filed_date,
    issuedDate: permit.issued_date,
    netUnits: proposed - existing,
    useCategory: useCategory(permit.proposed_use),
    stage: permitStage(permit),
    location: permit.location,
  }
}
