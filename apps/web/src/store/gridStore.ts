import { create } from 'zustand'
import type { GridMap, GridCell, Edge, NodeType, Direction, GridConfig } from '@naxa/core'
import { DEFAULT_LAYERS } from '@naxa/core'

function makeCellId(row: number, col: number): string {
  return `r${row}c${col}`
}

function initCells(config: GridConfig): GridCell[] {
  const cells: GridCell[] = []
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      cells.push({ id: makeCellId(row, col), coord: { row, col }, nodeType: 'lane' })
    }
  }
  return cells
}

// Caps history at 50 entries (slice(-49) + new = 50 max).
// Clears future on every new action — standard linear undo model.
// Callers always guard !s.map before calling snap(), so state.map is non-null here.
function snap(state: GridStore): Pick<GridStore, 'past' | 'future'> {
  return {
    past: [...state.past.slice(-49), structuredClone(state.map!)],
    future: [],
  }
}

interface GridStore {
  map: GridMap | null
  past: GridMap[]
  future: GridMap[]
  savedList: Array<{ id: string; name: string; updatedAt: string }>

  newMap: (name: string, config: GridConfig) => void
  loadMap: (map: GridMap) => void
  clearMap: () => void
  updateMapName: (name: string) => void
  setSavedList: (list: Array<{ id: string; name: string; updatedAt: string }>) => void

  setCellType: (cellId: string, nodeType: NodeType) => void
  setCellTypeBatch: (updates: Array<{ id: string; nodeType: NodeType }>) => void
  setCellSubtype: (cellId: string, subtype: string | undefined) => void
  setCellLabel: (cellId: string, label: string | undefined) => void
  snapshotNow: () => void

  addEdge: (fromId: string, toId: string, direction: Direction) => void
  removeEdge: (edgeId: string) => void
  toggleEdgeBidirectional: (edgeId: string) => void
  clearEdges: () => void
  resetCells: () => void
  toggleLayerVisibility: (layerId: string) => void

  undo: () => void
  redo: () => void
}

export const useGridStore = create<GridStore>((set, _get) => ({
  map: null,
  past: [],
  future: [],
  savedList: [],

  newMap: (name, config) =>
    set({
      map: {
        id: crypto.randomUUID(),
        name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        config,
        cells: initCells(config),
        edges: [],
        layers: DEFAULT_LAYERS.map(l => ({ ...l })),
      },
      past: [],
      future: [],
    }),

  loadMap: (map) => set({ map, past: [], future: [] }),
  clearMap: () => set({ map: null, past: [], future: [] }),
  updateMapName: (name) => set((s) => (s.map ? { map: { ...s.map, name } } : {})),
  setSavedList: (savedList) => set({ savedList }),

  snapshotNow: () =>
    set((s) => s.map
      ? { past: [...s.past.slice(-49), structuredClone(s.map)], future: [] }
      : {}),

  setCellType: (id, nodeType) =>
    set((s) => {
      if (!s.map) return {}
      return {
        ...snap(s),
        map: {
          ...s.map,
          updatedAt: new Date().toISOString(),
          cells: s.map.cells.map(c => c.id === id ? { ...c, nodeType, subtype: undefined } : c),
        },
      }
    }),

  // No snapshot — caller must call snapshotNow() once at the start of a paint stroke,
  // then stream batch updates through this action for the duration of the stroke.
  setCellTypeBatch: (updates) =>
    set((s) => {
      if (!s.map || updates.length === 0) return {}
      const paintMap = new Map(updates.map(u => [u.id, u.nodeType]))
      return {
        map: {
          ...s.map,
          updatedAt: new Date().toISOString(),
          cells: s.map.cells.map(c => {
            const nt = paintMap.get(c.id)
            return nt !== undefined ? { ...c, nodeType: nt, subtype: undefined } : c
          }),
        },
      }
    }),

  setCellSubtype: (id, subtype) =>
    set((s) => {
      if (!s.map) return {}
      return {
        ...snap(s),
        map: {
          ...s.map,
          updatedAt: new Date().toISOString(),
          cells: s.map.cells.map(c => c.id === id ? { ...c, subtype } : c),
        },
      }
    }),

  // Intentionally skips snapshot — label edits are not undo-tracked.
  setCellLabel: (id, label) =>
    set((s) => {
      if (!s.map) return {}
      return {
        map: {
          ...s.map,
          updatedAt: new Date().toISOString(),
          cells: s.map.cells.map(c => c.id === id ? { ...c, label } : c),
        },
      }
    }),

  addEdge: (fromId, toId, direction) =>
    set((s) => {
      if (!s.map) return {}
      if (s.map.edges.find(e => e.from === fromId && e.to === toId)) return {}
      const edge: Edge = { id: `e_${fromId}_${toId}`, from: fromId, to: toId, direction, bidirectional: false, cost: 1 }
      return {
        ...snap(s),
        map: { ...s.map, updatedAt: new Date().toISOString(), edges: [...s.map.edges, edge] },
      }
    }),

  removeEdge: (edgeId) =>
    set((s) => {
      if (!s.map) return {}
      return {
        ...snap(s),
        map: { ...s.map, updatedAt: new Date().toISOString(), edges: s.map.edges.filter(e => e.id !== edgeId) },
      }
    }),

  toggleEdgeBidirectional: (edgeId) =>
    set((s) => {
      if (!s.map) return {}
      return {
        ...snap(s),
        map: {
          ...s.map,
          updatedAt: new Date().toISOString(),
          edges: s.map.edges.map(e => e.id === edgeId ? { ...e, bidirectional: !e.bidirectional } : e),
        },
      }
    }),

  clearEdges: () =>
    set((s) => {
      if (!s.map) return {}
      return { ...snap(s), map: { ...s.map, updatedAt: new Date().toISOString(), edges: [] } }
    }),

  resetCells: () =>
    set((s) => {
      if (!s.map) return {}
      return {
        ...snap(s),
        map: {
          ...s.map,
          updatedAt: new Date().toISOString(),
          cells: s.map.cells.map(c => ({ ...c, nodeType: 'lane' as NodeType, subtype: undefined, label: undefined })),
          edges: [],
        },
      }
    }),

  toggleLayerVisibility: (layerId) =>
    set((s) => {
      if (!s.map) return {}
      return { map: { ...s.map, layers: s.map.layers.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l) } }
    }),

  undo: () =>
    set((s) => {
      if (!s.map || s.past.length === 0) return {}
      const prev = s.past[s.past.length - 1]
      return { map: prev, past: s.past.slice(0, -1), future: [structuredClone(s.map), ...s.future.slice(0, 49)] }
    }),

  redo: () =>
    set((s) => {
      if (!s.map || s.future.length === 0) return {}
      const next = s.future[0]
      return { map: next, past: [...s.past.slice(-49), structuredClone(s.map)], future: s.future.slice(1) }
    }),
}))
