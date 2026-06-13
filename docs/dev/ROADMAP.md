# Roadmap — Naxa

**Last updated:** 2026-06-14
**Current version:** 0.19.0

Legend: ✅ Done · 🔜 Next · 📋 Planned · 🔮 Future · ⚠ Concern flagged

---

## Completed

| Version    | Summary                                                      | Date       |
|------------|--------------------------------------------------------------|------------|
| v0.1       | Core canvas, API, Docker, tests                              | 2026-02-26 |
| v0.11–0.17 | Hex, validation, trace, CAD, themes, perf, rect height       | 2026-02-27 |
| v0.18      | Custom JSON/YAML export modal with field presets             | 2026-06-14 |
| v0.19      | UUID cell IDs, `path` NodeType, schema migration pipeline, CanvasOverlay/ErrorBoundary, viewport culling, API pagination, Alembic | 2026-06-14 |

---

## 🔜 v0.2 — Authentication & Ownership

**Goal:** Make maps ownable and shareable. Required before any public deployment.

### Features
- [ ] JWT authentication (register / login / refresh)
- [ ] Map ownership: each map belongs to a user
- [ ] Row-level access: users can only edit/delete their own maps
- [ ] Shareable read-only links (UUID-based, no auth required to view)
- [ ] Map list shows only own maps (+ optionally shared maps)

### Technical work
- [ ] Add `users` table (SQLModel), password hashing (bcrypt)
- [ ] `POST /api/auth/register`, `POST /api/auth/login` endpoints
- [ ] JWT middleware on protected routes
- [ ] Add `owner_id` FK to `grid_maps` table
- [ ] Alembic migrations setup (first real migration: add owner_id)
- [ ] Frontend: login/register modal, auth token in localStorage, logout

### ⚠ Concerns
- **Alembic not yet wired up.** Currently schema is created via SQLModel's
  `create_db_and_tables()` at startup — fine for dev, not for prod schema evolution.
  Must add Alembic before v0.2 ships to avoid destructive schema changes.
- **No email verification.** v0.2 will use username+password only; no email flow.
  This is acceptable for internal/demo use but must be noted.
- **Session invalidation.** JWTs are stateless — no server-side revocation.
  For v0.2 short-lived access tokens (15 min) + refresh tokens stored in DB is recommended.

---

## 📋 v0.21 — Data Integrity & Ownership Prep

- [ ] First Alembic migration: add `owner_id` column (prerequisite for v0.2 auth)
- [ ] Soft delete for maps (`deleted_at` timestamp)
- [ ] Backend test coverage target: 80%+
- [ ] JSONB blob validator: reads all maps and checks schema version on deploy

### ⚠ Concerns
- **JSONB blob evolution.** If `GridCell` or `Edge` structure changes in a way
  that's incompatible with existing blobs, old maps will silently fail to load.
  A migration validator (reads all maps and checks schema) should run as part of deploy.

---

## 📋 v0.3 — ROS 2 / nav2 Export

**Goal:** Export maps in formats directly consumable by ROS 2 nav stacks.

- [ ] PGM + YAML costmap export (nav2 `map_server` format)
  - PGM: occupancy grid (0=free, 254=occupied, 205=unknown)
  - YAML: resolution, origin, negate, occupied_thresh, free_thresh
- [ ] YAML graph export using ros2 field preset (already available — just expose as named export)
- [ ] Optional: nav2 `BehaviorTree.xml` skeleton for route following

### ⚠ Concerns
- **Coordinate system mismatch.** nav2 uses a right-handed coordinate system with Y pointing
  up; the editor uses row (top-to-bottom) + col (left-to-right). Export must flip Y axis.
- **Resolution.** PGM pixel = 1 cell; `resolution` in YAML = `cellSizeMeters`.
  For large maps (>1000×1000) generating a PGM in-browser will be memory-intensive.
- **Hexagonal grids can't be exported to PGM.** ROS 2 costmaps are rectangular-only.
  Add a UI warning when hex map is loaded and user tries ROS export.

---

## 📋 v0.4 — VDA5050 Export

**Goal:** Export lane graphs in VDA5050 AGV interface protocol format (JSON).

- [ ] VDA5050 `NodePosition`, `Edge`, `Action` schema mapping
- [ ] Node ID assignment (VDA5050 uses string names, not coordinates)
- [ ] Map coordinate → floor plan coordinate transform
- [ ] Export modal preset: "VDA5050"

