# SF In Progress — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public-facing Next.js web app showing SF building permits and planning cases on an interactive map with clickable detail pages, using live data from DataSF.

**Architecture:** Next.js App Router with TypeScript. The client-side Map component fetches data via Next.js API routes (which proxy DataSF). Server-rendered detail pages call `lib/datasf.ts` directly. React-Leaflet for mapping with CircleMarkers.

**Tech Stack:** Next.js 14 (App Router), TypeScript, React-Leaflet + OpenStreetMap, Tailwind CSS, DataSF Socrata API, Vercel

---

## File Map

| File | Responsibility |
|---|---|
| `lib/types.ts` | Shared TypeScript interfaces: `Permit`, `PlanningCase`, `MapBounds` |
| `lib/datasf.ts` | DataSF Socrata API client — single abstraction layer for both datasets |
| `app/api/permits/route.ts` | `GET /api/permits` — list building permits (proxy) |
| `app/api/permits/[id]/route.ts` | `GET /api/permits/[id]` — single building permit (proxy) |
| `app/api/planning/route.ts` | `GET /api/planning` — list planning cases (proxy) |
| `app/api/planning/[id]/route.ts` | `GET /api/planning/[id]` — single planning case (proxy) |
| `components/PermitMarker.tsx` | Blue `CircleMarker` for building permits |
| `components/PlanningCaseMarker.tsx` | Orange `CircleMarker` for planning cases |
| `components/MapEventHandler.tsx` | `useMapEvents` hook component, fires `onBoundsChange` on `moveend` |
| `components/Map.tsx` | Client component: state, fetching, debounce, marker rendering |
| `app/page.tsx` | SSR shell — dynamic import of Map with `ssr: false` |
| `app/layout.tsx` | Root layout with metadata |
| `app/error.tsx` | Global error boundary (client component) |
| `app/permits/[id]/page.tsx` | Building permit detail — SSR, calls `datasf.ts` directly |
| `app/permits/[id]/loading.tsx` | Skeleton for permit detail |
| `app/permits/[id]/not-found.tsx` | 404 for permit detail |
| `app/planning/[id]/page.tsx` | Planning case detail — SSR, calls `datasf.ts` directly |
| `app/planning/[id]/loading.tsx` | Skeleton for planning detail |
| `app/planning/[id]/not-found.tsx` | 404 for planning detail |
| `__tests__/lib/types.test.ts` | Type shape validation tests |
| `__tests__/lib/datasf.test.ts` | Unit tests for DataSF API client (mocked fetch) |
| `__tests__/api/permits.test.ts` | Unit tests for permit API routes (mocked datasf) |
| `__tests__/api/planning.test.ts` | Unit tests for planning API routes (mocked datasf) |
| `__tests__/components/Map.test.tsx` | Render test for Map component (mocked Leaflet) |

---

### Task 1: Install Node.js and scaffold Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts` (via create-next-app)

- [ ] **Step 1: Install nvm**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.zshrc
nvm --version
```

Expected: prints nvm version (e.g. `0.39.7`)

- [ ] **Step 2: Install Node.js LTS**

```bash
nvm install --lts
nvm use --lts
node --version
npm --version
```

Expected: Node `v20.x.x` and npm `10.x.x` (or similar current LTS)

- [ ] **Step 3: Scaffold Next.js in the existing project directory**

```bash
cd /Users/liampeng/Projects/sf-in-progress
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*"
```

When prompted about existing files in the directory, choose to proceed. The `docs/` directory will not be overwritten.

- [ ] **Step 4: Verify the app starts**

```bash
npm run dev
```

Open http://localhost:3000. Expected: Next.js default welcome page. Press Ctrl+C to stop.

- [ ] **Step 5: Initialize git and commit**

```bash
git init
echo ".env.local" >> .gitignore
echo ".superpowers/" >> .gitignore
git add -A
git commit -m "feat: scaffold Next.js project"
```

---

### Task 2: Configure Jest testing infrastructure

**Files:**
- Create: `jest.config.ts`
- Create: `jest.setup.ts`
- Create: `__tests__/smoke.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Install testing dependencies**

```bash
npm install -D jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom @types/jest
```

Expected: packages installed with no errors.

- [ ] **Step 2: Write a failing smoke test**

Create `__tests__/smoke.test.ts`:

```ts
test('smoke test', () => {
  expect(true).toBe(false)
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest --testPathPattern=smoke
```

Expected: FAIL — `Expected: false, Received: true`

- [ ] **Step 4: Create jest.config.ts**

```ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

export default createJestConfig(config)
```

- [ ] **Step 5: Create jest.setup.ts**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Add test scripts to package.json**

In `package.json`, in the `"scripts"` section, add:

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 7: Fix the smoke test and verify it passes**

Edit `__tests__/smoke.test.ts`:

```ts
test('smoke test', () => {
  expect(true).toBe(true)
})
```

```bash
npm test
```

