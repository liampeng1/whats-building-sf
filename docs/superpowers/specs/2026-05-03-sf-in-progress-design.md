# SF In Progress — Design Spec

**Date:** 2026-05-03
**Status:** Approved

## Overview

A public-facing web app that tracks SF development permits and planning cases on an interactive map, similar to Seattle In Progress. Targeted at the general public — neighbors, curious residents, anyone following city development.

## MVP Scope

- Interactive map showing building permits and planning cases as markers
- Clickable markers that navigate to individual detail pages
- Detail pages with full permit/case metadata, shareable URLs
- Live data from SF's DataSF open data platform (no database for MVP)

Out of scope for MVP: list/table view, filtering UI, photos, user accounts, notifications.

## Architecture

```
Browser
  │
  ├── GET /                      → Map page (SSR shell + client map component)
  ├── GET /permits/[id]          → Building permit detail (SSR)
  ├── GET /planning/[id]         → Planning case detail (SSR)
  │
  └── fetch /api/...             → Next.js API routes (server-side proxy)
                                        │
                                        └── DataSF Socrata API
                                              ├── Building Permits (i98e-djp9)
                                              └── Planning Cases (ahk4-r8ms)
```

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Map | React-Leaflet + OpenStreetMap tiles |
| Styling | Tailwind CSS |
| Data source | DataSF Socrata API |
| Hosting | Vercel |
| Database | None (MVP) |

## File Structure

```
sf-in-progress/
  app/
    page.tsx                    # Map page (SSR shell)
    loading.tsx                 # Global loading skeleton
    permits/
      [id]/
        page.tsx                # Building permit detail (SSR)
        loading.tsx
    planning/
      [id]/
        page.tsx                # Planning case detail (SSR)
        loading.tsx
    api/
      permits/
        route.ts                # GET /api/permits?bounds=...
        [id]/
          route.ts              # GET /api/permits/[id]
      planning/
        route.ts                # GET /api/planning?bounds=...
        [id]/
          route.ts              # GET /api/planning/[id]
  components/
    Map.tsx                     # Client component (Leaflet)
    PermitMarker.tsx            # Map marker with popup
  lib/
    datasf.ts                   # DataSF API client (single abstraction layer)
    types.ts                    # Shared TypeScript types
```

## Data Layer

### DataSF Datasets

**Building Permits** — dataset ID `i98e-djp9`
- Key fields: `permit_number`, `permit_type`, `status`, `description`, `address`, `filed_date`, `issued_date`, `completed_date`, `location` (lat/lng)

**Planning Cases** — dataset ID TBD (verify at data.sfgov.org before implementation; likely the "Planning Department Records" or "SF Planning Cases" dataset)
- Key fields: `record_id`, `record_type`, `description`, `address`, `status`, `open_date`, `close_date`, `location` (lat/lng)

### `lib/datasf.ts` Interface

```ts
fetchBuildingPermits(bounds: MapBounds): Promise<Permit[]>
fetchBuildingPermit(id: string): Promise<Permit>
fetchPlanningCases(bounds: MapBounds): Promise<PlanningCase[]>
fetchPlanningCase(id: string): Promise<PlanningCase>
```

This is the single file that changes when adding a database layer. All API routes and pages remain unchanged.

### API Routes

All routes are server-side proxies — they call `lib/datasf.ts` and return JSON.

- `GET /api/permits?bounds=lat1,lng1,lat2,lng2` — building permits within viewport
- `GET /api/permits/[id]` — single building permit by permit number
- `GET /api/planning?bounds=lat1,lng1,lat2,lng2` — planning cases within viewport
- `GET /api/planning/[id]` — single planning case by record ID

DataSF geo filtering uses Socrata's `within_box(location, lat1, lng1, lat2, lng2)` query param.

### Loading Strategy

- **Initial load:** fetch the 500 most-recently-filed records citywide (both datasets), ordered by `filed_date DESC`
- **On pan/zoom end:** debounced re-fetch within new viewport bounds (300ms debounce)
- **Rate limiting:** register a free DataSF app token and pass as `X-App-Token` header; raises limit from 1000 to unlimited requests/day

## Map Component

- Default center: `[37.7749, -122.4194]` (SF), zoom level 13
- Building permit markers: blue
- Planning case markers: orange
- Marker popup on hover/click: address, type, status
- Clicking marker navigates to `/permits/[id]` or `/planning/[id]`
- Spinner overlay while fetching
- Error banner on DataSF API failure ("Data temporarily unavailable")

The Map component is a client component (`"use client"`). `app/page.tsx` is the SSR shell that renders the map inside a container with a fixed height.

## Detail Pages

Server-rendered for SEO and fast initial load. Each page:
- Fetches the full record from `/api/permits/[id]` or `/api/planning/[id]`
- Displays all available fields in a readable layout
- Includes a "Back to map" link (returns to map centered on permit's coordinates)
- Links to the original DataSF record

Uses Next.js `loading.tsx` for skeleton UI during data fetch.

## Error Handling

- Map fetch error: show non-blocking banner, keep existing markers visible
- Detail page fetch error: show full-page error with link back to map
- DataSF 404: show "Permit not found" message on detail page

## Deployment

- **Platform:** Vercel (zero-config Next.js deployment, free tier)
- **Environment variable:** `DATASF_APP_TOKEN` — optional for MVP but recommended

## Future: Database Optimization Path

When live API latency becomes an issue:

1. Add Postgres (Neon serverless, free tier)
2. Add a nightly sync job (Vercel Cron or GitHub Actions) to upsert DataSF records
3. Update `lib/datasf.ts` to read from DB
4. All API routes and frontend pages remain unchanged
