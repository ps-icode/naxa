# Software Design Document — Naxa

**Version:** 0.19.0
**Last updated:** 2026-06-14

---

## 1. Domain Model

### 1.1 Core Types (`packages/core/src/index.ts`)

```
GridMap
 ├── id: string (UUID)
 ├── name: string
 ├── createdAt / updatedAt: ISO string
 ├── config: GridConfig
 │     ├── rows, cols: number
 │     ├── cellShape: 'square' | 'rectangle' | 'hexagon'
 │     ├── cellSizeMeters: number  (col width or hex circumradius)
 │     └── cellHeightMeters?: number  (rectangle rows only)
 ├── schemaVersion: number  (current: 2 — used by migrateMap() pipeline)
 ├── cells: GridCell[]
 │     ├── id: string  (UUID v4 — crypto.randomUUID() at creation)
 │     ├── coord: { row, col }
 │     ├── nodeType: NodeType
 │     ├── assigned?: boolean  ← KEY FIELD (see §2.1)
 │     ├── subtype?: string
 │     ├── label?: string
 │     └── metadata?: Record<string, unknown>
 ├── edges: Edge[]
 │     ├── id: string  (format: "e_{from}_{to}")
 │     ├── from, to: cell id strings
 │     ├── direction: Direction (N/NE/E/SE/S/SW/W/NW)
 │     ├── bidirectional: boolean
 │     └── cost?: number
 └── layers: Layer[]
       ├── id, name: string
       ├── nodeType: NodeType
       ├── visible: boolean
       └── color: string (hex)
```

### 1.2 NodeType Enum

```
'traversable' | 'path' | 'source' | 'destination' |
'charging' | 'parking' | 'blocked' | 'junction'
```

Unassigned/default cells use `nodeType: 'blocked'` with `assigned: false`.
This is purely a default — it does NOT mean the cell is explicitly blocked.

---

## 2. Key Algorithms

### 2.1 Cell Assignment Semantics

The `assigned` flag is the central semantic distinction in the data model:

| State              | assigned    | nodeType  | Visual                    | Fill tool | Erase result |
|--------------------|-------------|-----------|---------------------------|-----------|--------------|
| Unassigned/default | false/undef | 'blocked' | Minimal hatch pattern     | Floodable | stays false  |
| Explicitly typed   | true        | any       | Full color (incl. red)    | Blocked   | → false      |

**Setting assigned:**
- `setCellType(id, nodeType)` → sets `assigned: true`
- `setCellTypeBatch(updates)` → sets `assigned: true` on all
- `clearCellBatch(ids)` → sets `assigned: false`, nodeType back to 'blocked'
- `resetCells()` → sets `assigned: false` on all cells

**Schema migration pipeline (`migrateMap`):**
`loadMap` passes the raw JSON through `migrateMap(raw)` before storing it:
```
CURRENT_SCHEMA_VERSION = 2

v1 → v2: assigns the `assigned` boolean field on every cell
  assigned = c.assigned ?? (c.nodeType !== 'blocked')
  (old non-blocked cells → true; old blocked/default cells → false)
```
Maps without a `schemaVersion` field are treated as v1.

### 2.2 Flood Fill (`lib/grid/floodFill.ts`)

BFS through unassigned cells. Semantics:
- Start on assigned cell → return `[]` immediately (no fill)
- Flood stops at any cell with `assigned: true`
- 4-connectivity for square/rectangle grids
- 6-connectivity for hexagon grids (offset-grid parity rules)
- Returns array of cell IDs in the flooded region

**Hex neighbor offsets** (offset-grid convention):
- Even rows: `[[-1,0],[0,1],[1,0],[1,-1],[0,-1],[-1,-1]]`
- Odd rows:  `[[-1,1],[0,1],[1,1],[1,0],[0,-1],[-1,0]]`

### 2.3 BFS Shortest Path (`lib/graph.ts`)

Standard BFS on the edge adjacency list. Used by the Path tool (P).
- Builds adjacency from `map.edges` (bidirectional edges added in both directions)
- Returns cell ID array from start to end, or null if unreachable

### 2.4 Multi-source Connectivity Validation (`lib/graph.ts`)

Validates that all non-source semantic nodes are reachable from the source fleet:
1. Build directed adjacency graph from all edges
2. BFS/DFS from all `source` cells simultaneously
3. Collect all reachable cell IDs
4. Report cells by type that are not in reachable set:
   - `unreachableDestinations`, `unreachableSources`, `unreachableCharging`, `unreachableParking`
   - `unreachable` = union of all four

### 2.5 Trace Route Animation (`lib/graph.ts` + `GridCanvas.tsx`)