Expected: PASS (1 test)

- [ ] **Step 8: Commit**

```bash
git add jest.config.ts jest.setup.ts package.json __tests__/smoke.test.ts
git commit -m "feat: configure Jest testing infrastructure"
```

---

### Task 3: Discover and verify DataSF planning dataset

**Files:** None (research task — output is the planning dataset ID used in Task 5)

- [ ] **Step 1: Verify building permits dataset**

```bash
curl -s "https://data.sfgov.org/resource/i98e-djp9.json?\$limit=1" | python3 -m json.tool
```

Expected: JSON record with fields including `permit_number`, `status`, `address`, `location` (containing `latitude` and `longitude`).

- [ ] **Step 2: Search DataSF for planning datasets**

```bash
curl -s "https://data.sfgov.org/api/catalog/v1?domains=data.sfgov.org&only=datasets&q=planning+cases&limit=15" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for r in data.get('results', []):
    res = r['resource']
    print(f\"{res.get('id', 'N/A'):15} {res.get('name', 'N/A')}\")
"
```

Expected: list of dataset IDs and names. Look for a dataset containing planning cases, applications, or entitlements.

- [ ] **Step 3: Verify the planning dataset has location data and expected fields**

Replace `DATASET_ID` with the ID from Step 2 that looks most relevant:

```bash
curl -s "https://data.sfgov.org/resource/DATASET_ID.json?\$limit=1" | python3 -m json.tool
```

Confirm the record includes: a unique ID field, `address` or similar, `status`, `location` with lat/lng, and date fields. Note which field names the dataset actually uses — you will need to update `lib/types.ts` (Task 4) and `lib/datasf.ts` (Task 5) if field names differ from `record_id`, `record_type`, `open_date`, `close_date`.

- [ ] **Step 4: Record the planning dataset ID**

Write down the confirmed dataset ID. It goes into `PLANNING_DATASET` in `lib/datasf.ts` (Task 5).

---

### Task 4: Define TypeScript types

**Files:**
- Create: `lib/types.ts`
- Create: `__tests__/lib/types.test.ts`

Note: If the planning dataset (Task 3) uses different field names than `record_id`, `record_type`, `open_date`, `close_date`, update `PlanningCase` accordingly.

- [ ] **Step 1: Write failing type tests**

Create `__tests__/lib/types.test.ts`:

```ts
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
    location: { latitude: '37.7749', longitude: '-122.4194' },
  }
  expect(permit.permit_number).toBe('202301010001')
})

test('PlanningCase type accepts a valid planning case', () => {
  const c: PlanningCase = {
    record_id: 'PRJ-2023-001',
    record_type: 'Conditional Use',
    description: 'New mixed-use building',
    address: '456 MARKET ST',
    status: 'Open',
    open_date: '2023-06-01T00:00:00.000',
    close_date: null,
    location: { latitude: '37.7900', longitude: '-122.4000' },
  }
  expect(c.record_id).toBe('PRJ-2023-001')
})

test('MapBounds type accepts valid bounds', () => {
  const bounds: MapBounds = { north: 37.8, south: 37.7, east: -122.4, west: -122.5 }
  expect(bounds.north).toBeGreaterThan(bounds.south)
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test -- --testPathPattern=types
```

Expected: FAIL — `Cannot find module '@/lib/types'`

- [ ] **Step 3: Create lib/types.ts**

```ts
export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
}

export interface Permit {
  permit_number: string
  permit_type: string
  permit_type_definition: string | null
  status: string
  description: string | null
  address: string
  filed_date: string
  issued_date: string | null
  completed_date: string | null
  location: { latitude: string; longitude: string } | null
}

export interface PlanningCase {
  record_id: string
  record_type: string
  description: string | null
  address: string
  status: string
  open_date: string
  close_date: string | null
  location: { latitude: string; longitude: string } | null
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=types
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts __tests__/lib/types.test.ts
git commit -m "feat: define TypeScript types for permits, planning cases, and map bounds"
```

---

### Task 5: Build DataSF API client

**Files:**
- Create: `lib/datasf.ts`
- Create: `__tests__/lib/datasf.test.ts`

Before writing the implementation, replace `PLANNING_DATASET_ID` in the code below with the ID discovered in Task 3.

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/datasf.test.ts`:

```ts
import {
  fetchBuildingPermits,
  fetchBuildingPermit,
  fetchPlanningCases,
  fetchPlanningCase,
} from '@/lib/datasf'

const mockPermit = {
  permit_number: '202301010001',
  permit_type: '8',
  permit_type_definition: 'otc alterations permit',
  status: 'issued',
  description: 'REPLACE HVAC UNIT',
  address: '123 MAIN ST',
  filed_date: '2023-01-01T00:00:00.000',
  issued_date: null,
  completed_date: null,
  location: { latitude: '37.7749', longitude: '-122.4194' },
}