### ⚠ Concerns
- **VDA5050 nodes need semantic names** (e.g., `WS_01`, `CS_A`), not coordinate IDs.
  Current cell labels (free-form string) can map to this, but all assigned cells would
  need labels for a complete VDA5050 export. UI guidance needed.
- **VDA5050 version:** The standard has v1.1 and v2.0. Target v2.0.

---

## 📋 v0.5 — React Native Mobile App

- [ ] New package `apps/mobile` (React Native + Expo)
- [ ] Shared `@naxa/core` types (already works — pure TypeScript)
- [ ] Gesture-based pan/zoom (Reanimated + GestureHandler)
- [ ] Canvas: react-native-skia (replaces Konva)
- [ ] Offline-first: SQLite on device, sync to API when online

### ⚠ Concerns
- **Konva is web-only.** The entire rendering layer must be rebuilt for React Native.
  `@naxa/core` types are reusable, but all of `GridCanvas.tsx` logic must be re-implemented
  with Skia primitives. Estimate: significant effort.
- **Touch precision on mobile.** Lane drawing requires selecting a start cell and drag
  direction — needs a snap-to-grid mechanism to work reliably on touch.

---

## 🔮 v1.0 — Collaboration & Telemetry

- [ ] Real-time multi-user editing (WebSocket-based CRDT or OT)
- [ ] Robot telemetry overlay (live position dots from fleet API)
- [ ] Map versioning / history browser
- [ ] Comments / annotations on cells

---

## Unscheduled Backlog

These are confirmed needs without a version slot yet:

| Item                           | Priority | Notes                                                         |
|--------------------------------|----------|---------------------------------------------------------------|
| Grid resize (post-creation)    | High     | Currently requires new map; all work lost on size change      |
| Import from JSON/YAML          | High     | Users want to load existing nav graphs, not just export       |
| Copy-paste cell regions        | Medium   | Select tool is ready; paste needs coord-offset logic          |
| Undo for label edits           | Low      | Currently intentionally skipped; can add opt-in               |
| Multi-floor / building view    | Low      | Floor switcher in sidebar; separate GridMap per floor         |
| DXF/CAD import                 | Low      | Parse floor plan outlines as blocked cells                    |
| Cell metadata editor           | Medium   | `metadata: Record<string, unknown>` exists but no UI          |

---

## Architecture Concerns (Forward-Looking)

### 1. GridCanvas.tsx size
**Status:** Overlay components extracted to `CanvasOverlay.tsx` (v0.19). File is now ~500 lines.
**Remaining:** `EdgeLayer` and trace animation loop still inline.
**Recommendation:** Extract `EdgeLayer` as a separate file when edge rendering grows more complex.

### 2. Cell ID coupling to coordinates — ✅ Resolved (v0.19)
Cell IDs are now UUID v4 (`crypto.randomUUID()`). Grid resize and copy-paste no longer
have an ID-collision blocker. Old maps in JSONB keep their coord-derived IDs until re-saved.

### 3. No API pagination — ✅ Resolved (v0.19)
`GET /api/maps` now supports cursor-based pagination (`limit` + `cursor` params, `X-Next-Cursor` header).

### 4. JSONB blob validation on load
**Status:** `migrateMap()` pipeline in `loadMap` (v0.19) handles schema versioning.
`CURRENT_SCHEMA_VERSION = 2`; v1→v2 adds `assigned` field.
**Risk:** Future field additions need a corresponding migration pass added to `migrateMap`.
**Recommendation:** Add a deploy-time validator (reads all maps, checks schema version) in v0.21.

### 5. `lane` NodeType naming confusion — ✅ Resolved (v0.19)
`NodeType 'lane'` renamed to `'path'` throughout the codebase.

### 6. Performance ceiling for large grids — ✅ Partially resolved (v0.19)
Viewport culling added: `visibleCells` filters to current viewport bounds (debounced 100ms).
Pan/zoom no longer renders off-screen cells. Initial render at 1M cells is still untested.

### 7. No error boundary on canvas — ✅ Resolved (v0.19)
`CanvasErrorBoundary` class component wraps `GridCanvas` in `App.tsx`.
Shows "Canvas error — Retry" fallback on any thrown error.
