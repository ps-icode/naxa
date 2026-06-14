# Product Requirements Document — Naxa

**Version:** 0.19.0
**Status:** Active development
**Last updated:** 2026-06-14

---

## 1. Overview

Naxa is a browser-based grid map editor for designing navigable floor plans used by
autonomous mobile robots (AMRs) and grid-based navigation systems. It enables operators
and system integrators to visually define navigation graphs — nodes (cells) and directed
edges (lanes) — without writing code, and export them in formats consumable by any nav stack.

---

## 2. Problem Statement

Designing navigation graphs for AMR systems typically requires either:
- Writing JSON or YAML by hand (error-prone, non-visual), or
- Using expensive, proprietary fleet management software (RMF, MiR Fleet, etc.).

Naxa fills this gap: a lightweight, open tool that lets anyone draw a navigation map as
intuitively as sketching on a whiteboard, then export to any custom format.

---

## 3. Goals

| Goal                  | Description                                                                   |
|-----------------------|-------------------------------------------------------------------------------|
| Visual map creation   | Draw and edit grid maps without coding                                        |
| Semantic layering     | Node types separated into togglable layers                                    |
| Flexible export       | Export as JSON or YAML with configurable field names, coordinate systems       |
| Real-world scale      | Calibrate maps to real-world dimensions (meters per cell)                     |
| Graph intelligence    | Built-in BFS validation, shortest-path preview, and route animation           |
| Developer-friendly    | 100% test coverage on all business logic; API-first backend                   |

---

## 4. Non-Goals (current)

- User authentication / multi-user collaboration (planned v0.2)
- 3D or elevation-aware maps
- ROS 2 / nav2 direct integration (planned v0.3)
- VDA5050 fleet protocol export (planned v0.4)
- Mobile native app (planned v0.5)
- Real-time robot telemetry overlay (planned v1.0)
- Multi-floor / building hierarchy

---

## 5. Feature Inventory (as of v0.19)

### 5.1 Grid Setup
- Create new maps with a name, cell shape (square / rectangle / hexagon), dimensions
  (rows × cols, up to 1000×1000), and real-world cell size (m/cell)
- Rectangle shape supports independent column-width and row-height (both in meters)
- Hexagon shape uses circumradius (center-to-vertex) as the cell size
- Performance warning shown when cell count exceeds 10,000
- Load previously saved maps; inline-edit map name on the canvas
- Fit-to-screen on new map creation and via ⤢ button

### 5.2 Tools

| Tool   | Key | Behaviour                                                                              |
|--------|-----|----------------------------------------------------------------------------------------|
| Draw   | D   | Drag across adjacent cells to paint directional lanes (edges). Click lane to toggle bidirectional. |
| Type   | T   | Click or drag to paint a cell type. Active type set in the layer panel.               |
| Erase  | E   | Click or drag to reset cells to unassigned state. Click a lane to delete it.          |
| Select | S   | Drag to select a rectangular region; then apply active type to all selected cells.    |
| Fill   | F   | Click an unassigned cell to flood-fill all contiguous unassigned cells with active type. |
| Path   | P   | Click two cells to preview the BFS shortest path between them.                        |

- Keyboard shortcuts (D/T/E/S/F/P) are suppressed when focus is inside an input or textarea
- Undo (Ctrl/Cmd+Z) and Redo (Ctrl/Cmd+Y or Shift+Z) with 50-step history

### 5.3 Cell Semantics

Every cell has an `assigned` flag:
- **Unassigned** (`assigned: false`): default/empty state — rendered as minimal hatch pattern.
  The Fill tool, erase tool, and flood-fill all operate on this state.
- **Assigned** (`assigned: true`): explicitly typed by the user — rendered with full color,
  including explicit "blocked" cells (solid red, not hatch).

### 5.4 Node Types & Subtypes

| Node Type   | Color       | Sample Subtypes                                          |
|-------------|-------------|----------------------------------------------------------|
| traversable | #0ea5e9     | aisle, corridor, cross_aisle, staging                    |
| path        | #4a5568     | (internal: cells painted by draw tool)                   |
| source      | #22c55e     | pick, feeder, induction, load, buffer, conveyor_in       |
| destination | #3b82f6     | drop, put, delivery, output, deposit, conveyor_out, bin  |
| charging    | #f59e0b     | fast_charge, slow_charge, opportunity, wireless          |
| parking     | #a855f7     | idle, maintenance, emergency, service, buffer            |
| blocked     | #ef4444     | wall, pillar, equipment, no_go_zone                      |
| junction    | #06b6d4     | merge, diverge, crossover, roundabout                    |