const mockCase = {
  record_id: 'PRJ-2023-001',
  record_type: 'Conditional Use',
  description: 'New mixed-use building',
  address: '456 MARKET ST',
  status: 'Open',
  open_date: '2023-06-01T00:00:00.000',
  close_date: null,
  location: { latitude: '37.79', longitude: '-122.40' },
}

const mockBounds = { north: 37.8, south: 37.7, east: -122.4, west: -122.5 }

beforeEach(() => { global.fetch = jest.fn() })
afterEach(() => { jest.resetAllMocks() })

describe('fetchBuildingPermits', () => {
  test('fetches citywide permits when no bounds given', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [mockPermit] })
    const permits = await fetchBuildingPermits()
    expect(permits).toHaveLength(1)
    expect(permits[0].permit_number).toBe('202301010001')
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).not.toContain('within_box')
    expect(url).toContain('filed_date')
  })

  test('includes within_box filter when bounds provided', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [mockPermit] })
    await fetchBuildingPermits(mockBounds)
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toContain('within_box')
    expect(url).toContain('37.8')
    expect(url).toContain('-122.5')
  })

  test('throws on DataSF API error', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 503 })
    await expect(fetchBuildingPermits()).rejects.toThrow('DataSF error: 503')
  })
})

describe('fetchBuildingPermit', () => {
  test('fetches single permit by permit_number', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [mockPermit] })
    const permit = await fetchBuildingPermit('202301010001')
    expect(permit.permit_number).toBe('202301010001')
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toContain('permit_number=202301010001')
  })

  test('throws when permit not found', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [] })
    await expect(fetchBuildingPermit('nonexistent')).rejects.toThrow('Permit not found')
  })
})

describe('fetchPlanningCases', () => {
  test('fetches planning cases with bounds', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [mockCase] })
    const cases = await fetchPlanningCases(mockBounds)
    expect(cases).toHaveLength(1)
    expect(cases[0].record_id).toBe('PRJ-2023-001')
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toContain('within_box')
  })

  test('throws on DataSF API error', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429 })
    await expect(fetchPlanningCases(mockBounds)).rejects.toThrow('DataSF error: 429')
  })
})

describe('fetchPlanningCase', () => {
  test('fetches single case by record_id', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [mockCase] })
    const c = await fetchPlanningCase('PRJ-2023-001')
    expect(c.record_id).toBe('PRJ-2023-001')
  })

  test('throws when case not found', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [] })
    await expect(fetchPlanningCase('nonexistent')).rejects.toThrow('Planning case not found')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test -- --testPathPattern=datasf
```

Expected: FAIL — `Cannot find module '@/lib/datasf'`

- [ ] **Step 3: Create lib/datasf.ts**

Replace `PLANNING_DATASET_ID` with the dataset ID from Task 3:

```ts
import type { MapBounds, Permit, PlanningCase } from './types'

const BASE_URL = 'https://data.sfgov.org/resource'
const PERMITS_DATASET = 'i98e-djp9'
const PLANNING_DATASET = 'PLANNING_DATASET_ID'  // Replace with ID from Task 3

function headers(): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' }
  if (process.env.DATASF_APP_TOKEN) h['X-App-Token'] = process.env.DATASF_APP_TOKEN
  return h
}

function boundsFilter(bounds: MapBounds): string {
  return `within_box(location,${bounds.north},${bounds.west},${bounds.south},${bounds.east})`
}

export async function fetchBuildingPermits(bounds?: MapBounds): Promise<Permit[]> {
  const params = new URLSearchParams({ $limit: '500', $order: 'filed_date DESC' })
  if (bounds) params.set('$where', boundsFilter(bounds))
  const res = await fetch(`${BASE_URL}/${PERMITS_DATASET}.json?${params}`, { headers: headers() })
  if (!res.ok) throw new Error(`DataSF error: ${res.status}`)
  return res.json()
}

export async function fetchBuildingPermit(id: string): Promise<Permit> {
  const params = new URLSearchParams({ permit_number: id, $limit: '1' })
  const res = await fetch(`${BASE_URL}/${PERMITS_DATASET}.json?${params}`, { headers: headers() })
  if (!res.ok) throw new Error(`DataSF error: ${res.status}`)
  const data: Permit[] = await res.json()
  if (data.length === 0) throw new Error('Permit not found')
  return data[0]
}

export async function fetchPlanningCases(bounds?: MapBounds): Promise<PlanningCase[]> {
  const params = new URLSearchParams({ $limit: '500', $order: 'open_date DESC' })
  if (bounds) params.set('$where', boundsFilter(bounds))
  const res = await fetch(`${BASE_URL}/${PLANNING_DATASET}.json?${params}`, { headers: headers() })
  if (!res.ok) throw new Error(`DataSF error: ${res.status}`)
  return res.json()
}

