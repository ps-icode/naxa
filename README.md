# Naxa

> Gamified grid map editor for AMR and robot navigation systems.

Naxa lets you visually design navigable floor maps by drawing directional lanes
across grid cells. Export maps as structured graphs ready for use in grid-based
navigation systems.

## Features

- **Interactive grid canvas** — square, rectangular, and hexagonal cell shapes
- **Gesture-driven lane drawing** — swipe to create directional edges between cells
- **Layer system** — semantic layers for sources, destinations, charging stations,
  parking zones, and blocked areas
- **Graph export** — export as JSON graph (nodes + edges) or PNG top-view
- **Path preview** — validate connectivity with A* simulation
- **Scale calibration** — set real-world cell size (1 cell = N meters)

## Monorepo Structure

```
naxa/
├── apps/
│   ├── web/          # React frontend (primary app)
│   ├── api/          # FastAPI backend
│   └── mobile/       # Future mobile app (placeholder)
├── packages/
│   └── core/         # Shared TypeScript types
├── infra/            # Docker config
├── docs/             # PRD and architecture docs
└── docker-compose.yml
```

## Quick Start

**Prerequisites:** Docker, bun ≥ 1.0, Python 3.11+, uv

```bash
# Start all services (postgres + api + web)
docker compose up

# Or run services individually:
bun --cwd apps/web dev                                      # http://localhost:3000
cd apps/api && uv run uvicorn src.main:app --reload         # http://localhost:8000
```

## Tech Stack

| Layer      | Technology                                        |
|------------|---------------------------------------------------|
| Frontend   | React 18, TypeScript, Vite, React-Konva, Zustand  |
| Backend    | FastAPI, SQLModel, PostgreSQL 16                  |
| Tooling    | bun (JS), uv + ruff (Python), Docker Compose      |

## Docs

- [Product Requirements Document](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- API Reference — http://localhost:8000/docs (when running)
