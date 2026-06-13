# Developer Context — Naxa

> This file is the single source of truth for picking up Naxa development in any session.
> Read this before touching any code. Update it when non-obvious decisions are made.

**Last updated:** 2026-06-14 | **Version:** 0.19.0

---

## What This Project Is

Browser-based grid map editor for AMR / robot navigation graph design.
Users draw directional lanes on grid cells, assign semantic node types, validate
connectivity, animate robot traces, and export to JSON/YAML for any nav stack.

Stack: React 18 + TypeScript + Vite + React-Konva + Zustand (frontend)
       FastAPI + SQLModel + PostgreSQL (backend)
       Bun (JS runtime/bundler) · uv (Python) · Docker Compose

---

## How to Run Everything

```bash
# All services (recommended for dev)
cd /home/unbox/ps-icode/naxa
docker compose up

# Frontend tests
docker run --rm -v $(pwd):/naxa -w /naxa/apps/web naxa-web:latest bun test:coverage

# Backend tests
docker run --rm -v $(pwd)/apps/api:/app naxa-api:latest uv run pytest tests/ -v

# Push (SSH key not available in dev session — use HTTPS)
git remote set-url origin https://github.com/ps-icode/naxa.git
git push origin production
```

URLs: web → http://localhost:3000 · api → http://localhost:8000 · api docs → http://localhost:8000/docs

---

## The Central Abstraction: `assigned` Flag

The most important domain concept introduced in v0.19. **Get this right before touching cell logic.**

```
GridCell.assigned: boolean | undefined
  false / undefined  =  "default" cell — user never touched it
                         rendered as minimal hatch
                         floodFill() can enter this cell
                         erase tool resets TO this state

  true               =  "explicitly typed" cell — user set it
                         rendered with full color (even blocked = solid red)
                         floodFill() stops at this cell
                         erase tool removes this flag
```

Key actions:
- `setCellType(id, nt)` → `assigned: true`
- `setCellTypeBatch(updates)` → `assigned: true` on each
- `clearCellBatch(ids)` → `assigned: false`, nodeType → 'blocked'  ← ERASE TOOL
- `resetCells()` → `assigned: false` on ALL cells

When loading old maps: `normaliseCells()` in `loadMap` sets
`assigned = c.assigned ?? (c.nodeType !== 'blocked')`

---

## Store Structure

**Two stores only** (original design had three; history was merged into gridStore):

### gridStore (`apps/web/src/store/gridStore.ts`)
- Owns: `map`, `past[]`, `future[]`, `savedList`
- Snapshot pattern: `snap(state)` clones `state.map` into `past[]` before any mutation
- Paint strokes: `snapshotNow()` once at stroke start → stream `setCellTypeBatch` during drag
- Erase strokes: `snapshotNow()` once at stroke start → stream `clearCellBatch` during drag
- History capped at 50 (`slice(-49)` before push)

### uiStore (`apps/web/src/store/uiStore.ts`)
- Owns: all view state (tool, zoom, pan, modals, toast, trace, selection, themes)
- `setTool()` clears path/edge/trace/selection as side effects
- `showToast()` auto-dismisses via `setTimeout` (side effect in action — acceptable)
- `fitRequested` is a counter, not a boolean (prevents React from deduplicating same-value sets)

---

## GridCanvas Architecture

`apps/web/src/components/Canvas/GridCanvas.tsx` — the largest file (~600 lines).

**Rendering layers (Konva):**
1. `Layer` bg — grid lines, hatch patterns for unassigned cells, cell fills
2. `Layer` cells — typed cell colors, labels (via `CellsGroup` + `CellItem`)
3. `Layer` edges — directional arrows (`EdgeLayer`)
4. `Layer` overlay — path preview, trace animation, selection rectangle, validation highlight

**Pan/zoom — NOT React state:**
```
zoomRef / panRef → applyTransform() → stageRef.current.scale/position()
```
React state for zoom/pan was causing jank on scroll. Now viewport changes never trigger renders.

**Paint batching:**
```
paintQueueRef: Map<cellId, NodeType>   — type/draw tool
eraseQueueRef: Set<cellId>             — erase tool
rafPaintRef: number | null             — shared RAF handle

pointerdown → snapshotNow() + start RAF
pointermove → queue cells
RAF tick    → drain both queues → setCellTypeBatch() / clearCellBatch()
pointerup   → cancel RAF
```

**Cell center memoization:**
`cellCentersMap` = `useMemo` over all cells, returns `Map<cellId, {x, y, w, h}>`.
Re-computes only when config or cells array reference changes.