export async function fetchPlanningCase(id: string): Promise<PlanningCase> {
  const params = new URLSearchParams({ record_id: id, $limit: '1' })
  const res = await fetch(`${BASE_URL}/${PLANNING_DATASET}.json?${params}`, { headers: headers() })
  if (!res.ok) throw new Error(`DataSF error: ${res.status}`)
  const data: PlanningCase[] = await res.json()
  if (data.length === 0) throw new Error('Planning case not found')
  return data[0]
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=datasf
```

Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/datasf.ts __tests__/lib/datasf.test.ts
git commit -m "feat: build DataSF API client with tests"
```

---

### Task 6: Build permit API routes

**Files:**
- Create: `app/api/permits/route.ts`
- Create: `app/api/permits/[id]/route.ts`
- Create: `__tests__/api/permits.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/permits.test.ts`:

```ts
import { GET as listPermits } from '@/app/api/permits/route'
import { GET as getPermit } from '@/app/api/permits/[id]/route'
import * as datasf from '@/lib/datasf'

jest.mock('@/lib/datasf')

const mockPermit = {
  permit_number: '202301010001',
  permit_type: '8',
  permit_type_definition: 'otc alterations permit',
  status: 'issued',
  description: 'REPLACE HVAC UNIT',
  address: '123 MAIN ST',
  filed_date: '2023-01-01T00:00:00.000',
  issued_date: null,
  completed_date: null,
  location: { latitude: '37.7749', longitude: '-122.4194' },
}

describe('GET /api/permits', () => {
  test('returns 200 with permit array', async () => {
    ;(datasf.fetchBuildingPermits as jest.Mock).mockResolvedValueOnce([mockPermit])
    const req = new Request('http://localhost/api/permits')
    const res = await listPermits(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data[0].permit_number).toBe('202301010001')
  })

  test('passes parsed bounds to datasf when bounds params present', async () => {
    ;(datasf.fetchBuildingPermits as jest.Mock).mockResolvedValueOnce([])
    const req = new Request('http://localhost/api/permits?north=37.8&south=37.7&east=-122.4&west=-122.5')
    await listPermits(req)
    expect(datasf.fetchBuildingPermits).toHaveBeenCalledWith({
      north: 37.8, south: 37.7, east: -122.4, west: -122.5,
    })
  })

  test('returns 500 on DataSF error', async () => {
    ;(datasf.fetchBuildingPermits as jest.Mock).mockRejectedValueOnce(new Error('DataSF error: 503'))
    const req = new Request('http://localhost/api/permits')
    const res = await listPermits(req)
    expect(res.status).toBe(500)
  })
})

describe('GET /api/permits/[id]', () => {
  test('returns 200 with single permit', async () => {
    ;(datasf.fetchBuildingPermit as jest.Mock).mockResolvedValueOnce(mockPermit)
    const req = new Request('http://localhost/api/permits/202301010001')
    const res = await getPermit(req, { params: { id: '202301010001' } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.permit_number).toBe('202301010001')
  })

  test('returns 404 when permit not found', async () => {
    ;(datasf.fetchBuildingPermit as jest.Mock).mockRejectedValueOnce(new Error('Permit not found'))
    const req = new Request('http://localhost/api/permits/nonexistent')
    const res = await getPermit(req, { params: { id: 'nonexistent' } })
    expect(res.status).toBe(404)
  })

  test('returns 500 on DataSF error', async () => {
    ;(datasf.fetchBuildingPermit as jest.Mock).mockRejectedValueOnce(new Error('DataSF error: 503'))
    const req = new Request('http://localhost/api/permits/any')
    const res = await getPermit(req, { params: { id: 'any' } })
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test -- --testPathPattern="api/permits"
```

Expected: FAIL — `Cannot find module '@/app/api/permits/route'`

- [ ] **Step 3: Create app/api/permits/route.ts**

```ts
import { NextResponse } from 'next/server'
import { fetchBuildingPermits } from '@/lib/datasf'
import type { MapBounds } from '@/lib/types'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const north = searchParams.get('north')
    const south = searchParams.get('south')
    const east = searchParams.get('east')
    const west = searchParams.get('west')
    const bounds: MapBounds | undefined =
      north && south && east && west
        ? { north: Number(north), south: Number(south), east: Number(east), west: Number(west) }
        : undefined
    const permits = await fetchBuildingPermits(bounds)
    return NextResponse.json(permits)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch permits' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Create app/api/permits/[id]/route.ts**

```ts
import { NextResponse } from 'next/server'
import { fetchBuildingPermit } from '@/lib/datasf'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const permit = await fetchBuildingPermit(params.id)
    return NextResponse.json(permit)
  } catch (error) {
    if (error instanceof Error && error.message === 'Permit not found') {
      return NextResponse.json({ error: 'Permit not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to fetch permit' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="api/permits"
```

Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add app/api/permits/ __tests__/api/permits.test.ts
git commit -m "feat: build permit API routes with tests"
```

---

### Task 7: Build planning API routes

**Files:**
- Create: `app/api/planning/route.ts`
- Create: `app/api/planning/[id]/route.ts`
- Create: `__tests__/api/planning.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/planning.test.ts`:

```ts
import { GET as listCases } from '@/app/api/planning/route'
import { GET as getCase } from '@/app/api/planning/[id]/route'
import * as datasf from '@/lib/datasf'

jest.mock('@/lib/datasf')

const mockCase = {
  record_id: 'PRJ-2023-001',
  record_type: 'Conditional Use',
  description: 'New mixed-use building',
  address: '456 MARKET ST',
  status: 'Open',
  open_date: '2023-06-01T00:00:00.000',
  close_date: null,
  location: { latitude: '37.79', longitude: '-122.40' },
}

describe('GET /api/planning', () => {
  test('returns 200 with planning case array', async () => {
    ;(datasf.fetchPlanningCases as jest.Mock).mockResolvedValueOnce([mockCase])
    const req = new Request('http://localhost/api/planning')
    const res = await listCases(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data[0].record_id).toBe('PRJ-2023-001')
  })

  test('passes parsed bounds to datasf when bounds params present', async () => {
    ;(datasf.fetchPlanningCases as jest.Mock).mockResolvedValueOnce([])
    const req = new Request('http://localhost/api/planning?north=37.8&south=37.7&east=-122.4&west=-122.5')
    await listCases(req)
    expect(datasf.fetchPlanningCases).toHaveBeenCalledWith({
      north: 37.8, south: 37.7, east: -122.4, west: -122.5,
    })
  })

  test('returns 500 on DataSF error', async () => {
    ;(datasf.fetchPlanningCases as jest.Mock).mockRejectedValueOnce(new Error('DataSF error: 429'))
    const req = new Request('http://localhost/api/planning')
    const res = await listCases(req)
    expect(res.status).toBe(500)
  })
})

describe('GET /api/planning/[id]', () => {
  test('returns 200 with single planning case', async () => {
    ;(datasf.fetchPlanningCase as jest.Mock).mockResolvedValueOnce(mockCase)
    const req = new Request('http://localhost/api/planning/PRJ-2023-001')
    const res = await getCase(req, { params: { id: 'PRJ-2023-001' } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.record_id).toBe('PRJ-2023-001')
  })

  test('returns 404 when case not found', async () => {
    ;(datasf.fetchPlanningCase as jest.Mock).mockRejectedValueOnce(new Error('Planning case not found'))
    const req = new Request('http://localhost/api/planning/nonexistent')
    const res = await getCase(req, { params: { id: 'nonexistent' } })
    expect(res.status).toBe(404)
  })

  test('returns 500 on DataSF error', async () => {
    ;(datasf.fetchPlanningCase as jest.Mock).mockRejectedValueOnce(new Error('DataSF error: 503'))
    const req = new Request('http://localhost/api/planning/any')
    const res = await getCase(req, { params: { id: 'any' } })
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test -- --testPathPattern="api/planning"
```

Expected: FAIL — `Cannot find module '@/app/api/planning/route'`

- [ ] **Step 3: Create app/api/planning/route.ts**

```ts
import { NextResponse } from 'next/server'
import { fetchPlanningCases } from '@/lib/datasf'
import type { MapBounds } from '@/lib/types'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const north = searchParams.get('north')
    const south = searchParams.get('south')
    const east = searchParams.get('east')
    const west = searchParams.get('west')
    const bounds: MapBounds | undefined =
      north && south && east && west
        ? { north: Number(north), south: Number(south), east: Number(east), west: Number(west) }
        : undefined
    const cases = await fetchPlanningCases(bounds)
    return NextResponse.json(cases)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch planning cases' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Create app/api/planning/[id]/route.ts**

```ts
import { NextResponse } from 'next/server'
import { fetchPlanningCase } from '@/lib/datasf'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const planningCase = await fetchPlanningCase(params.id)
    return NextResponse.json(planningCase)
  } catch (error) {
    if (error instanceof Error && error.message === 'Planning case not found') {
      return NextResponse.json({ error: 'Planning case not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to fetch planning case' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="api/planning"
```

Expected: PASS (6 tests)

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: PASS (all tests)

- [ ] **Step 7: Commit**

```bash
git add app/api/planning/ __tests__/api/planning.test.ts
git commit -m "feat: build planning API routes with tests"
```

---

### Task 8: Build map marker components

**Files:**
- Create: `components/PermitMarker.tsx`
- Create: `components/PlanningCaseMarker.tsx`
- Create: `components/MapEventHandler.tsx`

- [ ] **Step 1: Install react-leaflet and leaflet**

```bash
npm install react-leaflet leaflet
npm install -D @types/leaflet
```

Expected: packages installed with no errors.

- [ ] **Step 2: Create components/PermitMarker.tsx**

```tsx
'use client'
import { CircleMarker, Popup } from 'react-leaflet'
import { useRouter } from 'next/navigation'
import type { Permit } from '@/lib/types'

export function PermitMarker({ permit }: { permit: Permit }) {
  const router = useRouter()
  if (!permit.location) return null
  const lat = parseFloat(permit.location.latitude)
  const lng = parseFloat(permit.location.longitude)
  if (isNaN(lat) || isNaN(lng)) return null

  return (
    <CircleMarker
      center={[lat, lng]}
      radius={6}
      pathOptions={{ fillColor: '#3b82f6', color: '#1d4ed8', weight: 1, fillOpacity: 0.8 }}
      eventHandlers={{ click: () => router.push(`/permits/${permit.permit_number}`) }}
    >
      <Popup>
        <strong>{permit.address}</strong>
        <br />
        {permit.permit_type_definition ?? permit.permit_type}
        <br />
        Status: {permit.status}
      </Popup>
    </CircleMarker>
  )
}
```

- [ ] **Step 3: Create components/PlanningCaseMarker.tsx**

```tsx
'use client'
import { CircleMarker, Popup } from 'react-leaflet'
import { useRouter } from 'next/navigation'
import type { PlanningCase } from '@/lib/types'

export function PlanningCaseMarker({ planningCase }: { planningCase: PlanningCase }) {
  const router = useRouter()
  if (!planningCase.location) return null
  const lat = parseFloat(planningCase.location.latitude)
  const lng = parseFloat(planningCase.location.longitude)
  if (isNaN(lat) || isNaN(lng)) return null

  return (
    <CircleMarker
      center={[lat, lng]}
      radius={6}
      pathOptions={{ fillColor: '#f97316', color: '#c2410c', weight: 1, fillOpacity: 0.8 }}
      eventHandlers={{ click: () => router.push(`/planning/${encodeURIComponent(planningCase.record_id)}`) }}
    >
      <Popup>
        <strong>{planningCase.address}</strong>
        <br />
        {planningCase.record_type}
        <br />
        Status: {planningCase.status}
      </Popup>
    </CircleMarker>
  )
}
```

- [ ] **Step 4: Create components/MapEventHandler.tsx**

```tsx
'use client'
import { useMapEvents } from 'react-leaflet'
import type { MapBounds } from '@/lib/types'

export function MapEventHandler({ onBoundsChange }: { onBoundsChange: (bounds: MapBounds) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const b = map.getBounds()
      onBoundsChange({
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      })
    },
  })
  return null
}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/PermitMarker.tsx components/PlanningCaseMarker.tsx components/MapEventHandler.tsx
git commit -m "feat: build map marker and event handler components"
```

---

### Task 9: Build Map component

**Files:**
- Create: `components/Map.tsx`
- Create: `__tests__/components/Map.test.tsx`

- [ ] **Step 1: Write failing render test**

Create `__tests__/components/Map.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import Map from '@/components/Map'

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => null,
  CircleMarker: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMapEvents: () => ({}),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('leaflet/dist/leaflet.css', () => {})

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] })
})

