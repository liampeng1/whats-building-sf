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
  location: GeoPoint | null
}

export interface PlanningCase {
  record_id: string
  record_type: string
  description: string | null
  project_address: string
  record_status: string
  open_date: string | null
}
