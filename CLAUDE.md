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
├── docs/           # PRD, architecture docs
├── docker-compose.yml
└── README.md
```

## Running Locally

```bash
# All services (postgres + api + web)
docker compose up

# Frontend only
bun --cwd apps/web dev              # http://localhost:3000

# Backend only
cd apps/api && uv run uvicorn src.main:app --reload  # http://localhost:8000
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

- **GridMap** — top-level entity: named map with config, cells, edges, layers
- **Cell** — a single grid node identified by (row, col) with a semantic NodeType
- **Edge** — a directional connection between two cells (a navigable lane)
- **Layer** — semantic grouping toggled for visibility (e.g., charging stations)
- **NodeType** — `source | destination | charging | parking | blocked | junction`

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

## Do Not
- Do not add auth until explicitly requested
- Do not use `any` in TypeScript
- Do not write raw SQL
- Do not add features beyond what is scoped in `docs/PRD.md`
- This is NOT a ROS 2 project unless explicitly stated