afterEach(() => { jest.resetAllMocks() })

test('renders map container', () => {
  render(<Map />)
  expect(screen.getByTestId('map-container')).toBeInTheDocument()
})

test('fetches permits and planning cases on mount', async () => {
  render(<Map />)
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/permits'))
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/planning'))
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- --testPathPattern="components/Map"
```

Expected: FAIL — `Cannot find module '@/components/Map'`

- [ ] **Step 3: Create components/Map.tsx**

```tsx
'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { PermitMarker } from './PermitMarker'
import { PlanningCaseMarker } from './PlanningCaseMarker'
import { MapEventHandler } from './MapEventHandler'
import type { Permit, PlanningCase, MapBounds } from '@/lib/types'

interface Props {
  initialCenter?: [number, number]
}

export default function Map({ initialCenter = [37.7749, -122.4194] }: Props) {
  const [permits, setPermits] = useState<Permit[]>([])
  const [planningCases, setPlanningCases] = useState<PlanningCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async (bounds?: MapBounds) => {
    setLoading(true)
    setError(null)
    const q = bounds
      ? `?north=${bounds.north}&south=${bounds.south}&east=${bounds.east}&west=${bounds.west}`
      : ''
    try {
      const [permitsRes, planningRes] = await Promise.all([
        fetch(`/api/permits${q}`),
        fetch(`/api/planning${q}`),
      ])
      if (!permitsRes.ok || !planningRes.ok) throw new Error('fetch failed')
      const [permitsData, planningData] = await Promise.all([
        permitsRes.json(),
        planningRes.json(),
      ])
      setPermits(permitsData)
      setPlanningCases(planningData)
    } catch {
      setError('Data temporarily unavailable. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchData(bounds), 300)
  }, [fetchData])

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/40 pointer-events-none">
          <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded shadow">Loading…</span>
        </div>
      )}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded text-sm shadow">
          {error}
        </div>
      )}
      <MapContainer center={initialCenter} zoom={13} className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEventHandler onBoundsChange={handleBoundsChange} />
        {permits.map(p => <PermitMarker key={p.permit_number} permit={p} />)}
        {planningCases.map(c => <PlanningCaseMarker key={c.record_id} planningCase={c} />)}
      </MapContainer>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="components/Map"
