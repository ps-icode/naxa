# Product Requirements Document — Naxa

**Version:** 0.1.0
**Status:** Draft
**Last updated:** 2026-02-26

---

## 1. Overview

Naxa is a browser-based, touch-friendly grid map editor for designing navigable floor
plans used by autonomous mobile robots (AMRs) and grid-based navigation systems. It
enables operators and system integrators to visually define navigation graphs — nodes
(cells) and directed edges (lanes) — without writing code.

---

## 2. Problem Statement

Designing navigation graphs for AMR systems typically requires either:
- Writing JSON or YAML by hand (error-prone, non-visual), or
- Using expensive, proprietary fleet management software.

Naxa fills this gap: a lightweight, gamified tool that lets anyone draw a navigation
map as intuitively as sketching on a whiteboard.

---

## 3. Goals

| Goal                  | Description                                                           |
|-----------------------|-----------------------------------------------------------------------|
| Visual map creation   | Draw and edit grid maps without coding                                |
| Semantic layering     | Node types separated into togglable layers                            |
| Graph export          | Export as structured JSON usable in any nav system                    |
| Touch-first UX        | Designed for tablets; works on desktop                                |
| Real-world scale      | Calibrate maps to real-world dimensions (meters per cell)             |

---

## 4. Non-Goals (v0.1)

- User authentication / multi-user collaboration
- 3D or elevation-aware maps
- ROS 2 / nav2 direct integration (planned v0.3)
- VDA5050 fleet protocol export (planned v0.4)
- Mobile native app (planned v0.5)
- Real-time robot telemetry overlay

---

## 5. User Stories

### 5.1 Map Setup
- As a user, I can create a new map with a name, grid type (square / rectangle / hexagon),
  dimensions (rows × cols), and real-world cell size (e.g., 0.5 m).
- As a user, I can load and edit a previously saved map.

### 5.2 Lane Drawing
- As a user, I can swipe across adjacent cells to create a directional lane (edge).
- As a user, the swipe direction determines the edge direction (visualized with an arrow).
- As a user, I can tap an edge to toggle one-way / bidirectional.
- As a user, I can delete a lane by selecting and pressing delete / backspace.

### 5.3 Node Types & Layers
- As a user, I can assign a semantic type to a cell: source, destination, charging,
  parking, blocked, or junction.
- As a user, I can toggle layer visibility to focus on one type at a time.
- As a user, cells are color-coded by type.

### 5.4 Canvas Navigation
- As a user, I can pinch-to-zoom and drag to pan the canvas.
- As a user, I can undo and redo any edit (Ctrl/Cmd+Z / Shift+Ctrl/Cmd+Z).

### 5.5 Validation & Path Preview
- As a user, I can run a connectivity check to identify unreachable cells.
- As a user, I can click two cells to preview the A* shortest path between them.

### 5.6 Save & Export
- As a user, I can save my map to the server (persisted in PostgreSQL).
- As a user, I can export my map as:
  - JSON graph (nodes + edges with directions and costs)
  - PNG top-view image

---

## 6. UI Layout

```
┌───────────────────────────────────────────────────────────────┐
│  [Grid type ▾]  [Tool: draw | select | erase]  [Undo] [Redo]  │
│  [Validate]  [Export ▾]  [Scale: 0.5m/cell]                   │
├─────────────────┬─────────────────────────────────────────────┤
│                 │                                             │
│  Layers         │         Canvas (Konva Stage)               │
│  ──────         │                                             │
│  ○ Lanes        │   [interactive grid cells]                 │
│  ○ Sources      │   [directional arrows on edges]            │
│  ○ Destinations │   [color-coded node types]                 │
│  ○ Charging     │                                             │
│  ○ Parking      │                                             │
│  ○ Blocked      │                                             │
│  ○ Junctions    │                                             │
│                 │                                             │
│  [+ New Map]    │                                             │
│  [Saved Maps]   │                                             │
└─────────────────┴─────────────────────────────────────────────┘
```

### Cell Color Coding

| Node Type   | Color              |
|-------------|--------------------|
| Lane        | #4a5568 (gray)     |
| Source      | #48bb78 (green)    |
| Destination | #4299e1 (blue)     |
| Charging    | #f6ad55 (amber)    |
| Parking     | #9f7aea (purple)   |
| Blocked     | #fc8181 (red)      |
| Junction    | #76e4f7 (cyan)     |

---

## 7. Data Model

### GridMap
```json
{
  "id": "uuid",
  "name": "Warehouse Floor A",
  "createdAt": "2026-02-26T00:00:00Z",
  "updatedAt": "2026-02-26T00:00:00Z",
  "config": {
    "rows": 20,
    "cols": 30,
    "cellShape": "square",
    "cellSizeMeters": 0.5
  },
  "cells": [],
  "edges": [],
  "layers": []
}
```

### Cell
```json
{
  "id": "r0c0",
  "coord": { "row": 0, "col": 0 },
  "nodeType": "source",
  "label": "Pick Station 1"
}
```

### Edge
```json
{
  "id": "e_r0c0_r0c1",
  "from": "r0c0",
  "to": "r0c1",
  "direction": "E",
  "bidirectional": false,
  "cost": 1.0
}
```

---

## 8. API Endpoints (v0.1)

| Method | Path           | Description         |
|--------|----------------|---------------------|
| GET    | /api/maps      | List all maps       |
| POST   | /api/maps      | Create new map      |
| GET    | /api/maps/{id} | Get map by ID       |
| PATCH  | /api/maps/{id} | Update map          |
| DELETE | /api/maps/{id} | Delete map          |
| GET    | /health        | Health check        |

---

## 9. Future Roadmap

| Version | Feature                                              |
|---------|------------------------------------------------------|
| v0.2    | User auth (JWT), shareable map links                 |
| v0.3    | ROS 2 / nav2 costmap export                          |
| v0.4    | VDA5050-compatible graph export for AMR fleets       |
| v0.5    | React Native mobile app (iOS + Android)              |
| v1.0    | Real-time collaboration, robot telemetry overlay     |

---

## 10. Success Metrics

- A user can create and export a 20×20 map in under 5 minutes
- Graph validation catches 100% of disconnected node scenarios
- Map save/load round-trip completes in < 500 ms
