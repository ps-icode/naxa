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
 ├── cells: GridCell[]
 │     ├── id: string  (format: "r{row}c{col}")
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
'traversable' | 'lane' | 'source' | 'destination' |
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

**Backwards compat (`normaliseCells`):**
When loading old maps (pre-v0.19) that lack the `assigned` field:
```
assigned = existing_value ?? (nodeType !== 'blocked')
```
i.e., old non-blocked cells become `assigned: true`; old blocked cells become `assigned: false`.

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

The single largest component (~600 lines). Manages:
- Konva Stage with 4 layers: background, cells, edges, overlay
- Pointer events → tool dispatch (draw, type, erase, fill, path, select)
- RAF queue refs for paint/erase batching
- Zoom/pan via Konva refs (bypasses React render cycle)
- Cell center memoization (`cellCentersMap`)
- Hatch patterns created once via `makeHatch()` and reused
- Trace animation loop via `useEffect` + `requestAnimationFrame`
- All canvas text (labels, coords) rendered as Konva `Text` nodes

**Sub-components inside GridCanvas:**
- `CellsGroup` — memoized, re-renders only when cells/theme/labels change
- `CellItem` — renders one cell (shape + fill + label)
- `CoordsGroup` — memoized coordinate label overlay
- `EdgeLayer` — all edge arrows

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

| File                            | Tests | Covers                                              |
|---------------------------------|-------|-----------------------------------------------------|
| lib/api.test.ts                 | 13    | fetch wrapper, localStorage fallback, error paths   |
| lib/export.test.ts              | ~35   | buildExportPayload, YAML, field presets, download   |
| lib/floodFill.test.ts           | 16    | assigned semantics, sq/rect/hex connectivity        |
| lib/geometry.test.ts            | 46    | cell center/corner math for all 3 shapes            |
| lib/graph.test.ts               | 33    | BFS, validation, trace route building               |
| lib/performance.test.ts         | 12    | Paint, BFS, history timing regressions              |
| store/gridStore.test.ts         | 72    | All actions, assigned field, clearCellBatch         |
| store/uiStore.test.ts           | ~38   | All setters, toggles, toast, selection              |
| **Total**                       | **270** |                                                   |

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

The `id` field in cells uses the `r{row}c{col}` format (e.g., `r0c5`). This is an
internal implementation detail and may change in future if maps support cell IDs
that don't derive from coordinates (e.g., after copy-paste or grid resize).
