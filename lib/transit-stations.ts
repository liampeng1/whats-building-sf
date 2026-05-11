// lib/transit-stations.ts (stub — fully populated in Task 2.1)
export interface RailStation {
  id: string; name: string; lat: number; lng: number;
  modes: ('bart' | 'muni-metro' | 'caltrain')[]
}
export interface RapidBusStop {
  id: string; name: string; lat: number; lng: number;
  routes: string[]
}
export const RAIL_STATIONS: RailStation[] = []
export const RAPID_BUS_STOPS: RapidBusStop[] = []