Trace computes all source→destination routes via BFS, then animates them:
1. `buildTraceRoutes(map)` → `TraceRoute[]` — each route has `pathIds`, `color`, `label`
2. Canvas runs a `useEffect` loop on `traceRunning`:
   - Uses a `useRef` tick counter (not React state) to advance position
   - `traceSpeed` from uiStore scales cells/sec → ms/cell
   - Three overlays rendered: start marker (filled circle), end marker (ring), cursor (moving dot)
3. Multiple routes animate simultaneously in different colors

### 2.6 RAF Paint Queue

Two queues share one RAF timer, preventing per-pixel store updates during drag:

```
paintQueueRef: Map<cellId, NodeType>   → flushed via setCellTypeBatch()
eraseQueueRef: Set<cellId>             → flushed via clearCellBatch()
rafPaintRef: number | null             → single requestAnimationFrame handle
```

On each mouse-move event, cells are added to the appropriate queue.
On each RAF tick, both queues are drained and cleared.
`snapshotNow()` is called once at `pointerdown` (stroke start).

### 2.7 YAML Serialization (`lib/exportData.ts::toYAML`)

Hand-rolled YAML emitter (no third-party deps):
- Null/undefined → `null`
- Booleans, numbers → unquoted
- Strings → unquoted unless `needsYAMLQuotes` returns true (boolean-like, numeric, special chars)
- Empty arrays → `[]`, empty objects → `{}`
- Arrays → YAML block sequences (`- key: val`)
- Objects → YAML block mappings (`key:\n  subkey: val`)
- Nested objects within array items handled recursively

---

## 3. State Management

### 3.1 gridStore

```
state:
  map: GridMap | null
  past: GridMap[]      (undo stack, max 50)
  future: GridMap[]    (redo stack, max 50)
  savedList: { id, name, updatedAt }[]

key actions:
  newMap(name, config)              → initialises cells with assigned:false
  loadMap(map)                      → normaliseCells() then clears history
  setCellType(id, nodeType)         → snap + assigned:true
  setCellTypeBatch(updates)         → NO snap (caller calls snapshotNow first)
  clearCellBatch(ids)               → NO snap (caller calls snapshotNow first)
  snapshotNow()                     → explicit snapshot (used at stroke start)
  resetCells()                      → snap + all cells → assigned:false
  addEdge / removeEdge / clearEdges → each snaps
  undo() / redo()                   → swap current↔past/future
```

### 3.2 uiStore

```
state:
  tool: 'draw'|'type'|'erase'|'select'|'fill'|'path'
  activeNodeType: NodeType
  zoom, pan, fitRequested
  selectedCellId, selectedEdgeId
  pathStart, pathEnd, pathResult
  showNewMapModal, showExportModal
  validationResult: ValidationResult | null
  toast: { message, type } | null
  traceRoutes, traceRunning, traceSpeed
  showCellCoords, showCellLabels
  mapBg: 'dark' | 'light'
  selection: Set<string>

key behaviours:
  setTool() → clears path/edge/trace/selection side effects
  showToast() → sets toast, auto-dismisses after 3.5s via setTimeout
  requestFitToScreen() → increments fitRequested (signals canvas effect)
```

---

## 4. Component Design

### 4.1 GridCanvas.tsx

The primary canvas component. Manages:
- Konva Stage with 4 layers: background, cells, edges, overlay
- Pointer events → tool dispatch (draw, type, erase, fill, path, select)
- RAF queue refs for paint/erase batching
- Zoom/pan via Konva refs (bypasses React render cycle)
- `coordToId` map: `Map<'r{row}c{col}', cell.id>` — translates pointer coords → UUID cell IDs
- `cellCenters` keyed by `cell.id` (UUID) — used for all canvas lookups
- `visibleCells` — viewport-culled cell list (debounced, 100ms after pan/zoom)
- Hatch patterns created once via `makeHatch()` and reused
- Trace animation loop via `useEffect` + `requestAnimationFrame`
- All canvas text (labels, coords) rendered as Konva `Text` nodes

**Sub-components:**
- `CellsGroup` — memoized, re-renders only when cells/theme/labels change; receives `visibleCells`
- `CellItem` — renders one cell (shape + fill + label)
- `CoordsGroup` — memoized coordinate label overlay; receives `visibleCells`
- `EdgeLayer` — all edge arrows
- `CanvasOverlay` — hover highlight, selection rect, path preview, trace animation overlays (in `CanvasOverlay.tsx`)

### 4.2 CanvasErrorBoundary.tsx

React class component (`ErrorBoundary` requires class syntax). Wraps `GridCanvas` in `App.tsx`.
On Konva error or null deref, catches the throw and renders a "Canvas error — Retry" fallback.
The Retry button calls `this.setState({ error: null })` to remount `GridCanvas`.

### 4.3 CanvasOverlay.tsx

Extracted from `GridCanvas.tsx`. Contains four local function components:
- `HoverHighlight` — semi-transparent highlight over hovered cell
- `SelectionOverlay` — dashed rectangle for drag-select region
- `PathOverlay` — BFS shortest-path highlight (blue line + markers)
- `TraceOverlay` — animated trace dots (start circle, end ring, cursor dot)