Each node type also supports a free-form custom subtype and a display label.

### 5.5 Layers
- 8 default layers (one per node type), each togglable for visibility
- Layer panel shows cell count for each type (only assigned cells counted)
- "Typed cells" stat shows total assigned cells across all types
- Layer info tooltips (ⓘ) explain each layer's purpose

### 5.6 Canvas & Viewport
- Pan: middle-mouse drag or two-finger drag
- Zoom: scroll wheel or pinch; zoom range 0.05–10×
- Dark/light theme toggle (☾/☀) — affects all pane colors and canvas background
- Coordinate labels on cells (togglable, appear above a zoom threshold)
- Cell type labels (P, S, D…) in top-left corner of each cell (togglable)
- Canvas background isolates from pane background for visual clarity

### 5.7 Validation & Path Tools
- Connectivity check: multi-source BFS from all source cells, reports:
  - Unreachable destination cells
  - Unreachable source cells (isolated from other sources via lane network)
  - Unreachable charging cells
  - Unreachable parking cells
  - Total unreachable cell count
- Unreachable cells highlighted in red on canvas
- Path preview (P tool): BFS shortest path between any two cells, shown as blue overlay
- Trace animation: animates robot traversal of all source→destination routes simultaneously,
  with configurable speed (1–10×), start/end cell highlighting, and route legend

### 5.8 Export
- **PNG export**: full-resolution snapshot of the canvas
- **CAD export**: annotated PNG with dimension anchors and 1-indexed coordinate labels
- **Custom JSON/YAML export** (v0.19):
  - Format: JSON or YAML (custom hand-rolled serializer, no third-party deps)
  - Coordinate origin: 0-indexed or 1-indexed
  - Excludes unassigned cells (opt-in: "exclude default blocked")
  - Configurable field names via presets or manual override:
    - `naxa` preset: nodeType, row, col, from, to
    - `ros2` preset: type, y, x, source, target
    - `amr` preset: node_type, row, col, from_node, to_node
  - Optional sections: config block, layers list
  - Includes subtype, label, metadata, cost per cell/edge

### 5.9 Persistence
- Save maps to FastAPI backend → PostgreSQL (primary)
- localStorage fallback when backend is unreachable (offline mode)
- Load saved maps via Load button in the layer panel sidebar

### 5.10 Map Operations
- Reset Map (↺ Reset): clears all cells and lanes, restores unassigned state (with undo history preserved)
- Reset Lanes (↺ Lanes): clears only edges
- Reset All (↺ All): equivalent to Reset Map

---

## 6. Technical Limits

| Parameter             | Limit / Default                 | Notes                                         |
|-----------------------|---------------------------------|-----------------------------------------------|
| Grid size             | 3×3 min, 1000×1000 max         | Perf warning at >10,000 cells                 |
| Undo history          | 50 steps                        | Oldest entry dropped when limit reached       |
| Cell size             | 0.1–10 m/cell                   | Independent W and H for rectangle shape       |
| Hex circumradius      | 0.1–10 m                        | Center-to-vertex                              |
| Cell shapes           | square, rectangle, hexagon      |                                               |
| Edge directions       | N NE E SE S SW W NW             | Hex only uses 6 of the 8                     |
| Edge cost             | float (optional)                | Defaults to 1.0 if omitted                   |
| Trace speed           | 1–10 cells/second               |                                               |
| Max concurrent traces | All source→destination pairs    | Rendered simultaneously                       |
| Backend timeout       | 500 ms target (load/save)       |                                               |

---

## 7. Data Model

### GridMap
```json
{
  "id": "uuid",
  "schemaVersion": 2,
  "name": "Warehouse Floor A",
  "createdAt": "2026-06-14T00:00:00Z",
  "updatedAt": "2026-06-14T00:00:00Z",
  "config": {
    "rows": 20,
    "cols": 30,
    "cellShape": "square",
    "cellSizeMeters": 0.5,
    "cellHeightMeters": 0.4
  },
  "cells": [],
  "edges": [],
  "layers": []
}
```