```

Expected: PASS (2 tests)

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: PASS (all tests)

- [ ] **Step 6: Commit**

```bash
git add components/Map.tsx __tests__/components/Map.test.tsx
git commit -m "feat: build Map component with viewport-based data fetching and debounce"
```

---

### Task 10: Build map page

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update app/layout.tsx**

Replace the full contents of `app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SF In Progress',
  description: 'Track SF building permits and planning cases on a map',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Update app/page.tsx**

Replace the full contents of `app/page.tsx`:

```tsx
import dynamic from 'next/dynamic'

const Map = dynamic(() => import('@/components/Map'), { ssr: false })

interface Props {
  searchParams: { lat?: string; lng?: string }
}

export default function MapPage({ searchParams }: Props) {
  const centerLat = searchParams.lat ? parseFloat(searchParams.lat) : 37.7749
  const centerLng = searchParams.lng ? parseFloat(searchParams.lng) : -122.4194

  return (
    <main className="h-screen w-full">
      <Map initialCenter={[centerLat, centerLng]} />
    </main>
  )
}
```

- [ ] **Step 3: Start the dev server and verify**

```bash
npm run dev
```

Open http://localhost:3000. Expected:
- Full-screen map of San Francisco with OpenStreetMap tiles
- Loading spinner appears briefly
- Blue and orange markers appear on the map
- No console errors

