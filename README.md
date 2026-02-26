# Naxa

> Gamified grid map editor for AMR and robot navigation systems.

Naxa lets you visually design navigable floor maps by drawing directional lanes
across grid cells, assign semantic node types, validate connectivity, and export
structured graphs ready for use in autonomous mobile robot (AMR) navigation systems.

## Features

- **Interactive grid canvas** — square, rectangular, and hexagonal cell shapes
- **Gesture-driven lane drawing** — swipe to create directional edges; tap to toggle one-way / bidirectional
- **Semantic node types** — source, destination, charging, parking, blocked, junction; color-coded per type
- **Layer system** — toggle layer visibility to focus on one type at a time
- **Undo / redo** — full linear history with Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z
- **Connectivity validation** — highlights unreachable destination cells
- **Path preview** — click two cells to visualize the shortest path (BFS)
- **Graph export** — export as JSON (nodes + directed edges) or PNG top-view image
- **Scale calibration** — set real-world cell size (e.g. 1 cell = 0.5 m)
- **Offline-first** — maps are cached in localStorage; backend sync is best-effort

## Monorepo Structure

```
naxa/
├── apps/
│   ├── web/          # React 18 + TypeScript + Vite + React-Konva (primary app)
│   ├── api/          # FastAPI + SQLModel + PostgreSQL backend
│   └── mobile/       # Future mobile app (placeholder)
├── packages/
│   └── core/         # Shared TypeScript types (@naxa/core)
├── infra/            # Dockerfiles
├── docs/             # PRD and architecture docs
└── docker-compose.yml
```

## Quick Start

**Prerequisites:** Docker, bun ≥ 1.0, Python 3.11+, uv

```bash
# Start all services (postgres + api + web)
docker compose up
```

The web app is available at **http://localhost:3000** and the API at **http://localhost:8000**.

To run services individually:

```bash
# Frontend
bun --cwd apps/web dev

# Backend (requires a running PostgreSQL instance)
cd apps/api && uv run uvicorn src.main:app --reload
```

## Using the Editor

### 1. Create a map

Click **New Map** in the sidebar. Enter a name, choose a grid shape (square / rectangle / hexagon), set the grid dimensions and real-world cell size (meters per cell), then confirm.

### 2. Draw lanes

Select the **Draw** tool in the toolbar. Click and drag across adjacent cells to create a directed lane. The swipe direction sets the edge direction, visualized with an arrow. To make a lane bidirectional, click it to select it and press **B** (or click the toggle in the inspector).

### 3. Assign node types

Select a node type from the toolbar (source, destination, charging, parking, blocked, junction), then click or drag over cells to paint them. Click a painted cell again with the same type to revert it to a plain lane.

### 4. Validate & preview paths

- Click **Validate** to run a connectivity check. Unreachable destination cells are highlighted in red.
- Select the **Path** tool, then click a source cell followed by a destination cell to preview the shortest path.

### 5. Save & export

- **Save** (Ctrl/Cmd+S) persists the map to the backend. Maps are also cached locally so they survive network outages.
- **Export → JSON** downloads the full graph (cells + directed edges) as a `.json` file.
- **Export → PNG** downloads a top-view raster image of the current canvas.

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Ctrl/Cmd+Z | Undo |
| Shift+Ctrl/Cmd+Z | Redo |
| Delete / Backspace | Delete selected edge |
| B | Toggle selected edge bidirectional |

## Cell Color Reference

| Node Type   | Color              |
|-------------|--------------------|
| Lane        | #4a5568 (gray)     |
| Source      | #48bb78 (green)    |
| Destination | #4299e1 (blue)     |
| Charging    | #f6ad55 (amber)    |
| Parking     | #9f7aea (purple)   |
| Blocked     | #fc8181 (red)      |
| Junction    | #76e4f7 (cyan)     |

## Running Tests

### Frontend (Vitest + Istanbul)

```bash
cd apps/web

# Run all tests once
bun test

# Watch mode
bun test:watch

# Coverage report (must meet 100% on lib/ and store/)
bun test:coverage
```

167 tests across `lib/graph`, `lib/grid/geometry`, `lib/api`, `store/gridStore`, and `store/uiStore`.

### Backend (pytest)

```bash
cd apps/api

# Run all tests (uses SQLite in-memory — no running database required)
uv run pytest tests/ -v --tb=short
```

11 tests covering all CRUD routes and the health endpoint.

## API Reference

