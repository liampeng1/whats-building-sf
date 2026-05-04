// Field names match DataSF Socrata wire format so the API client returns JSON as-is.

export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
}

export interface GeoPoint {
  type: 'Point'
  coordinates: [number, number] // [longitude, latitude]
}

export interface Permit {
  permit_number: string
  permit_type: string
  permit_type_definition: string | null
  status: string
  description: string | null
  address: string
  filed_date: string | null
  issued_date: string | null
  completed_date: string | null
  status_date: string | null
  estimated_cost: string | null
  existing_use: string | null
  proposed_use: string | null
  existing_units: string | null
  proposed_units: string | null
  existing_stories: string | null
  proposed_stories: string | null
  location: GeoPoint | null
  // Enrichment from SF Development Pipeline (dataset 6jgi-cpb4) — joined via
  // bpa_no = permit_number. SF Planning curates current_status for major
  // projects. When pipeline_status === 'Construction' we treat it as ground
  // truth (better than the raw permit `status` field).
  pipeline_status: string | null
  pipeline_status_date: string | null
  // Assessor parcel identifiers — used to link related permits at the same
  // location (e.g. the demolition permit that preceded a new-construction
  // permit on this lot).
  block: string | null
  lot: string | null
  // Demolition permits for this parcel, fetched on the detail page only.
  // Empty/undefined when not enriched (e.g. on the map list view).
  demolitions?: DemolitionEvent[]
}

export interface DemolitionEvent {
  permit_number: string
  filed_date: string | null
  issued_date: string | null
  completed_date: string | null
  status: string
}

export interface PlanningCase {
  record_id: string
  record_type: string
  description: string | null
  project_address: string
  record_status: string
  open_date: string | null
}
