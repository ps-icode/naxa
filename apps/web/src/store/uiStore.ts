import { create } from 'zustand'
import type { NodeType } from '@naxa/core'

export type Tool = 'draw' | 'type' | 'erase' | 'path'

export interface TraceRoute {
  pathIds: string[]
  color: string
  label: string  // e.g. "S1→D2"
}

interface UIStore {
  tool: Tool
  activeNodeType: NodeType
  selectedEdgeId: string | null
  selectedCellId: string | null
  pathStart: string | null
  pathEnd: string | null
  pathResult: string[] | null
  zoom: number
  pan: { x: number; y: number }
  showNewMapModal: boolean
  validationResult: { unreachable: string[] } | null
  toast: { message: string; type: 'success' | 'error' } | null
  // Trace animation
  traceRoutes: TraceRoute[]
  traceRunning: boolean
  traceSpeed: number   // cells per second (1–10)

  setTool: (tool: Tool) => void
  setActiveNodeType: (t: NodeType) => void
  selectEdge: (id: string | null) => void
  setSelectedCellId: (id: string | null) => void
  setPathPoint: (cellId: string) => void
  clearPath: () => void
  setZoom: (z: number) => void
  setPan: (p: { x: number; y: number }) => void
  setShowNewMapModal: (v: boolean) => void
  setValidationResult: (r: { unreachable: string[] } | null) => void
  setPathResult: (p: string[] | null) => void
  showToast: (message: string, type?: 'success' | 'error') => void
  clearToast: () => void
  setTraceRoutes: (routes: TraceRoute[]) => void
  setTraceRunning: (v: boolean) => void
  setTraceSpeed: (v: number) => void
  showCellCoords: boolean
  toggleCellCoords: () => void
}

export const useUIStore = create<UIStore>((set) => ({
  tool: 'draw',
  activeNodeType: 'lane',
  selectedEdgeId: null,
  selectedCellId: null,
  pathStart: null,
  pathEnd: null,
  pathResult: null,
  zoom: 1,
  pan: { x: 40, y: 40 },
  showNewMapModal: false,
  validationResult: null,
  toast: null,
  traceRoutes: [],
  traceRunning: false,
  traceSpeed: 3,
  showCellCoords: false,

  setTool: (tool) =>
    set({ tool, selectedEdgeId: null, pathStart: null, pathEnd: null, pathResult: null, traceRunning: false }),
  setActiveNodeType: (activeNodeType) => set({ activeNodeType }),
  selectEdge: (selectedEdgeId) => set({ selectedEdgeId }),
  setSelectedCellId: (selectedCellId) => set({ selectedCellId }),

  // First click: sets start. Second click on same cell: clears start (toggle).
  // Second click on different cell: sets end and triggers path computation via effect.
  setPathPoint: (cellId) =>
    set((s) => {
      if (!s.pathStart) return { pathStart: cellId, pathEnd: null, pathResult: null }
      if (s.pathStart === cellId) return { pathStart: null, pathEnd: null, pathResult: null }
      return { pathEnd: cellId }
    }),

  clearPath: () => set({ pathStart: null, pathEnd: null, pathResult: null }),
  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),
  setShowNewMapModal: (showNewMapModal) => set({ showNewMapModal }),
  setValidationResult: (validationResult) => set({ validationResult }),
  setPathResult: (pathResult) => set({ pathResult }),

  // Side effect: auto-dismisses the toast after 3.5 s via setTimeout.
  showToast: (message, type = 'success') => {
    set({ toast: { message, type } })
    setTimeout(() => set({ toast: null }), 3500)
  },
  clearToast: () => set({ toast: null }),

  setTraceRoutes: (traceRoutes) => set({ traceRoutes }),
  setTraceRunning: (traceRunning) => set({ traceRunning }),
  setTraceSpeed: (traceSpeed) => set({ traceSpeed }),
  toggleCellCoords: () => set(s => ({ showCellCoords: !s.showCellCoords })),
}))
