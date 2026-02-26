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

157 tests across `lib/graph`, `lib/grid/geometry`, `lib/api`, `store/gridStore`, and `store/uiStore`.

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

## Roadmap

| Version | Feature |
|---------|---------|
| v0.2    | User auth (JWT), shareable map links |
| v0.3    | ROS 2 / nav2 costmap export |
| v0.4    | VDA5050-compatible graph export for AMR fleets |
| v0.5    | React Native mobile app (iOS + Android) |
| v1.0    | Real-time collaboration, robot telemetry overlay |
