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

## Current State (last updated 2026-02-26)

### What is complete (v0.1)
- Full React frontend: grid canvas (square/rect/hex), lane drawing, node types, layers,
  undo/redo (50-step), BFS path preview, connectivity validation, JSON + PNG export
- FastAPI backend: full CRUD for GridMap, PostgreSQL via SQLModel, offline localStorage fallback
- Tests: 157 frontend tests (Vitest + Istanbul, 100% coverage on lib/ + store/),
  11 backend tests (pytest, SQLite in-memory, all routes covered)
- Docker Compose: postgres + api + web, healthcheck-gated startup with retry backoff in lifespan
- GitHub: https://github.com/ps-icode/naxa.git (remote: origin, branch: main)

### What is next (v0.2)
- JWT auth: login/register, map ownership, shareable read-only links
- Alembic migrations wired up
- See docs/PRD.md §9 for full roadmap

### Key tooling notes
- JS tooling (bun, vitest) runs inside Docker — host has no bun in PATH
- To run frontend tests: `docker run --rm -v $(pwd):/naxa -w /naxa/apps/web naxa-web:latest bun test:coverage`
- To run backend tests: `docker run --rm -v $(pwd)/apps/api:/app naxa-api:latest uv run pytest tests/ -v`
- Coverage provider must be **istanbul** (not v8) — Bun uses JavaScriptCore, v8 coverage APIs not available
- `@vitest/coverage-istanbul` comment-based ignores are stripped by Bun's TS transform — remove dead code instead
- Backend conftest.py: must set `os.environ["DATABASE_URL"]` before any src imports AND monkey-patch `_db.engine`

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

## Git Workflow

- **Commit frequently** — after every logical unit of work (a feature, a fix, a refactor).
  Never batch unrelated changes into one commit.
- **Commit messages** — imperative present tense, concise subject line, body explaining *why*
  if the change is non-obvious. Example: `Fix API startup race on Docker DNS resolution`.
- **Push after every commit** — always push to `origin main` immediately after committing
  so the remote stays current. Do not let commits accumulate locally.
- Remote: `https://github.com/ps-icode/naxa.git`

## Do Not
- Do not add auth until explicitly requested
- Do not use `any` in TypeScript
- Do not write raw SQL
- Do not add features beyond what is scoped in `docs/PRD.md`
- This is NOT a ROS 2 project unless explicitly stated