Receives `visibleCells`, `cellCenters`, path/trace state from `GridCanvas` as props.

### 4.2 Toolbar.tsx

Horizontal action bar. Contains all map-level controls:
- Tool buttons (with keyboard shortcut hint)
- Selection apply (contextual, visible only in select tool with active selection)
- Undo/redo
- Trace controls (▶/⏹, speed slider, route legend)
- View toggles (Coords, Labels, Dark/Light)
- Map operations (Validate, Export, PNG, CAD, Reset, Save)

### 4.3 LayerPanel.tsx

Left sidebar. Contains:
- Layer toggles with cell counts and ⓘ tooltips
- Cell info panel (shown when assigned cell is selected in type/select tool)
  - Subtype picker, label text input
- Stats row (typed cells, lanes, scale, area)
- Load / New Map buttons
- Keyboard hint footer

---

## 5. Export System

### 5.1 PNG / CAD Export (`lib/export.ts`)

Konva-dependent — uses `stage.toCanvas()`:
- PNG: direct canvas snapshot at current zoom/pan
- CAD: redraws grid at fixed scale with DIM_PAD padding, adds dimension anchors
  and 1-indexed coordinate labels around the border

### 5.2 Custom JSON/YAML Export (`lib/exportData.ts`)

Pure data transform — no Konva dependency (safe to test in Vitest/Node):
- `buildExportPayload(map, opts)` → `Record<string, unknown>` — the transform layer
- `downloadCustomExport(map, opts)` → triggers browser download via `<a>` click
- Options: `format`, `coordOrigin` (0|1), `excludeDefaultBlocked`, `includeConfig`,
  `includeLayers`, `fieldNames` (per-field key remapping)
- Field name presets: `naxa`, `ros2`, `amr` (see PRD §5.8)

---

## 6. Testing Strategy

### 6.1 Coverage Target

100% statements, branches, functions, and lines on all files in `lib/` and `store/`.
Coverage enforced by `vitest.config.ts` thresholds — CI fails if coverage drops.

### 6.2 Test Files

| File                            | Tests | Covers                                                        |
|---------------------------------|-------|---------------------------------------------------------------|
| lib/api.test.ts                 | 19    | fetch wrapper, listPage pagination, localStorage fallback     |
| lib/export.test.ts              | ~35   | buildExportPayload, YAML, field presets, download             |
| lib/floodFill.test.ts           | 16    | assigned semantics, sq/rect/hex connectivity                  |
| lib/geometry.test.ts            | 46    | cell center/corner math for all 3 shapes                      |
| lib/graph.test.ts               | 33    | BFS, validation, trace route building                         |
| lib/performance.test.ts         | 12    | Paint, BFS, history timing regressions                        |
| store/gridStore.test.ts         | 72    | All actions, UUID cell IDs, clearCellBatch, migrateMap        |
| store/uiStore.test.ts           | ~38   | All setters, toggles, toast, selection                        |
| **Total**                       | **278** |                                                             |

### 6.3 Test Tooling Notes

- **Runtime:** Bun (JavaScriptCore, not V8)
- **Coverage:** Istanbul instrumentation (`@vitest/coverage-istanbul`), NOT v8
- **Environment:** jsdom (for DOM APIs in export/canvas tests)
- **Istanbul comment ignores are stripped by Bun** — delete dead code instead of annotating
- **Konva import in tests:** Konva requires a `canvas` native module in Node — avoid importing
  from files that import Konva. The split between `export.ts` (Konva) and `exportData.ts`
  (pure) exists precisely for this reason.
- **StaticPool for backend tests:** SQLite in-memory with `StaticPool` ensures the same DB
  connection is shared across test sessions (default SQLite connection-per-request would
  create separate in-memory DBs)

---

## 7. Backwards Compatibility Notes

### 7.1 Maps saved before v0.19

Maps lacking the `assigned` field on cells are normalised on load:
```typescript
assigned = c.assigned ?? (c.nodeType !== 'blocked')
```
- Old non-blocked cells (source, destination, etc.) → `assigned: true` ✓
- Old blocked cells (default/typed) → `assigned: false` (treated as unassigned)

**Known limitation:** Old maps with explicitly-placed blocked cells will lose that
"explicitly blocked" distinction and render as unassigned hatch. This is acceptable
for v0.19 since no production maps exist yet.

### 7.2 Export format compatibility

Cell IDs are now UUID v4 strings (e.g., `550e8400-e29b-41d4-a716-446655440000`).
Edge IDs follow `e_{fromId}_{toId}` using the UUID cell IDs.
Maps saved before this change (v1 schema) used `r{row}c{col}` IDs — these are
migrated transparently on load via `migrateMap()` but the IDs themselves remain
as-saved in the JSONB blob until the map is re-saved.