| Method | Path             | Description       |
|--------|------------------|-------------------|
| GET    | /health          | Health check      |
| GET    | /api/maps        | List all maps     |
| POST   | /api/maps        | Create a map      |
| GET    | /api/maps/{id}   | Get map by ID     |
| PATCH  | /api/maps/{id}   | Update a map      |
| DELETE | /api/maps/{id}   | Delete a map      |

Interactive docs (Swagger UI) available at **http://localhost:8000/docs** when the API is running.

## Tech Stack

| Layer      | Technology                                        |
|------------|---------------------------------------------------|
| Frontend   | React 18, TypeScript, Vite, React-Konva, Zustand  |
| Backend    | FastAPI, SQLModel, PostgreSQL 16                  |
| Tooling    | bun (JS), uv + ruff (Python), Docker Compose      |
| Testing    | Vitest + Istanbul (frontend), pytest (backend)    |

## Docs

- [Product Requirements Document](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)

## Current Status

**v0.1 — Complete**

| Area | Status |
|---|---|
| Interactive grid canvas (square / rect / hex) | Done |
| Lane drawing, bidirectional toggle, edge deletion | Done |
| Semantic node types + layer visibility | Done |
| Undo / redo (50-step linear history) | Done |
| Connectivity validation + BFS path preview | Done |
| JSON + PNG export | Done |
| FastAPI backend + PostgreSQL persistence | Done |
| Offline-first localStorage fallback | Done |
| Frontend tests — 157 tests, 100% coverage | Done |
| Backend tests — 11 tests, all routes | Done |

## v0.11 — UX Polish

- Renamed "Lanes" layer to "Boundaries" (single source of truth in `DEFAULT_LAYERS`)
- Coord labels moved to cell top-inner edge (no collision with node-type icon)
- Coord label width increased to 50px to prevent `(100,100)` wrapping
- Area stat added to LayerPanel: `rows × cols × cellSizeMeters²` in m²
- Same coord-label fixes applied to CAD export

## v0.12 — CAD Fix + Node Info

- Fixed CAD dimension tick marks to anchor at actual cell grid edges (not canvas margin)
- Layer panel rows now show native hover tooltips with one-line descriptions per node type
- ⓘ badge inline in each layer name for discoverability

## v0.13 — Full Validation

- New `ValidationResult` type: `unreachableDestinations`, `unreachableSources`, `unreachableCharging`, `unreachableParking` (plus `unreachable` union)
- Multi-source BFS replaces per-destination BFS loop: O(V+E) instead of O(sources × V+E)
- Validate now checks charging and parking reachability and source return paths
- Toast message breaks down unreachable counts by category
- 8 new graph tests; 167 total, 100% coverage

## v0.14 — Erase Drag + Load Map

- Erase tool supports click-and-drag (RAF-batched, single snapshot per stroke)
- New **Load** button in toolbar opens file picker for `.naxa.json` files with validation

## v0.15 — Trace Routes UI

- Route badges collapsed behind a **Routes (N) ▼/▲** toggle button
- Auto-collapses when trace stops; reduces toolbar clutter for large route sets

## v0.16 — Performance

- Pan and zoom updates bypass React reconciliation: Konva Groups are mutated imperatively via refs; no re-renders during scroll/drag
- Coord layer only mounts when `zoom ≥ 0.7` (labels unreadable at lower zoom) — eliminates ~8000 Konva nodes at low zoom
- `CoordsGroup` memoized separately from the rest of the canvas

## Roadmap

### v0.2 — Auth & Sharing
- JWT-based user authentication (login / register)
- Map ownership — users only see their own maps
- Shareable read-only map links (token-based)
- Alembic migrations wired up for schema evolution

### v0.3 — ROS 2 / nav2 Export
- Export map as a nav2-compatible costmap (YAML + PGM)
- Cell size calibration drives real-world resolution
- Blocked cells → occupied pixels; lanes → free space

### v0.4 — VDA5050 Fleet Export
- Export navigation graph in VDA5050 JSON format
- Node and edge IDs aligned to VDA5050 topology spec
- Supports AMR fleet management systems out of the box

### v0.5 — Mobile App
- React Native app (`apps/mobile/`) for iOS + Android
- Touch-first lane drawing optimized for tablets
- Shares all domain types via `@naxa/core`

### v1.0 — Collaboration & Telemetry
- Real-time multi-user map editing (WebSocket / CRDT)
- Live robot telemetry overlay on the canvas
- Map versioning and change history
