/**
 * Transit-adjacency helper. SF BART stations + Muni Metro surface and
 * subway stations, plus the surface light-rail termini we'd want to
 * count as "transit-rich". Coordinates are approximate (within ~100m)
 * — adequate for an "is this site within walking distance of rail?"
 * filter, not for routing.
 *
 * Source: SFMTA station list (2024), BART system map. If the boundary
 * cases bug us we can swap to GTFS-Realtime parsing later.
 */

export interface TransitStop {
  name: string
  lat: number
  lng: number
  type: 'bart' | 'muni-metro'
}

export const TRANSIT_STOPS: TransitStop[] = [
  // BART (in SF + Daly City — Daly City is included since the southern
  // edge of SF can rely on it).
  { name: 'Embarcadero', lat: 37.792976, lng: -122.396957, type: 'bart' },
  { name: 'Montgomery St', lat: 37.789256, lng: -122.401407, type: 'bart' },
  { name: 'Powell St', lat: 37.784471, lng: -122.40798, type: 'bart' },
  { name: 'Civic Center / UN Plaza', lat: 37.779528, lng: -122.413756, type: 'bart' },
  { name: '16th St / Mission', lat: 37.765222, lng: -122.419698, type: 'bart' },
  { name: '24th St / Mission', lat: 37.752254, lng: -122.418466, type: 'bart' },
  { name: 'Glen Park', lat: 37.733118, lng: -122.43399, type: 'bart' },
  { name: 'Balboa Park', lat: 37.721617, lng: -122.447506, type: 'bart' },
  { name: 'Daly City', lat: 37.706121, lng: -122.469081, type: 'bart' },

  // Muni Metro Subway (Market St corridor — these overlap with BART
  // stations above but rail-shed for them is wider in practice).
  { name: 'Van Ness Station', lat: 37.775059, lng: -122.41907, type: 'muni-metro' },
  { name: 'Church Station', lat: 37.7654, lng: -122.4292, type: 'muni-metro' },
  { name: 'Castro Station', lat: 37.762, lng: -122.43492, type: 'muni-metro' },
  { name: 'Forest Hill Station', lat: 37.747234, lng: -122.45942, type: 'muni-metro' },
  { name: 'West Portal Station', lat: 37.7405, lng: -122.466595, type: 'muni-metro' },

  // J Church surface stops (key ones)
  { name: 'J Church / 30th St', lat: 37.74236, lng: -122.42699, type: 'muni-metro' },
  { name: 'J Church / Balboa Park', lat: 37.72184, lng: -122.44757, type: 'muni-metro' },

  // K Ingleside / T Third (south + east)
  { name: 'K / Junipero Serra & Ocean', lat: 37.72325, lng: -122.45876, type: 'muni-metro' },
  { name: 'T Third / Mission Bay (UCSF)', lat: 37.76859, lng: -122.39239, type: 'muni-metro' },
  { name: 'T Third / 4th & King', lat: 37.77611, lng: -122.39444, type: 'muni-metro' },
  { name: 'T Third / Bayshore', lat: 37.71093, lng: -122.40183, type: 'muni-metro' },
  { name: 'Chinatown – Rose Pak', lat: 37.79428, lng: -122.40694, type: 'muni-metro' },
  { name: 'Union Square / Market St', lat: 37.78664, lng: -122.40771, type: 'muni-metro' },
  { name: 'Yerba Buena / Moscone', lat: 37.78416, lng: -122.40124, type: 'muni-metro' },

  // L Taraval (key stops)
  { name: 'L / 19th & Taraval', lat: 37.7427, lng: -122.4775, type: 'muni-metro' },
  { name: 'L / 30th & Taraval', lat: 37.7416, lng: -122.4904, type: 'muni-metro' },
  { name: 'L / Sunset Tunnel', lat: 37.7615, lng: -122.4514, type: 'muni-metro' },

  // M Ocean View
  { name: 'M / Stonestown', lat: 37.7269, lng: -122.4748, type: 'muni-metro' },
  { name: 'M / Broad & Plymouth', lat: 37.7211, lng: -122.4577, type: 'muni-metro' },

  // N Judah
  { name: 'N / Carl & Cole', lat: 37.7657, lng: -122.4509, type: 'muni-metro' },
  { name: 'N / 9th & Irving', lat: 37.7641, lng: -122.466, type: 'muni-metro' },
  { name: 'N / 19th & Judah', lat: 37.762, lng: -122.4778, type: 'muni-metro' },
  { name: 'N / Ocean Beach', lat: 37.7607, lng: -122.5085, type: 'muni-metro' },
]

/**
 * Haversine distance in meters between two [lat, lng] points.
 * Accurate to within a few centimetres for the distances we care about.
 */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** ½ mile = 800 metres. Standard transit-shed walking distance. */
export const TRANSIT_THRESHOLD_M = 800

export function isTransitAdjacent(
  coords: [number, number] | null | undefined,
  thresholdMeters: number = TRANSIT_THRESHOLD_M,
): boolean {
  if (!coords) return false
  const [lng, lat] = coords
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  for (const s of TRANSIT_STOPS) {
    if (distanceMeters(lat, lng, s.lat, s.lng) <= thresholdMeters) return true
  }
  return false
}
