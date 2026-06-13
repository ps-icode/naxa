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
| v0.19      | assigned semantics, fill fix, labels, reset, keyboard fix    | 2026-06-14 |

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

## 📋 v0.21 — Schema Migrations & Data Integrity

- [ ] Alembic configured and migration history established
- [ ] First migration: add `owner_id` column
- [ ] Soft delete for maps (`deleted_at` timestamp)
- [ ] Pagination on `GET /api/maps` (cursor-based)
- [ ] Backend test coverage target: 80%+

### ⚠ Concerns
- **No migration safety net now.** If `GridCell` or `Edge` structure changes in a way
  that's incompatible with existing JSONB blobs, old maps will silently fail to load.
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
**Status:** ~600 lines and growing.
**Risk:** Becoming hard to maintain. Each new tool adds pointer-handler branches.
**Recommendation:** Extract `TraceOverlay`, `SelectionRect`, `ValidationOverlay`,
and `PathOverlay` as separate Konva-Layer-backed components before v0.3.

### 2. Cell ID coupling to coordinates
**Status:** `id = r{row}c{col}` — generated once, never changes.
**Risk:** If grid resize is added, cells shifted in position would get new IDs,
breaking any saved edge references.
**Recommendation:** Before implementing grid resize, decouple cell IDs from coords.
Generate UUIDs at cell creation (like edges already have `e_{from}_{to}`).
This is a breaking data change requiring a migration.

### 3. No API pagination
**Status:** `GET /api/maps` returns all maps in one response.
**Risk:** Slow at scale; out of memory for large deployments.
**Recommendation:** Add cursor-based pagination in v0.21 before user growth.

### 4. JSONB blob validation on load
**Status:** Old maps loaded by `normaliseCells()` get `assigned` normalised.
**Risk:** Future field additions (e.g., `priority`, `weight` on edges) won't be normalised
unless a similar function is added. Silent data inconsistency possible.
**Recommendation:** Create a `validateAndMigrateMap(map)` pipeline in `loadMap`
that all normalisation passes through, with a version field on GridMap.

### 5. `lane` NodeType naming confusion
**Status:** `'lane'` is a NodeType on cells (painted by Draw tool), but "lane" colloquially
refers to edges (the directional arrows). This confuses new contributors.
**Recommendation:** Consider renaming `NodeType 'lane'` to `'path'` or `'corridor'`
in a future version. Requires data migration + UI update.

### 6. Performance ceiling for large grids
**Status:** UI allows 1000×1000 (1M cells). Tests only go to 100×100 (10K cells).
**Risk:** Konva renders all cells on every frame. At 1M cells, initial render and
any zoom/pan would be unusably slow.
**Recommendation:** For grids >50×50, implement viewport culling — only render
cells visible within the current viewport bounds. This is a significant canvas
refactor but necessary before v0.3 for warehouse-scale maps.

### 7. No error boundary on canvas
**Status:** If `GridCanvas` throws (Konva error, null deref), the entire app crashes.
**Recommendation:** Wrap `GridCanvas` in a React `ErrorBoundary` that shows a
"Canvas error — please reload" fallback and reports the error.
