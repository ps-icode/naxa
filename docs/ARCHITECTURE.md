# Architecture — Naxa

## System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    Browser / Tablet                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                  React App (Vite)                      │  │
│  │                                                        │  │
│  │  ┌──────────────┐   ┌──────────────────────────────┐  │  │
│  │  │   Zustand    │   │   React-Konva Canvas         │  │  │
│  │  │   Stores     │◄──│   (grid + lanes + layers)   │  │  │
│  │  └──────┬───────┘   └──────────────────────────────┘  │  │
│  │         │ REST (fetch)                                  │  │
│  └─────────┼──────────────────────────────────────────────┘  │
└────────────┼─────────────────────────────────────────────────┘
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
├── components/
│   ├── Canvas/          # Konva Stage, grid renderer, gesture handlers
│   │   ├── GridCanvas   # Main stage + layer composition
│   │   ├── CellShape    # Renders square / rect / hex cell polygons
│   │   └── EdgeArrow    # Renders directional lane arrows
│   ├── Toolbar/         # Tool picker, grid config, undo/redo, export
│   └── LayerPanel/      # Layer toggle list, node type selector
├── store/
│   ├── gridStore.ts     # Grid config, cells, edges (source of truth)
│   ├── layerStore.ts    # Layer visibility, active node type
│   └── historyStore.ts  # Undo/redo via snapshot stack of gridStore state
├── lib/
│   ├── grid/            # Cell geometry: coordinate math for hex/rect
│   ├── graph/           # Graph builder, A* path preview, connectivity check
│   └── export/          # JSON graph exporter, PNG renderer
└── types/               # Re-exports from @naxa/core
```

---

## Backend Architecture

```
apps/api/src/
├── main.py              # FastAPI app, CORS, lifespan
├── db/
│   └── session.py       # SQLAlchemy engine, session factory
├── models/
│   └── map.py           # GridMap SQLModel + Pydantic schemas
└── routes/
    └── maps.py          # CRUD endpoints for /api/maps
```

---

## Key Design Decisions

### React-Konva for canvas
Konva.js provides a layered canvas API with first-class touch/mouse event support.
Each semantic layer in Naxa maps to a Konva `Layer`, enabling cheap show/hide
toggles without re-rendering the full canvas.

### Zustand for state
Three focused stores instead of a single monolithic one:
1. `gridStore` — source of truth for the map (cells, edges, config)
2. `layerStore` — UI-only layer visibility and active tool
3. `historyStore` — undo/redo via a snapshot array of `gridStore` states

### FastAPI + SQLModel
SQLModel unifies SQLAlchemy ORM with Pydantic v2 validation, avoiding duplicated
model definitions. Grid data (cells, edges, layers) is stored as JSON columns rather
than normalized tables — these are document-like arrays that are always read/written
as a whole, making JSON storage the right fit.

### No auth in v0.1
Auth adds meaningful complexity (tokens, ownership, middleware). Maps are unowned
in v0.1. User authentication (JWT + row-level ownership) is planned for v0.2.

### Shared types via @naxa/core
`packages/core` holds all TypeScript domain types used by both the web app and the
future mobile app. This prevents type drift between clients.

---

## Database Schema

### `grid_maps`

| Column      | Type      | Notes                          |
|-------------|-----------|--------------------------------|
| id          | TEXT (PK) | UUID v4                        |
| name        | TEXT      |                                |
| config      | JSONB     | GridConfig (shape, rows, cols) |
| cells       | JSONB     | GridCell[]                     |
| edges       | JSONB     | Edge[]                         |
| layers      | JSONB     | Layer[]                        |
| created_at  | TIMESTAMP |                                |
| updated_at  | TIMESTAMP |                                |
