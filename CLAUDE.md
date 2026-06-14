# Naxa — Grid Map Editor for Robot Navigation

Gamified browser-based grid map editor. Users draw directional lanes on grid cells,
assign semantic node types across layers, and export navigable graphs for use in
AMR / grid-based navigation systems.

## Repo Structure

```
naxa/
├── apps/
│   ├── web/        # React + TypeScript + Vite + React-Konva (primary app)
│   ├── api/        # FastAPI + SQLModel + PostgreSQL backend
│   └── mobile/     # Future React Native app (placeholder)
├── packages/
│   └── core/       # Shared TypeScript types (@naxa/core)
├── infra/          # Dockerfiles
├── docs/           # PRD, architecture docs, dev notes
├── docker-compose.yml
└── README.md
```

## Current State (v0.19 — 2026-06-14)

### What is complete
- Full React frontend: grid canvas (square/rect/hex), lane drawing, node types, layers,
  undo/redo (50-step), BFS path preview, trace animation, connectivity validation,
  fill/select tools, custom JSON/YAML export, viewport culling, ErrorBoundary
- FastAPI backend: full CRUD for GridMap, cursor-based pagination, PostgreSQL via SQLModel,
  Alembic migrations, offline localStorage fallback
- Schema versioning: CURRENT_SCHEMA_VERSION=2, migrateMap() pipeline in loadMap
- Tests: 278 frontend tests (Vitest + Istanbul, 100% coverage on lib/ + store/),
  14 backend tests (pytest, SQLite in-memory, all routes covered)
- Docker Compose: postgres + api + web, healthcheck-gated startup
- GitHub: https://github.com/ps-icode/naxa.git (remote: origin, branch: production)

### What is next (v0.2)
- JWT auth: login/register, map ownership, shareable read-only links
- See docs/dev/ROADMAP.md for full roadmap

### Key tooling notes
- JS tooling (bun, vitest) runs inside Docker — host has no bun in PATH
- To run frontend tests: `docker run --rm -v $(pwd):/naxa -w /naxa/apps/web naxa-web:latest bun test:coverage`
- To run backend tests: `docker run --rm -v $(pwd)/apps/api:/app naxa-api:latest uv run pytest tests/ -v`
- Coverage provider must be **istanbul** (not v8) — Bun uses JavaScriptCore, v8 coverage APIs not available
- Istanbul comment-based ignores are stripped by Bun's TS transform — delete dead code instead
- Backend conftest.py: must set `os.environ["DATABASE_URL"]` before any src imports AND monkey-patch `_db.engine`

## Running Locally

```bash
# All services (postgres + api + web)
docker compose up
# web → http://localhost:3000  api → http://localhost:8000
```

## Tech Stack

| Layer      | Technology                                 |
|------------|--------------------------------------------|
| Frontend   | React 18, TypeScript, Vite, React-Konva, Zustand |
| Backend    | FastAPI, SQLModel, Alembic, Uvicorn        |
| Database   | PostgreSQL 16                              |
| JS tooling | bun (runtime + package manager)            |
| Python     | uv (package manager), ruff (lint/format)   |

## Key Domain Concepts

- **GridMap** — top-level entity: named map with config, cells, edges, layers, schemaVersion
- **Cell** — a single grid node identified by UUID (not coord-derived). Has coord, nodeType, assigned flag
- **assigned flag** — `false`/absent = untyped/default (hatch); `true` = explicitly typed by user
- **Edge** — a directional connection between two cells (a navigable lane), id = `e_{fromId}_{toId}`
- **Layer** — semantic grouping toggled for visibility (one per NodeType)
- **NodeType** — `traversable | path | source | destination | charging | parking | blocked | junction`
- **schemaVersion** — bumped on breaking data model changes; `migrateMap()` in loadMap runs all pending migrations

## Key Canvas Patterns

- **coordToId** — `Map<'r{row}c{col}', cell.id>` in GridCanvas; always use this to translate pointer events → cell UUIDs
- **cellCenters** — keyed by `cell.id` (UUID); never by coord string
- **visibleCells** — viewport-culled subset of `map.cells`; passed to CellsGroup, CoordsGroup, CanvasOverlay
- **CanvasErrorBoundary** — class component wrapping GridCanvas in App.tsx

## Code Conventions

### Python (apps/api)
- Type hints required on all functions
- Formatter + linter: `ruff`
- ORM only — never raw SQL; use SQLModel
- Routes under `/api/` prefix

### TypeScript (apps/web, packages/core)
- Strict mode, no `any`
- Shared domain types live in `packages/core/src/index.ts`
- State in Zustand stores (`apps/web/src/store/`)
- All canvas drawing via React-Konva

## Git Workflow

- **Branch:** `production` (main working branch)
- **Commit frequently** — after every logical unit of work
- **Commit messages** — imperative present tense, concise subject, body explaining *why* for non-obvious changes
- **Push after every commit** — always push to `origin production` immediately

## Do Not
- Do not add auth until explicitly requested (v0.2 scope)
- Do not use `any` in TypeScript
- Do not write raw SQL
- Do not add features beyond what is scoped in `docs/PRD.md`
- Do not build cell IDs from coordinates — use `coordToId.get(...)` in event handlers
- This is NOT a ROS 2 project unless explicitly stated
