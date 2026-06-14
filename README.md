# Naxa

> Browser-based grid map editor for AMR and robot navigation systems.

Naxa lets you visually design navigable floor plans by drawing directional lanes across
grid cells, assign semantic node types across layers, validate connectivity, animate robot
traces, and export structured graphs ready for any autonomous mobile robot (AMR) navigation
stack.

## Features

- **Interactive grid canvas** — square, rectangular, and hexagonal cell shapes (up to 1000×1000)
- **Lane drawing** — drag to create directed edges; click to toggle bidirectional
- **Semantic node types** — traversable, path, source, destination, charging, parking, blocked, junction
- **Layer system** — toggle layer visibility per node type; assigned-cell counts per layer
- **Fill tool** — flood-fill contiguous unassigned cells with the active type
- **Select tool** — drag to select a region; apply active type to all selected cells
- **Undo / redo** — 50-step snapshot history (Ctrl/Cmd+Z / Ctrl/Cmd+Y)
- **Connectivity validation** — multi-source BFS; highlights unreachable destinations, charging, parking
- **Path preview** — click two cells to show BFS shortest path
- **Trace animation** — animate robot traversal of all source→destination routes simultaneously
- **Custom JSON/YAML export** — configurable field names, coordinate origin, optional sections
- **PNG / CAD export** — full-resolution snapshot or dimension-annotated CAD image
- **Viewport culling** — renders only on-screen cells; smooth at large grid sizes
- **Offline-first** — localStorage fallback when backend is unreachable
- **Dark/light theme** — all panes and canvas switch together

## Quick Start

**Prerequisite:** Docker

```bash
git clone https://github.com/ps-icode/naxa.git
cd naxa
docker compose up
```

| Service | URL                          |
|---------|------------------------------|
| Web app | http://localhost:3000        |
| API     | http://localhost:8000        |
| API docs| http://localhost:8000/docs   |

## Using the Editor

### 1. Create a map
Click **+ New Map** in the sidebar. Set a name, grid shape, dimensions, and cell size (meters).

### 2. Draw lanes
Select **Draw** (D). Drag across adjacent cells to create directed edges. Click a lane arrow to toggle bidirectional.

### 3. Assign node types
Select **Type** (T), pick a node type from the layer panel, then click or drag to paint cells.
Use **Fill** (F) to flood-fill contiguous unassigned cells, or **Select** (S) to bulk-apply.

### 4. Validate & preview paths
- **Validate** — runs BFS from all source cells; unreachable nodes are highlighted red
- **Path** (P) — click two cells to show the shortest path between them
- **Trace** (▶) — animates robot traversal of all source→destination routes

### 5. Save & export
- **Save** — persists to backend (PostgreSQL); also cached in localStorage
- **Export** — JSON or YAML with configurable field names and coordinate system
- **PNG** / **CAD** — raster snapshots

### Keyboard shortcuts

| Key          | Action                          |
|--------------|---------------------------------|
| D            | Draw tool                       |
| T            | Type tool                       |
| E            | Erase tool                      |
| S            | Select tool                     |
| F            | Fill tool                       |
| P            | Path tool                       |
| Ctrl/Cmd+Z   | Undo                            |
| Ctrl/Cmd+Y   | Redo                            |
| Delete       | Delete selected edge            |

Shortcuts are suppressed when focus is in an input or textarea.

## Node Types

| Node Type   | Color     | Role                                              |
|-------------|-----------|---------------------------------------------------|
| traversable | #0ea5e9   | Generic passable floor (aisles, staging, etc.)    |
| path        | #4a5568   | Directed corridors painted by the Draw tool       |
| source      | #22c55e   | Robot pickup / induction points                   |
| destination | #3b82f6   | Robot drop-off / delivery endpoints               |
| charging    | #f59e0b   | Battery charging stations                         |
| parking     | #a855f7   | Idle / maintenance bays                           |
| blocked     | #ef4444   | Walls, pillars, no-go zones                       |
| junction    | #06b6d4   | Merge, diverge, crossover points                  |

Unassigned cells (never explicitly typed) display as a minimal hatch — they are not
the same as explicitly-blocked cells.

## Running Tests

All tooling runs inside Docker — host install of bun/uv is not required.

```bash
# Frontend (278 tests, 100% coverage on lib/ and store/)
docker run --rm -v $(pwd):/naxa -w /naxa/apps/web naxa-web:latest bun test:coverage

# Backend (14 tests, all CRUD + pagination routes)
docker run --rm -v $(pwd)/apps/api:/app naxa-api:latest uv run pytest tests/ -v
```

## API Reference

| Method | Path              | Description                                         |
|--------|-------------------|-----------------------------------------------------|
| GET    | /health           | Health check                                        |
| GET    | /api/maps         | List maps (`?limit=50&cursor=<token>`)              |
| POST   | /api/maps         | Create a map                                        |
| GET    | /api/maps/{id}    | Get map by ID                                       |
| PATCH  | /api/maps/{id}    | Update a map                                        |
| DELETE | /api/maps/{id}    | Delete a map                                        |

`GET /api/maps` supports cursor-based pagination. Pass `?limit=N&cursor=<token>` and
read the `X-Next-Cursor` response header for the next page token.

## Environment Variables

### Backend (`apps/api/.env`)

| Variable          | Default                                      | Description                           |
|-------------------|----------------------------------------------|---------------------------------------|
| `DATABASE_URL`    | _(required)_                                 | PostgreSQL connection string          |
| `ALLOWED_ORIGINS` | `http://localhost:3000`                      | Comma-separated CORS allowed origins  |

Copy `apps/api/.env.example` to `apps/api/.env` to get started.

## Monorepo Structure

```
naxa/
├── apps/
│   ├── web/          # React 18 + TypeScript + Vite + React-Konva
│   ├── api/          # FastAPI + SQLModel + PostgreSQL
│   └── mobile/       # Placeholder (future React Native app)
├── packages/
│   └── core/         # Shared TypeScript domain types (@naxa/core)
├── infra/docker/     # Dockerfiles
├── docs/             # PRD, Architecture, SDD, dev notes
└── docker-compose.yml
```

## Tech Stack

| Layer      | Technology                                        |
|------------|---------------------------------------------------|
| Frontend   | React 18, TypeScript, Vite, React-Konva, Zustand  |
| Backend    | FastAPI, SQLModel, Alembic, PostgreSQL 16         |
| Tooling    | bun (JS), uv + ruff (Python), Docker Compose      |
| Testing    | Vitest + Istanbul (frontend), pytest (backend)    |

## Docs

- [Product Requirements Document](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Software Design Document](docs/SDD.md)
- [Development Status](docs/dev/STATUS.md)
- [Roadmap](docs/dev/ROADMAP.md)

## Status

**v0.19 — Complete** · [See full changelog](docs/dev/STATUS.md)

Next: **v0.2** — JWT authentication, map ownership, shareable read-only links.
