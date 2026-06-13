# Development Status — Naxa

**As of:** 2026-06-14
**Branch:** production
**Tests:** 270 frontend (100% coverage) · 11 backend

---

## Version History

### v0.1 — 2026-02-26 — Foundation
- Full canvas editor: square/rect/hex grids, lane drawing, node types
- Layer panel with visibility toggles
- Undo/redo (50-step snapshot history)
- BFS shortest path preview (Path tool)
- JSON export
- PNG export
- FastAPI backend: full CRUD for GridMap
- PostgreSQL via SQLModel
- Docker Compose: postgres + api + web with healthcheck-gated startup
- Offline localStorage fallback in api.ts
- 157 frontend tests (Vitest + Istanbul, 100% coverage)
- 11 backend tests (pytest, SQLite in-memory)

### v0.11 — 2026-02-27
- Renamed "Lanes" → "Boundaries" in layer panel
- Coordinate labels rendered at top-inner edge of each cell
- Column width set to 50px
- Area stat added to LayerPanel

### v0.12 — 2026-02-27
- CAD export: dimension anchors at DIM_PAD + GRID_PADDING
- Layer info tooltips via LAYER_INFO map + ⓘ badge per layer

### v0.13 — 2026-02-27
- `ValidationResult` interface with 5 fields (unreachable, unreachableDestinations,
  unreachableSources, unreachableCharging, unreachableParking)
- Multi-source BFS validation from all source cells simultaneously
- Charging/parking/return reachability checks added
- Richer toast messages per validation failure type
- 167 tests

### v0.14 — 2026-02-27
- Erase drag: RAF-batched, single snapshot at stroke start
- Load button added to LayerPanel sidebar

### v0.15 — 2026-02-27
- Trace routes collapsed behind "Routes (N) ▼/▲" toggle button

### v0.16 — 2026-02-27
- Pan/zoom fully decoupled from React renders (Konva refs + `applyTransform()`)
- Coordinate layer renders only above a zoom threshold
- `CoordsGroup` memoized to prevent unnecessary Konva re-renders

### v0.17 — 2026-02-27
- Light/dark pane theming (`PANE_THEMES` in `lib/themes.ts`)
- Map name inline edit (double-click on canvas header)
- Reset buttons: ⤢ Fit to screen, ↺ Reset Lanes, ↺ Reset All
- 1-indexed coordinate labels (display-only, internal model stays 0-indexed)
- Rectangle shape: independent `cellHeightMeters` field in GridConfig
- Fit-to-screen triggered automatically on new map creation
- 179 tests

### v0.18 — 2026-06-14
- Custom JSON/YAML export modal (ExportModal.tsx)
- `exportData.ts`: pure data-transform layer (no Konva, fully testable)
- Field name presets: naxa, ros2, amr
- Coordinate origin choice (0 or 1 indexed)
- Optional sections: config block, layers list
- `toYAML()` and `needsYAMLQuotes()` hand-rolled serializer

### v0.19 — 2026-06-14
- `assigned?: boolean` field on GridCell (core semantic change)
  - `assigned: false` = unassigned/default cell → minimal hatch
  - `assigned: true` = explicitly typed → full color including red for explicit blocked
- `normaliseCells()` for backwards compatibility on old map load
- `clearCellBatch()` new gridStore action (erase → `assigned: false`)
- Fill tool now correctly floods only through `!assigned` cells
- RAF dual queue: `paintQueueRef` + `eraseQueueRef` sharing one RAF tick
- Trace: persistent start/end markers (filled circle + ring) during animation
- Cell type labels moved to top-left corner of each cell
- `showCellLabels` toggle (Labels button in toolbar)
- Reset Map button (↺ Reset) with confirmation dialog
- Grid max raised from 50×50 to 1000×1000 (with perf warning at >10,000 cells)
- Keyboard shortcuts suppressed when target is INPUT/TEXTAREA/contentEditable
- Clearer cell borders (stronger stroke colors in BG_THEMES)
- Minimal hatch (tone-on-tone, nearly invisible for unassigned cells)
- LayerPanel stats and cell info panel use `!!c.assigned`
- 270 tests, 100% coverage
- `traversable` NodeType added to core
- `select` tool added (rectangle region selection → bulk type apply)
- `fill` tool added (flood fill)

---

## Current Test Counts

| Suite                    | Tests | Coverage |
|--------------------------|-------|----------|
| lib/api.test.ts          | 13    | 100%     |
| lib/export.test.ts       | ~35   | 100%     |
| lib/floodFill.test.ts    | 16    | 100%     |
| lib/geometry.test.ts     | 46    | 100%     |
| lib/graph.test.ts        | 33    | 100%     |
| lib/performance.test.ts  | 12    | —        |
| store/gridStore.test.ts  | 72    | 100%     |
| store/uiStore.test.ts    | ~38   | 100%     |
| **Frontend total**       | **270** | **100%** |
| Backend (pytest)         | 11    | —        |

---

## What Is NOT Yet Done

- JWT authentication and user accounts
- Map ownership / access control
- Shareable read-only map links
- Alembic database migrations
- ROS 2 costmap export (pgm + yaml)
- VDA5050 protocol export
- React Native mobile app
- Real-time collaboration
- Grid resize after creation
- Copy-paste of cell regions
- Multi-floor / building hierarchy
- Import from external format (JSON/YAML/DXF)
- Undo for label edits (currently intentionally excluded)

---

## Known Limitations / Tech Debt

1. **GridCanvas.tsx is ~600 lines** — candidate for splitting into sub-components
   (TraceOverlay, SelectionRect, EdgeLayer) when functionality expands further

2. **Cell ID format is coordinate-derived** (`r{row}c{col}`) — prevents safe grid
   resize, copy-paste, or cell reordering without ID collision

3. **No grid resize** — changing rows/cols requires creating a new map; all work is lost

4. **Label edits are not undo-tracked** — `setCellLabel` intentionally skips snapshots
   (keeps undo stack clean for structural changes, but surprising for users)

5. **`lane` NodeType is internal** — cells painted by the Draw tool are set to `lane`
   but this isn't surfaced clearly in the UI (no layer filter, no type selector entry)

6. **Performance at 1000×1000 is untested** — the 10,000-cell performance threshold
   exists in tests; 1,000,000 cells is allowed by the UI but likely too slow to render
   with Konva's canvas approach

7. **Backend has no pagination** — `GET /api/maps` returns all maps; will become slow
   at scale (deferred to v0.2 with auth)

8. **No Alembic migrations** — schema changes require dropping and recreating tables;
   acceptable in pre-v0.2 single-user mode

9. **SSH key not in Docker/dev session** — git push requires switching remote to HTTPS
   (`git remote set-url origin https://github.com/ps-icode/naxa.git`) or configuring
   SSH forwarding in the container