Press Ctrl+C to stop.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/layout.tsx
git commit -m "feat: build map page with dynamic Leaflet import"
```

---

### Task 11: Build permit detail page

**Files:**
- Create: `app/permits/[id]/page.tsx`
- Create: `app/permits/[id]/loading.tsx`
- Create: `app/permits/[id]/not-found.tsx`

- [ ] **Step 1: Create app/permits/[id]/page.tsx**

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchBuildingPermit } from '@/lib/datasf'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default async function PermitDetailPage({ params }: { params: { id: string } }) {
  let permit
  try {
    permit = await fetchBuildingPermit(params.id)
  } catch (error) {
    if (error instanceof Error && error.message === 'Permit not found') notFound()
    throw error
  }

  const lat = permit.location?.latitude
  const lng = permit.location?.longitude
  const backHref = lat && lng ? `/?lat=${lat}&lng=${lng}` : '/'

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link href={backHref} className="text-blue-600 hover:underline text-sm mb-6 inline-block">
        ← Back to map
      </Link>
      <h1 className="text-2xl font-bold mb-1">{permit.address}</h1>
      <p className="text-gray-500 text-sm mb-6">Building Permit #{permit.permit_number}</p>

      <dl className="divide-y divide-gray-100">
        {([
          ['Type', permit.permit_type_definition ?? permit.permit_type],
          ['Status', permit.status],
          ['Description', permit.description ?? '—'],
          ['Filed', formatDate(permit.filed_date)],
          ['Issued', formatDate(permit.issued_date)],
          ['Completed', formatDate(permit.completed_date)],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} className="py-3 flex gap-4">
            <dt className="w-28 shrink-0 text-sm text-gray-500">{label}</dt>
            <dd className="text-sm">{value}</dd>
          </div>
        ))}
      </dl>

      <a
        href="https://data.sfgov.org/Housing-and-Buildings/Building-Permits/i98e-djp9"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-block text-xs text-gray-400 hover:text-gray-600"
      >
        View source data on DataSF ↗
      </a>
    </main>
  )
}
```

- [ ] **Step 2: Create app/permits/[id]/loading.tsx**

```tsx
export default function PermitLoading() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-6" />
      <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2" />
      <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mb-6" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="py-3 flex gap-4">
          <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
        </div>
      ))}
    </main>
  )
}
```

- [ ] **Step 3: Create app/permits/[id]/not-found.tsx**

```tsx
import Link from 'next/link'

export default function PermitNotFound() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8 text-center">
      <h1 className="text-2xl font-bold mb-2">Permit not found</h1>
      <p className="text-gray-500 mb-6">This permit may have been removed from DataSF.</p>
      <Link href="/" className="text-blue-600 hover:underline">← Back to map</Link>
    </main>
  )
}
```

- [ ] **Step 4: Test in dev server**

```bash
npm run dev
```