**Hatch patterns:**
Created once via `makeHatch(bg, line, tileSize, lineWidth)` and stored as data URLs.
Two versions: dark theme and light theme. Minimal visibility (tone-on-tone).

---

## Test Infrastructure

**Coverage requirement: 100%** on all files in `lib/` and `store/`.
Enforced in `vitest.config.ts` — CI fails if any threshold drops below 100%.

**Critical rules:**
1. Coverage provider = **istanbul** (NOT v8). Bun uses JavaScriptCore; v8 coverage unavailable.
2. Istanbul comment ignores (`/* c8 ignore */`) are **stripped by Bun's TS transform** — remove
   dead code instead of annotating it.
3. Tests that import Konva (directly or transitively via `lib/export.ts`) will fail because
   Konva requires the native `canvas` npm package in Node.js. Always import from `lib/exportData.ts`
   (pure, no Konva) instead of `lib/export.ts` (Konva-aware) in tests.
4. Performance test thresholds are set with headroom for Docker overhead (generally 2–3× native).

**Backend test pattern:**
```python
# conftest.py — ORDER MATTERS
os.environ["DATABASE_URL"] = "sqlite:///:memory:"  # must be before any src imports
# then monkey-patch _db.engine with StaticPool SQLite
```
StaticPool ensures the same in-memory SQLite DB is shared across all test connections.
Without it, each request creates a new in-memory DB and sees no data.

---

## Export System Split

Two files, intentionally:

| File                   | Konva dep | Testable | Purpose                              |
|------------------------|-----------|----------|--------------------------------------|
| `lib/export.ts`        | Yes       | No       | PNG, CAD (uses Konva stage.toCanvas) |
| `lib/exportData.ts`    | No        | Yes      | JSON/YAML, buildExportPayload, toYAML |

**Never import `lib/export.ts` in tests.** Always use `lib/exportData.ts` for data transform tests.

---

## Shared Types Package

`packages/core/src/index.ts` — imported as `@naxa/core`.

Alias configured in `vitest.config.ts` and `vite.config.ts`:
```
'@naxa/core' → 'packages/core/src/index.ts'
```

All domain types live here. When adding a new NodeType or field to GridCell/Edge,
update this file first, then update `gridStore.ts`, then update rendering.

---

## NodeType Gotchas

- `'lane'` is a NodeType that is **set by the Draw tool** (not the Type tool)
  It represents a "traversable corridor" — not the same as an edge/lane.
  This naming is confusing; `'lane'` cells are distinct from `Edge` objects.

- `'traversable'` was added in v0.17. It's the default active type in uiStore.
  Intended for open floor / traversable areas not specifically typed.

- `'blocked'` is the default nodeType for ALL cells, whether assigned or not.
  The `assigned` flag is what distinguishes "explicitly blocked" from "default/empty".

---

## Backwards Compatibility Rules

1. When adding fields to `GridCell`, always make them optional (`?`).
2. When `loadMap` is called, run `normaliseCells()` to handle missing fields from old saves.
3. Never change the cell ID format (`r{row}c{col}`) without a migration strategy.
4. Never change the edge ID format (`e_{from}_{to}`) without checking for duplicate detection.

---

## Git Workflow

- Branch: `production` (main working branch — CLAUDE.md says this but the remote is `main`)
- Commit after every logical unit of work
- Push immediately after every commit
- SSH not available in dev session → `git remote set-url origin https://github.com/ps-icode/naxa.git`
- Commit message style: imperative present tense + *why* body for non-obvious changes

---

## Common Pitfalls

| Pitfall                                        | Fix                                                              |
|------------------------------------------------|------------------------------------------------------------------|
| Adding `setCellType` in erase → assigns:true  | Use `clearCellBatch()` for erase, NOT `setCellType('blocked')`  |
| Modifying zoom/pan via React state             | Use Konva refs + `applyTransform()` only                        |
| Import from `lib/export.ts` in tests           | Import from `lib/exportData.ts` instead                        |
| Adding Istanbul ignore comments                | Delete the dead code; ignores are stripped by Bun               |
| Forgetting `snapshotNow()` before batch paint  | Always call once at `pointerdown`, not inside the RAF tick      |
| `floodFill` starting on assigned cell          | Returns `[]` — this is correct; Fill tool should no-op         |
| Calling `setCellTypeBatch(ids, 'node')` format | Signature is `{ id, nodeType }[]` array, not `(ids, type)`     |