### GridCell
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "coord": { "row": 3, "col": 7 },
  "nodeType": "source",
  "assigned": true,
  "subtype": "feeder",
  "label": "Feeder Line 1",
  "metadata": { "zone": "A", "priority": 2 }
}
```

- `assigned: false` (or absent) = unassigned/default cell — not explicitly typed by user
- `assigned: true` = explicitly typed — rendered with full color regardless of nodeType

### Edge
```json
{
  "id": "e_550e8400-e29b-41d4-a716-446655440000_a24c6f8a-c9e1-4d2b-9b9a-123456789abc",
  "from": "550e8400-e29b-41d4-a716-446655440000",
  "to": "a24c6f8a-c9e1-4d2b-9b9a-123456789abc",
  "direction": "E",
  "bidirectional": false,
  "cost": 1.0
}
```

---

## 8. API Endpoints

| Method | Path           | Description                                          |
|--------|----------------|------------------------------------------------------|
| GET    | /api/maps      | List maps (cursor-paginated — see below)             |
| POST   | /api/maps      | Create new map                                       |
| GET    | /api/maps/{id} | Get map by ID                                        |
| PATCH  | /api/maps/{id} | Update map                                           |
| DELETE | /api/maps/{id} | Delete map                                           |
| GET    | /health        | Health check                                         |

### GET /api/maps — Cursor-based pagination (v0.19)

Query parameters:

| Param    | Default | Description                                          |
|----------|---------|------------------------------------------------------|
| `limit`  | 50      | Max items to return (1–200)                          |
| `cursor` | —       | Opaque cursor token from previous `X-Next-Cursor`   |

Response header:
- `X-Next-Cursor: <token>` — present when more pages exist; omitted on last page.
  Pass this as `cursor=` on the next request.

Sort order: `updated_at DESC, id ASC` (most recently modified first).

---

## 9. UI Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [D Draw][T Type][E Erase][S Select][F Fill][P Path] | [↩][↪] | [▶ Trace]   │
│ [Validate][Export][PNG][CAD][Coords][Labels][☾ Dark][↺ Reset][Save]         │
├─────────────────────────┬────────────────────────────────────────────────────┤
│                         │                                                    │
│  naxa                   │         Canvas (Konva Stage)                      │
│  grid map editor        │                                                    │
│  ─────────────────      │   [interactive grid cells]                        │
│  LAYERS                 │   [directional arrows on edges]                   │
│  ○ Traversable   (N)    │   [color-coded cell fills]                        │
│  ○ Lanes         (N)    │   [hatch = unassigned cells]                      │
│  ○ Sources       (N) ⓘ │   [BFS path overlay]                              │
│  ○ Destinations  (N) ⓘ │   [trace animation dots]                          │
│  ○ Charging      (N) ⓘ │                                                    │
│  ○ Parking       (N) ⓘ │                                                    │
│  ○ Blocked       (N) ⓘ │                                                    │
│  ○ Junctions     (N) ⓘ │                                                    │
│  ─────────────────      │                                                    │
│  CELL INFO (on select)  │                                                    │
│  ─────────────────      │                                                    │
│  STATS                  │                                                    │
│  Typed: N               │                                                    │
│  Lanes: N               │                                                    │
│  Scale: 0.5m/cell       │                                                    │
│  Area: N m²             │                                                    │
│  ─────────────────      │                                                    │
│  [Load] [+ New Map]     │                                                    │
│                         │                                                    │
│  D Draw · T Type · ...  │                                                    │
└─────────────────────────┴────────────────────────────────────────────────────┘
```

---

## 10. Roadmap

| Version | Target Feature                                                    | Status       |
|---------|-------------------------------------------------------------------|--------------|
| v0.1    | Core canvas, lanes, node types, undo/redo, JSON export, API       | Done         |
| v0.11–0.17 | Hex support, validation, trace, themes, CAD export, perf     | Done         |
| v0.18   | Custom JSON/YAML export with field name presets                   | Done         |
| v0.19   | UUID cell IDs, `path` NodeType, schema migration pipeline, CanvasOverlay/ErrorBoundary, viewport culling, API pagination, Alembic | Done |
| v0.2    | JWT auth, user accounts, map ownership, shareable read-only links | Next         |
| v0.21   | Soft delete, backend coverage target, grid resize                 | Planned      |
| v0.3    | ROS 2 / nav2 costmap export (pgm + yaml)                         | Planned      |
| v0.4    | VDA5050-compatible graph export for AMR fleets                    | Planned      |
| v0.5    | React Native mobile app (iOS + Android)                           | Planned      |
| v1.0    | Real-time collaboration, robot telemetry overlay                  | Future       |

---

## 11. Success Metrics

- A user can create and export a 20×20 map in under 5 minutes
- Graph validation catches 100% of disconnected node scenarios
- Map save/load round-trip completes in < 500 ms
- All lib/ and store/ code maintains 100% test coverage
- Grid up to 50×50 renders and responds to input within 100 ms
