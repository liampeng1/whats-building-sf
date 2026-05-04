import type { Permit, PlanningCase, MapBounds } from '@/lib/types'

test('Permit type accepts a valid permit object', () => {
  const permit: Permit = {
    permit_number: '202301010001',
    permit_type: '8',
    permit_type_definition: 'otc alterations permit',
    status: 'issued',
    description: 'REPLACE HVAC UNIT',
    address: '123 MAIN ST',
    filed_date: '2023-01-01T00:00:00.000',
    issued_date: null,
    completed_date: null,
    location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
  }
  expect(permit.permit_number).toBe('202301010001')
  expect(permit.location?.coordinates[0]).toBe(-122.4194)
})

test('Permit type allows null location', () => {
  const permit: Permit = {
    permit_number: '202301010002',
    permit_type: '8',
    permit_type_definition: null,
    status: 'filed',
    description: null,
    address: '456 OAK ST',
    filed_date: '2023-01-02T00:00:00.000',
    issued_date: null,
    completed_date: null,
    location: null,
  }
  expect(permit.location).toBeNull()
})

test('PlanningCase type accepts a valid planning case', () => {
  const c: PlanningCase = {
    record_id: '2025-012220PRJ',
    record_type: 'Conditional Use',
    description: 'New mixed-use building',
    project_address: '21 05TH AVE 94118',
    record_status: 'Under Review',
    open_date: '2023-06-01T00:00:00.000',
  }
  expect(c.record_id).toBe('2025-012220PRJ')
})

test('Permit type allows null filed_date', () => {
  const permit: Permit = {
    permit_number: '202301010003',
    permit_type: '8',
    permit_type_definition: null,
    status: 'filed',
    description: null,
    address: '789 PINE ST',
    filed_date: null,
    issued_date: null,
    completed_date: null,
    location: null,
  }
  expect(permit.filed_date).toBeNull()
})

test('PlanningCase type allows null open_date', () => {
  const c: PlanningCase = {
    record_id: '2025-000001PRJ',
    record_type: 'Conditional Use',
    description: null,
    project_address: '1 MARKET ST',
    record_status: 'Filed',
    open_date: null,
  }
  expect(c.open_date).toBeNull()
})

test('MapBounds type accepts valid bounds', () => {
  const bounds: MapBounds = { north: 37.8, south: 37.7, east: -122.4, west: -122.5 }
  expect(bounds.north).toBeGreaterThan(bounds.south)
})
