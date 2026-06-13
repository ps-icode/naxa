# Architecture — Naxa

**Version:** 0.19.0
**Last updated:** 2026-06-14

---

## System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    Browser / Tablet                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              React App (Vite + Bun)                    │  │
│  │                                                        │  │
│  │  ┌─────────────────┐   ┌──────────────────────────┐   │  │
│  │  │  Zustand Stores │   │  React-Konva Canvas       │   │  │
│  │  │  gridStore      │◄──│  (cells+edges+overlays)  │   │  │
│  │  │  uiStore        │   └──────────────────────────┘   │  │
│  │  └────────┬────────┘                                   │  │
│  │           │ REST (fetch) + localStorage fallback        │  │
│  └───────────┼────────────────────────────────────────────┘  │
└──────────────┼───────────────────────────────────────────────┘
               │
               ▼
┌────────────────────────┐
│   FastAPI (Uvicorn)    │
│                        │
│   /api/maps  (CRUD)    │
│   SQLModel ORM         │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│   PostgreSQL 16        │
│   table: grid_maps     │
└────────────────────────┘
```

---

## Frontend Architecture

```
apps/web/src/
├── App.tsx                      # Root layout, keyboard shortcuts, modal gates
├── components/
│   ├── Canvas/
│   │   ├── GridCanvas.tsx        # Konva Stage: all rendering + pointer/gesture logic
│   │   ├── CanvasErrorBoundary.tsx  # React class ErrorBoundary wrapping GridCanvas
│   │   └── CanvasOverlay.tsx     # Hover, selection, path, trace overlays (extracted)
│   ├── Export/
│   │   └── ExportModal.tsx      # Custom JSON/YAML export modal
│   ├── LayerPanel/
│   │   └── LayerPanel.tsx       # Layer toggles, cell info panel, stats, load/new
│   ├── MapSetup/
│   │   └── MapSetupModal.tsx    # New-map wizard (shape, size, scale)
│   └── Toolbar/
│       └── Toolbar.tsx          # Tool picker, actions, trace controls, view toggles
├── store/
│   ├── gridStore.ts             # Map data: cells, edges, config + undo/redo history
│   └── uiStore.ts               # UI state: tool, zoom/pan, modals, toast, trace, selection
├── lib/
│   ├── api.ts                   # fetch wrapper for FastAPI + localStorage fallback
│   ├── export.ts                # PNG/CAD export (Konva-dependent)
│   ├── exportData.ts            # JSON/YAML serialization (pure, no Konva, testable)
│   ├── graph.ts                 # Adjacency graph, BFS, validation, trace routes
│   ├── themes.ts                # PANE_THEMES: dark/light color tokens
│   └── grid/
│       ├── floodFill.ts         # BFS flood-fill through unassigned cells
│       └── geometry.ts          # Cell center/corner math for sq/rect/hex
└── __tests__/
    ├── lib/
    │   ├── api.test.ts
    │   ├── export.test.ts       # exportData.ts: YAML, field presets, downloadCustomExport
    │   ├── floodFill.test.ts    # assigned-semantics flood fill
    │   ├── geometry.test.ts
    │   ├── graph.test.ts
    │   └── performance.test.ts  # Paint/fill/BFS timing regressions
    └── store/
        ├── gridStore.test.ts    # All store actions including clearCellBatch, UUID cell IDs
        └── uiStore.test.ts
```

### Key Frontend Patterns

**Two Zustand stores (not three):**
- `gridStore` — all map data (cells, edges, config, layers) plus undo/redo past/future stacks
- `uiStore` — all view state (active tool, zoom/pan, modal visibility, toast, trace, selection)
- History is embedded in gridStore, not a separate store (simplifies cross-store dependencies)

**Snapshot-based undo/redo:**
- `snap(state)` clones `state.map` into `past[]` (capped at 50 via `slice(-49)`)
- `undo` / `redo` swap current map with past/future stacks
- Paint strokes call `snapshotNow()` once at stroke start, then stream `setCellTypeBatch` updates (no per-cell snapshots)

**RAF-batched paint/erase:**
- Two refs: `paintQueueRef: Map<id, NodeType>` and `eraseQueueRef: Set<id>`
- Both drained by a shared RAF tick (`rafPaintRef`)
- Prevents hundreds of store updates per mouse-move event

**Pan/zoom via refs, not state:**
- Zoom/pan values live in `zoomRef` / `panRef`, not Zustand
- `applyTransform()` calls `stageRef.current.scale/position()` directly
- React only re-renders at tool switch, not on every scroll event

**`assigned` flag semantics:**
- `assigned: false` (or absent) = default/untyped cell — hatch rendered, floodable
- `assigned: true` = explicitly typed by user — full color, including red for explicit blocked
- `clearCellBatch()` resets to `assigned: false` (erase tool)
- `setCellType/Batch()` sets to `assigned: true` (type/draw tool)

---

## Backend Architecture

```
apps/api/
├── src/
│   ├── main.py          # FastAPI app, CORS, lifespan (create_db_and_tables)
│   ├── db/
│   │   └── _db.py       # SQLAlchemy engine + session factory (StaticPool for tests)
│   ├── models/
│   │   └── map.py       # GridMap SQLModel table + request/response Pydantic schemas
│   └── routes/
│       └── maps.py      # Full CRUD: GET list (cursor-paginated), POST, GET, PATCH, DELETE
├── migrations/
│   ├── env.py           # Alembic env: loads SQLModel metadata, reads DATABASE_URL
│   ├── script.py.mako   # Template for new migration files
│   └── versions/
│       └── 001_initial_schema.py  # Creates grid_maps table
├── alembic.ini          # Alembic config: script_location, DATABASE_URL from env
└── tests/
    ├── conftest.py      # SQLite in-memory engine, monkey-patches _db.engine before imports
    └── test_maps.py     # 14 route tests covering all CRUD + pagination operations