Click a blue marker on the map. Expected: navigates to `/permits/[id]` showing address, permit type, status, and dates. "Back to map" returns to map centered on permit location. Press Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add app/permits/
git commit -m "feat: build permit detail page with loading skeleton and 404"
```

---

### Task 12: Build planning case detail page

**Files:**
- Create: `app/planning/[id]/page.tsx`
- Create: `app/planning/[id]/loading.tsx`
- Create: `app/planning/[id]/not-found.tsx`

Note: Adjust field names (`record_id`, `record_type`, `open_date`, `close_date`) if the actual planning dataset (Task 3) uses different names.

- [ ] **Step 1: Create app/planning/[id]/page.tsx**

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchPlanningCase } from '@/lib/datasf'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default async function PlanningDetailPage({ params }: { params: { id: string } }) {
  let planningCase
  try {
    planningCase = await fetchPlanningCase(decodeURIComponent(params.id))
  } catch (error) {
    if (error instanceof Error && error.message === 'Planning case not found') notFound()
    throw error
  }

  const lat = planningCase.location?.latitude
  const lng = planningCase.location?.longitude
  const backHref = lat && lng ? `/?lat=${lat}&lng=${lng}` : '/'

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link href={backHref} className="text-blue-600 hover:underline text-sm mb-6 inline-block">
        ← Back to map
      </Link>
      <h1 className="text-2xl font-bold mb-1">{planningCase.address}</h1>
      <p className="text-gray-500 text-sm mb-6">Planning Case #{planningCase.record_id}</p>

      <dl className="divide-y divide-gray-100">
        {([
          ['Type', planningCase.record_type],
          ['Status', planningCase.status],
          ['Description', planningCase.description ?? '—'],
          ['Opened', formatDate(planningCase.open_date)],
          ['Closed', formatDate(planningCase.close_date)],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label} className="py-3 flex gap-4">
            <dt className="w-28 shrink-0 text-sm text-gray-500">{label}</dt>
            <dd className="text-sm">{value}</dd>
          </div>
        ))}
      </dl>

      <a
        href="https://data.sfgov.org/browse?category=Planning"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-block text-xs text-gray-400 hover:text-gray-600"
      >
        View source data on DataSF ↗
      </a>
    </main>
  )
}
```

- [ ] **Step 2: Create app/planning/[id]/loading.tsx**

```tsx
export default function PlanningLoading() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-6" />
      <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2" />
      <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mb-6" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="py-3 flex gap-4">
          <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
        </div>
      ))}
    </main>
  )
}
```

- [ ] **Step 3: Create app/planning/[id]/not-found.tsx**

```tsx
import Link from 'next/link'

export default function PlanningNotFound() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8 text-center">
      <h1 className="text-2xl font-bold mb-2">Planning case not found</h1>
      <p className="text-gray-500 mb-6">This case may have been removed from DataSF.</p>
      <Link href="/" className="text-blue-600 hover:underline">← Back to map</Link>
    </main>
  )
}
```

- [ ] **Step 4: Test in dev server**

```bash
npm run dev
```

Click an orange marker. Expected: navigates to `/planning/[id]` with address, case type, status, and dates. Press Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add app/planning/
git commit -m "feat: build planning case detail page with loading skeleton and 404"
```

---

### Task 13: Add global error page and final validation

**Files:**
- Create: `app/error.tsx`

- [ ] **Step 1: Create app/error.tsx**

```tsx
'use client'
import Link from 'next/link'

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8 text-center">
      <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
      <p className="text-gray-500 mb-6">Could not load data from DataSF.</p>
      <div className="flex gap-4 justify-center">
        <button onClick={reset} className="text-blue-600 hover:underline">Try again</button>
        <Link href="/" className="text-blue-600 hover:underline">Back to map</Link>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: PASS — all tests pass with no failures.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/error.tsx
git commit -m "feat: add global error boundary"
```

---

### Task 14: Register DataSF app token and deploy to Vercel

**Files:**
- Create: `.env.local` (not committed — already in .gitignore)

- [ ] **Step 1: Register a DataSF app token**

Visit https://data.sfgov.org/profile/app_tokens and sign in (free account). Click "Add New App Token". Set the application name to "SF In Progress". Copy the token string.

- [ ] **Step 2: Create .env.local**

```bash
echo "DATASF_APP_TOKEN=your_token_here" > .env.local
```

Replace `your_token_here` with the token from Step 1.

- [ ] **Step 3: Verify .env.local is not tracked by git**

```bash
git status
```

Expected: `.env.local` does NOT appear in the output.

- [ ] **Step 4: Install Vercel CLI**

```bash
npm install -g vercel
```

- [ ] **Step 5: Deploy to Vercel**

```bash
vercel
```

When prompted:
- Link to existing project? **No**
- Project name: `sf-in-progress`
- Directory: `.` (current)
- Override build settings? **No**

Note the preview URL printed at the end (e.g. `sf-in-progress-abc123.vercel.app`).

- [ ] **Step 6: Add the DataSF app token to Vercel**

```bash
vercel env add DATASF_APP_TOKEN production
```

Paste your token when prompted.

- [ ] **Step 7: Deploy to production**

```bash
vercel --prod
```

Expected: production URL. Visit it and confirm the map loads with permit and planning markers.

- [ ] **Step 8: Final commit**

```bash
git add .
git commit -m "chore: finalize deployment setup"
```
