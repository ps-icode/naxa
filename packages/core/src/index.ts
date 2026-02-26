// ── Primitive types ────────────────────────────────────────────────────────────

export type CellShape = 'square' | 'rectangle' | 'hexagon'

export type NodeType =
  | 'lane'
  | 'source'
  | 'destination'
  | 'charging'
  | 'parking'
  | 'blocked'
  | 'junction'

export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

// ── Subtypes (inspired by VDA5050, MiR, Locus, Geek+, Fetch, OTTO) ────────────

export const SUBTYPES: Record<NodeType, string[]> = {
  lane:        [],
  source:      ['pick', 'feeder', 'induction', 'load', 'input', 'buffer', 'conveyor_in', 'collection', 'custom'],
  destination: ['drop', 'put', 'delivery', 'output', 'unload', 'deposit', 'conveyor_out', 'bin', 'custom'],
  charging:    ['fast_charge', 'slow_charge', 'opportunity', 'wireless', 'custom'],
  parking:     ['idle', 'maintenance', 'emergency', 'service', 'buffer', 'custom'],
  blocked:     ['wall', 'pillar', 'equipment', 'no_go_zone', 'custom'],
  junction:    ['merge', 'diverge', 'crossover', 'roundabout', 'custom'],
}

// ── Geometry ───────────────────────────────────────────────────────────────────

export interface CellCoord {
  row: number
  col: number
}

// ── Domain entities ────────────────────────────────────────────────────────────

export interface GridCell {
  id: string
  coord: CellCoord
  nodeType: NodeType
  subtype?: string   // e.g. 'feeder', 'bin_1', 'fast_charge', or any custom name
  label?: string     // free-form display label (shown inside the cell)
  metadata?: Record<string, unknown>
}

export interface Edge {
  id: string
  from: string
  to: string
  direction: Direction
  bidirectional: boolean
  cost?: number
}

export interface Layer {
  id: string
  name: string
  nodeType: NodeType
  visible: boolean
  color: string
}

export interface GridConfig {
  rows: number
  cols: number
  cellShape: CellShape
  cellSizeMeters: number
}

export interface GridMap {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  config: GridConfig
  cells: GridCell[]
  edges: Edge[]
  layers: Layer[]
}

// ── Constants ──────────────────────────────────────────────────────────────────

export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  lane:        '#4a5568',
  source:      '#22c55e',
  destination: '#3b82f6',
  charging:    '#f59e0b',
  parking:     '#a855f7',
  blocked:     '#ef4444',
  junction:    '#06b6d4',
}

export const DEFAULT_LAYERS: Layer[] = [
  { id: 'layer-lane',        name: 'Boundaries',   nodeType: 'lane',        visible: true, color: NODE_TYPE_COLORS.lane },
  { id: 'layer-source',      name: 'Sources',      nodeType: 'source',      visible: true, color: NODE_TYPE_COLORS.source },
  { id: 'layer-destination', name: 'Destinations', nodeType: 'destination', visible: true, color: NODE_TYPE_COLORS.destination },
  { id: 'layer-charging',    name: 'Charging',     nodeType: 'charging',    visible: true, color: NODE_TYPE_COLORS.charging },
  { id: 'layer-parking',     name: 'Parking',      nodeType: 'parking',     visible: true, color: NODE_TYPE_COLORS.parking },
  { id: 'layer-blocked',     name: 'Blocked',      nodeType: 'blocked',     visible: true, color: NODE_TYPE_COLORS.blocked },
  { id: 'layer-junction',    name: 'Junctions',    nodeType: 'junction',    visible: true, color: NODE_TYPE_COLORS.junction },
]