```

**Key backend decisions:**
- Grid data (cells, edges, layers) stored as JSON columns — document-like arrays always
  read/written as a whole; no normalization needed
- SQLModel unifies SQLAlchemy ORM + Pydantic v2 validation (no duplicate model definitions)
- Lifespan function handles `create_db_and_tables()` (not a deprecated `@app.on_event`)
- Docker healthcheck prevents FastAPI from starting before PostgreSQL is ready
- StaticPool in tests ensures the same in-memory SQLite DB is shared across all test connections

---

## Shared Types Package

```
packages/core/src/index.ts
```

Single source of truth for all domain types used across web (and future mobile) app:
- `NodeType` union: `traversable | path | source | destination | charging | parking | blocked | junction`
- `SUBTYPES` map: VDA5050/MiR/Locus-inspired subtype options per node type
- `GridCell`, `Edge`, `Layer`, `GridConfig`, `GridMap` interfaces
- `NODE_TYPE_COLORS` — canonical hex colors per node type
- `DEFAULT_LAYERS` — 8 pre-configured layer definitions

---

## Database Schema

### `grid_maps`

| Column      | Type      | Notes                                          |
|-------------|-----------|------------------------------------------------|
| id          | TEXT (PK) | UUID v4                                        |
| name        | TEXT      |                                                |
| config      | JSONB     | GridConfig: shape, rows, cols, cellSizeMeters  |
| cells       | JSONB     | GridCell[]: id, coord, nodeType, assigned, ... |
| edges       | JSONB     | Edge[]: id, from, to, direction, bidirectional |
| layers      | JSONB     | Layer[]: id, name, nodeType, visible, color    |
| created_at  | TIMESTAMP |                                                |
| updated_at  | TIMESTAMP |                                                |

---

## Infrastructure

```
docker-compose.yml
├── postgres    (PostgreSQL 16, healthcheck: pg_isready)
├── api         (FastAPI, depends_on postgres:healthy, retry backoff in lifespan)
└── web         (Vite dev server, port 3000)

infra/
├── Dockerfile.web    (bun + Vite)
└── Dockerfile.api    (uv + uvicorn)
```

**Port map:** web → 3000, api → 8000, postgres → 5432 (internal)

**Test commands:**
```bash
# Frontend tests (278 tests, 100% coverage)
docker run --rm -v $(pwd):/naxa -w /naxa/apps/web naxa-web:latest bun test:coverage

# Backend tests (14 tests)
docker run --rm -v $(pwd)/apps/api:/app naxa-api:latest uv run pytest tests/ -v
```

---

## Key Design Decisions Log

| Decision                              | Rationale                                                                                   |
|---------------------------------------|---------------------------------------------------------------------------------------------|
| React-Konva for canvas                | Layered canvas API with first-class touch/mouse support; cheap show/hide per Konva Layer    |
| Two Zustand stores                    | gridStore (data) + uiStore (view) — clean separation, simpler than 3-store original design  |
| History in gridStore                  | Avoids cross-store subscription complexity; snapshots are full GridMap clones               |
| RAF-batched paint                     | Prevents per-pixel re-renders during drag; single snapshot per stroke                       |
| Pan/zoom via Konva refs               | Decouples viewport from React render cycle; eliminates jank on scroll/pinch                 |
| `assigned` flag on GridCell           | Cleanly separates "never touched" from "explicitly set to blocked"; fixes fill/erase semantics |
| `migrateMap()` pipeline on loadMap    | Versioned migration (CURRENT_SCHEMA_VERSION=2); v1→v2 adds `assigned` field; extensible for future schema changes |
| UUID cell IDs (crypto.randomUUID)     | Decouples cell identity from coordinates; required for safe grid resize and copy-paste      |
| `coordToId` map in GridCanvas         | `Map<'r{row}c{col}', cell.id>` — pointer events hit-test coords then look up UUID; keeps event handlers O(1) |
| Viewport culling via `visibleCells`   | `map.cells.filter(inViewportBounds)` debounced 100ms; prevents Konva from rendering off-screen cells at large grid sizes |
| `CanvasOverlay.tsx` extraction        | Keeps GridCanvas focused on input/layout; overlays (hover, select, path, trace) are pure display components |
| `CanvasErrorBoundary` class component | React requires class components for error boundaries; catches Konva throws without crashing the app |
| Cursor-based API pagination           | `GET /api/maps?limit=50&cursor=<base64>` + `X-Next-Cursor` header; stable under concurrent inserts vs. offset pagination |
| Alembic for schema migrations         | `migrations/versions/` tracked in git; `alembic upgrade head` is idempotent for prod deploys |
| Pure `exportData.ts` (no Konva)       | Allows JSON/YAML serialization to be tested in Vitest without browser/canvas shims          |
| Istanbul coverage (not v8)            | Bun uses JavaScriptCore; V8 coverage APIs unavailable; istanbul works via instrumentation   |
| JSONB for grid data in Postgres       | Arrays are always read/written whole; no query filtering on individual cells needed         |
| localStorage fallback in api.ts       | Enables offline usage and demos without running the backend                                 |
