import React, {
  useRef, useCallback, useState, useMemo, useEffect, memo,
} from 'react'
import {
  Stage, Layer, Group, Rect, RegularPolygon, Arrow, Text,
} from 'react-konva'
import type Konva from 'konva'
import { useGridStore } from '../../store/gridStore'
import { useUIStore } from '../../store/uiStore'
import {
  getCellCenter, posToCell, isAdjacent, getDirection, totalCanvasSize,
  HEX_RADIUS, SQUARE_SIZE, RECT_W, RECT_H,
} from '../../lib/grid/geometry'
import { hitTestEdge, bfsPath } from '../../lib/graph'
import { floodFill } from '../../lib/grid/floodFill'
import { NODE_TYPE_COLORS } from '@naxa/core'
import type { GridCell, GridMap, Edge, CellCoord, NodeType } from '@naxa/core'
import CanvasOverlay from './CanvasOverlay'

// ── Constants ─────────────────────────────────────────────────────────────────
const EDGE_COLOR = '#93c5fd'
const PATH_COLOR = '#f59e0b'
const SELECT_GLOW = '#a78bfa'

// Improved stroke visibility: the previous #1e293b was too close to cell fill.
export const BG_THEMES = {
  dark:  { canvas: '#080818', cell: '#0c1020', stroke: '#2d4060', dot: '#ffffff', coordText: '#94a3b8' },
  light: { canvas: '#f1f5f9', cell: '#dde4f0', stroke: '#8da4c0', dot: '#334155', coordText: '#475569' },
} as const

const NODE_ICONS: Record<string, string> = {
  // traversable and path intentionally absent — plain passable floor
  source: 'S', destination: 'D', charging: '⚡', parking: 'P', blocked: '✕', junction: '✦',
}

// ── Minimal hatch for unassigned (default) cells ──────────────────────────────
// Very subtle — just enough to visually distinguish empty cells from typed ones.
// Colors are nearly identical to the cell background: a faint tone-on-tone stripe.
let _hatchDark: HTMLCanvasElement | null = null
let _hatchLight: HTMLCanvasElement | null = null

function makeHatch(bgColor: string, stripeColor: string): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const sz = 10
  const c = document.createElement('canvas')
  c.width = sz; c.height = sz
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, sz, sz)
  ctx.strokeStyle = stripeColor
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, sz); ctx.lineTo(sz, 0)
  ctx.moveTo(-2, 2); ctx.lineTo(2, -2)
  ctx.moveTo(sz - 2, sz + 2); ctx.lineTo(sz + 2, sz - 2)
  ctx.stroke()
  return c
}

function getHatch(isDark: boolean): HTMLCanvasElement | null {
  if (isDark) {
    // Near-invisible: very slight brightness increase over cell bg (#0c1020)
    if (!_hatchDark) _hatchDark = makeHatch('#0c1020', '#1e2d45')
    return _hatchDark
  }
  if (!_hatchLight) _hatchLight = makeHatch('#dde4f0', '#b8c8dc')
  return _hatchLight
}

// ── Memoized Cell ─────────────────────────────────────────────────────────────
interface CellItemProps {
  cell: GridCell
  config: GridMap['config']
  isPathNode: boolean
  isPathStart: boolean
  isPathEnd: boolean
  isSelected: boolean
  layerVisible: boolean
  unreachable: boolean
  cellBg: string
  cellStroke: string
  isDark: boolean
  showCellLabels: boolean
}

const CellItem = memo(function CellItem({
  cell, config, isPathNode, isPathStart, isPathEnd, isSelected, layerVisible, unreachable,
  cellBg, cellStroke, isDark, showCellLabels,
}: CellItemProps) {
  const center = getCellCenter(cell.coord, config)
  const shape = config.cellShape

  // SEMANTIC: unassigned = never explicitly typed by the user (cell.assigned is false/absent).
  // Explicitly assigned "blocked" now renders as solid red ✕ — same as any other typed cell.
  const isUnassigned = !cell.assigned

  const solidFill = isPathStart || isPathEnd ? '#d97706'
    : isPathNode ? '#78350f'
    : isUnassigned ? cellBg
    : NODE_TYPE_COLORS[cell.nodeType]

  // Minimal hatch only for unassigned cells (not on path highlights)
  const hatch = isUnassigned && !isPathNode && !isPathStart && !isPathEnd
    ? getHatch(isDark)
    : null

  const borderColor = unreachable ? '#ef4444'
    : isSelected ? '#a78bfa'
    : isUnassigned ? cellStroke
    : NODE_TYPE_COLORS[cell.nodeType]

  const borderW = isUnassigned && !isSelected && !unreachable ? 1 : 2
  const opacity = layerVisible ? (isUnassigned ? 1 : 0.85) : 0.1

  const shadowProps = isSelected
    ? { shadowColor: '#a78bfa', shadowBlur: 14, shadowOpacity: 0.9 }
    : unreachable
      ? { shadowColor: '#ef4444', shadowBlur: 10, shadowOpacity: 0.8 }
      : {}

  // Labels only on assigned, non-traversable/path cells, when labels are toggled on
  const displayText = showCellLabels && !isUnassigned
    ? (cell.label ?? cell.subtype?.replace(/_/g, ' ') ?? NODE_ICONS[cell.nodeType])
    : undefined

  const fillProps = hatch
    ? { fillPatternImage: hatch, fillPatternRepeat: 'repeat' as const }
    : { fill: solidFill }

  if (shape === 'hexagon') {
    return (
      <>
        <RegularPolygon
          x={center.x} y={center.y}
          sides={6} radius={HEX_RADIUS - 1}
          stroke={borderColor} strokeWidth={borderW}
          opacity={opacity} {...fillProps} {...shadowProps}
        />
        {displayText && (
          <Text
            x={center.x - HEX_RADIUS + 4} y={center.y - HEX_RADIUS + 4}
            width={HEX_RADIUS * 2 - 8}
            fontSize={cell.subtype ? 7 : 9} fontStyle="bold" text={displayText}
            fill="#fff" align="left" listening={false}
          />
        )}
      </>
    )
  }

  const w = shape === 'rectangle' ? RECT_W : SQUARE_SIZE
  const h = shape === 'rectangle' ? RECT_H : SQUARE_SIZE

  return (
    <>
      <Rect
        x={center.x - w / 2 + 1} y={center.y - h / 2 + 1}
        width={w - 2} height={h - 2}
        cornerRadius={shape === 'square' ? 4 : 2}
        stroke={borderColor} strokeWidth={borderW}
        opacity={opacity} {...fillProps} {...shadowProps}
      />
      {displayText && (
        <Text
          x={center.x - w / 2 + 3} y={center.y - h / 2 + 3}
          width={w - 6}
          fontSize={cell.subtype ? 7 : 9} fontStyle="bold" text={displayText}
          fill="#fff" align="left" listening={false}
        />
      )}
    </>
  )
})

// ── Memoized Cells Group ──────────────────────────────────────────────────────
interface CellsGroupProps {
  cells: GridMap['cells']
  config: GridMap['config']
  layerVisibility: Map<string, boolean>
  pathSet: Set<string>
  pathStart: string | null
  pathEnd: string | null
  selectedCellId: string | null
  unreachableSet: Set<string>
  cellBg: string
  cellStroke: string
  isDark: boolean
  showCellLabels: boolean
}

const CellsGroup = memo(function CellsGroup({
  cells, config, layerVisibility, pathSet, pathStart, pathEnd, selectedCellId, unreachableSet,
  cellBg, cellStroke, isDark, showCellLabels,
}: CellsGroupProps) {
  return (
    <>
      {cells.map(cell => (
        <CellItem
          key={cell.id}
          cell={cell}
          config={config}
          isPathNode={pathSet.has(cell.id)}
          isPathStart={cell.id === pathStart}
          isPathEnd={cell.id === pathEnd}
          isSelected={cell.id === selectedCellId}
          layerVisible={layerVisibility.get(cell.nodeType) ?? true}
          unreachable={unreachableSet.has(cell.id)}
          cellBg={cellBg}
          cellStroke={cellStroke}
          isDark={isDark}
          showCellLabels={showCellLabels}
        />
      ))}
    </>
  )
}, (prev, next) =>
  prev.cells === next.cells &&
  prev.config === next.config &&
  prev.layerVisibility === next.layerVisibility &&
  prev.pathSet === next.pathSet &&
  prev.pathStart === next.pathStart &&
  prev.pathEnd === next.pathEnd &&
  prev.selectedCellId === next.selectedCellId &&
  prev.unreachableSet === next.unreachableSet &&
  prev.cellBg === next.cellBg &&
  prev.cellStroke === next.cellStroke &&
  prev.isDark === next.isDark &&
  prev.showCellLabels === next.showCellLabels,
)

// ── Memoized Edge ─────────────────────────────────────────────────────────────
interface EdgeItemProps {
  edge: Edge
  from: { x: number; y: number }
  to: { x: number; y: number }
  isSelected: boolean
  isPathEdge: boolean
  isTraced: boolean
  traceColor: string
  onSelect: () => void
}

const EdgeItem = memo(function EdgeItem({
  edge, from, to, isSelected, isPathEdge, isTraced, traceColor, onSelect,
}: EdgeItemProps) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.hypot(dx, dy)
  if (dist < 4) return null

  const trimFrom = Math.min(dist * 0.14, 10)
  const trimTo   = Math.min(dist * 0.25, 16)
  const ux = dx / dist
  const uy = dy / dist

  const color = isTraced ? traceColor : isSelected ? SELECT_GLOW : isPathEdge ? PATH_COLOR : EDGE_COLOR
  const sw = isTraced || isSelected || isPathEdge ? 3.5 : 3
  const glow = isTraced || isSelected
    ? { shadowColor: color, shadowBlur: 14, shadowOpacity: 0.9 }
    : isPathEdge
      ? { shadowColor: color, shadowBlur: 8, shadowOpacity: 0.7 }
      : {}

  return (
    <Arrow
      points={[from.x + ux * trimFrom, from.y + uy * trimFrom, to.x - ux * trimTo, to.y - uy * trimTo]}
      pointerAtBeginning={edge.bidirectional}
      pointerAtEnding={true}
      pointerLength={14} pointerWidth={10}
      stroke={color} strokeWidth={sw} fill={color}
      onClick={onSelect}
      {...glow}
    />
  )
})

// ── Memoized Edges Group ──────────────────────────────────────────────────────
interface EdgesGroupProps {
  edges: GridMap['edges']
  cellCenters: Map<string, { x: number; y: number }>
  selectedEdgeId: string | null
  pathSet: Set<string>
  tracedEdges: Map<string, string>
  onSelectEdge: (id: string | null) => void
}

const EdgesGroup = memo(function EdgesGroup({
  edges, cellCenters, selectedEdgeId, pathSet, tracedEdges, onSelectEdge,
}: EdgesGroupProps) {
  return (
    <>
      {edges.map(edge => {
        const from = cellCenters.get(edge.from)
        const to = cellCenters.get(edge.to)
        if (!from || !to) return null
        const traceColor = tracedEdges.get(edge.id)
        return (
          <EdgeItem
            key={edge.id}
            edge={edge}
            from={from} to={to}
            isSelected={selectedEdgeId === edge.id}
            isPathEdge={pathSet.has(edge.from) && pathSet.has(edge.to)}
            isTraced={!!traceColor}
            traceColor={traceColor ?? EDGE_COLOR}
            onSelect={() => onSelectEdge(selectedEdgeId === edge.id ? null : edge.id)}
          />
        )
      })}
    </>
  )
}, (prev, next) =>
  prev.edges === next.edges &&
  prev.cellCenters === next.cellCenters &&
  prev.selectedEdgeId === next.selectedEdgeId &&
  prev.pathSet === next.pathSet &&
  prev.tracedEdges === next.tracedEdges,
)

// ── Memoized Coords Group ─────────────────────────────────────────────────────
interface CoordsGroupProps {
  cells: GridMap['cells']
  config: GridMap['config']
  dotColor: string
  labelColor: string
}

const CoordsGroup = memo(function CoordsGroup({ cells, config, dotColor, labelColor }: CoordsGroupProps) {
  return (
    <>
      {cells.map(cell => {
        const c = getCellCenter(cell.coord, config)
        return (
          <React.Fragment key={`coord-${cell.id}`}>
            <Circle x={c.x} y={c.y} radius={3} fill={dotColor} opacity={0.85} listening={false} />
            <Text
              x={c.x - 25} y={c.y + 5}
              text={`(${cell.coord.row + 1},${cell.coord.col + 1})`}
              fontSize={7} fill={labelColor} fontFamily="monospace"
              width={50} align="center" listening={false}
            />
          </React.Fragment>
        )
      })}
    </>
  )
}, (prev, next) =>
  prev.cells === next.cells &&
  prev.config === next.config &&
  prev.dotColor === next.dotColor &&
  prev.labelColor === next.labelColor,
)

// ── Main Component ────────────────────────────────────────────────────────────
interface Props {
  width: number
  height: number
  stageRef: React.RefObject<Konva.Stage>
}

export default function GridCanvas({ width, height, stageRef }: Props) {
  const map = useGridStore(s => s.map)
  const { addEdge, removeEdge, setCellTypeBatch, clearCellBatch, snapshotNow, toggleEdgeBidirectional } = useGridStore.getState()

  const tool = useUIStore(s => s.tool)
  const activeNodeType = useUIStore(s => s.activeNodeType)
  const mapBg = useUIStore(s => s.mapBg)
  const bgTheme = BG_THEMES[mapBg]
  const isDark = mapBg === 'dark'
  const fitRequested = useUIStore(s => s.fitRequested)
  const selection = useUIStore(s => s.selection)
  const showCellLabels = useUIStore(s => s.showCellLabels)
  const panRef = useRef(useUIStore.getState().pan)
  const zoomRef = useRef(useUIStore.getState().zoom)
  const { setZoom, setPan, setSelection, clearSelection } = useUIStore.getState()
  const [zoomAboveThreshold, setZoomAboveThreshold] = useState(zoomRef.current >= 0.7)
  const selectedEdgeId = useUIStore(s => s.selectedEdgeId)
  const selectedCellId = useUIStore(s => s.selectedCellId)
  const pathStart = useUIStore(s => s.pathStart)
  const pathEnd = useUIStore(s => s.pathEnd)
  const pathResult = useUIStore(s => s.pathResult)
  const validationResult = useUIStore(s => s.validationResult)
  const traceRoutes = useUIStore(s => s.traceRoutes)
  const traceRunning = useUIStore(s => s.traceRunning)
  const traceSpeed = useUIStore(s => s.traceSpeed)
  const showCellCoords = useUIStore(s => s.showCellCoords)
  const {
    selectEdge, setSelectedCellId, setPathPoint, setPathResult, setTraceRunning,
  } = useUIStore.getState()

  const isPanning = useRef(false)
  const lastPanPos = useRef({ x: 0, y: 0 })
  const mouseRef = useRef({ x: 0, y: 0 })
  const previewLineRef = useRef<Konva.Line>(null)
  const overlayLayerRef = useRef<Konva.Layer>(null)
  const cellsGroupRef = useRef<Konva.Group>(null)
  const edgesGroupRef = useRef<Konva.Group>(null)
  const coordsGroupRef = useRef<Konva.Group>(null)
  const overlayGroupRef = useRef<Konva.Group>(null)
  // Two separate RAF queues: paint (assign type) and erase (clear to unassigned)
  const paintQueueRef = useRef<Map<string, NodeType>>(new Map())
  const eraseQueueRef = useRef<Set<string>>(new Set())
  const rafPaintRef = useRef<number | null>(null)
  const paintStrokedRef = useRef(false)
  const selectAnchor = useRef<{ x: number; y: number } | null>(null)
  const selectionRectRef = useRef<Konva.Rect>(null)

  const [drawStart, setDrawStart] = useState<{ coord: CellCoord; id: string } | null>(null)
  const [hoverCellId, setHoverCellId] = useState<string | null>(null)
  const [traceStep, setTraceStep] = useState<{ routeIdx: number; cellIdx: number }>({ routeIdx: 0, cellIdx: 0 })
  // Viewport culling: world-space bounds of the visible canvas area (updated ≤100ms after pan/zoom)
  const [viewportBounds, setViewportBounds] = useState({ minX: -Infinity, minY: -Infinity, maxX: Infinity, maxY: Infinity })
  const vbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── RAF-batched paint/erase flush ─────────────────────────────────────────
  const flushPaintQueue = useCallback(() => {
    rafPaintRef.current = null
    if (paintQueueRef.current.size > 0) {
      const updates = Array.from(paintQueueRef.current.entries()).map(([id, nodeType]) => ({ id, nodeType }))
      paintQueueRef.current.clear()
      setCellTypeBatch(updates)
    }
    if (eraseQueueRef.current.size > 0) {
      const ids = Array.from(eraseQueueRef.current)
      eraseQueueRef.current.clear()
      clearCellBatch(ids)
    }
  }, [setCellTypeBatch, clearCellBatch])

  const queuePaint = useCallback((id: string, nodeType: NodeType) => {
    paintQueueRef.current.set(id, nodeType)
    if (!rafPaintRef.current) rafPaintRef.current = requestAnimationFrame(flushPaintQueue)
  }, [flushPaintQueue])

  // Erase = reset cell to unassigned (removes type, subtype, label)
  const queueErase = useCallback((id: string) => {
    eraseQueueRef.current.add(id)
    if (!rafPaintRef.current) rafPaintRef.current = requestAnimationFrame(flushPaintQueue)
  }, [flushPaintQueue])

  // ── Derived data ──────────────────────────────────────────────────────────
  const cellMap = useMemo(() => {
    if (!map) return new Map<string, GridCell>()
    return new Map(map.cells.map(c => [c.id, c]))
  }, [map?.cells])

  const cellCenters = useMemo(() => {
    if (!map) return new Map<string, { x: number; y: number }>()
    const m = new Map<string, { x: number; y: number }>()
    for (const cell of map.cells) {
      m.set(cell.id, getCellCenter(cell.coord, map.config))
    }
    return m
  }, [map?.cells, map?.config])

  // Cells visible within the current viewport (or all cells if bounds not yet computed).
  const visibleCells = useMemo(() => {
    if (!map) return []
    const { minX, minY, maxX, maxY } = viewportBounds
    if (!isFinite(minX)) return map.cells // initial/infinite bounds: show all
    return map.cells.filter(cell => {
      const c = cellCenters.get(cell.id)
      return c !== undefined && c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY
    })
  }, [map?.cells, cellCenters, viewportBounds])

  // Translates canvas pointer-position coords into the cell's actual store ID (UUID or legacy).
  const coordToId = useMemo(() => {
    if (!map) return new Map<string, string>()
    const m = new Map<string, string>()
    for (const cell of map.cells) {
      m.set(`r${cell.coord.row}c${cell.coord.col}`, cell.id)
    }
    return m
  }, [map?.cells])

  const layerVisibility = useMemo(() => {
    if (!map) return new Map<string, boolean>()
    return new Map(map.layers.map(l => [l.nodeType, l.visible]))
  }, [map?.layers])

  const pathSet = useMemo(() => new Set(pathResult ?? []), [pathResult])

  const unreachableSet = useMemo(
    () => new Set(validationResult?.unreachable ?? []),
    [validationResult],
  )

  const tracedEdges = useMemo((): Map<string, string> => {
    if (!traceRunning || traceRoutes.length === 0) return new Map()
    const m = new Map<string, string>()
    const { routeIdx, cellIdx } = traceStep
    const route = traceRoutes[routeIdx]
    if (!route) return m
    for (let i = 0; i < cellIdx && i + 1 < route.pathIds.length; i++) {
      m.set(`e_${route.pathIds[i]}_${route.pathIds[i + 1]}`, route.color)
    }
    return m
  }, [traceRunning, traceRoutes, traceStep])

  // ── Trace animation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!traceRunning || traceRoutes.length === 0) return
    setTraceStep({ routeIdx: 0, cellIdx: 0 })
    const intervalMs = Math.round(1000 / traceSpeed)
    const id = setInterval(() => {
      setTraceStep(prev => {
        const route = traceRoutes[prev.routeIdx]
        if (!route) { setTraceRunning(false); return prev }
        const nextCell = prev.cellIdx + 1
        if (nextCell < route.pathIds.length) return { ...prev, cellIdx: nextCell }
        const nextRoute = prev.routeIdx + 1
        if (nextRoute < traceRoutes.length) return { routeIdx: nextRoute, cellIdx: 0 }
        return { routeIdx: 0, cellIdx: 0 }
      })
    }, intervalMs)
    return () => clearInterval(id)
  }, [traceRunning, traceRoutes, traceSpeed, setTraceRunning])

  // ── Path computation ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!map || !pathStart || !pathEnd) { setPathResult(null); return }
    setPathResult(bfsPath(pathStart, pathEnd, map.edges))
  }, [map?.edges, pathStart, pathEnd, setPathResult])

  // ── Imperative transform ──────────────────────────────────────────────────
  const applyTransform = useCallback((p: { x: number; y: number }, z: number) => {
    for (const grp of [cellsGroupRef, edgesGroupRef, coordsGroupRef, overlayGroupRef]) {
      if (!grp.current) continue
      grp.current.x(p.x); grp.current.y(p.y)
      grp.current.scaleX(z); grp.current.scaleY(z)
      grp.current.getLayer()?.batchDraw()
    }
    // Debounce viewport-bounds React state update: cancel previous timer, reschedule with latest p/z.
    // 100ms gives a stable rect after the user stops panning; 150 world-unit margin avoids pop-in.
    if (vbTimerRef.current) clearTimeout(vbTimerRef.current)
    vbTimerRef.current = setTimeout(() => {
      vbTimerRef.current = null
      const w = widthRef.current
      const h = heightRef.current
      const MARGIN = 150
      setViewportBounds({
        minX: (-p.x / z) - MARGIN,
        minY: (-p.y / z) - MARGIN,
        maxX: ((w - p.x) / z) + MARGIN,
        maxY: ((h - p.y) / z) + MARGIN,
      })
    }, 100)
  }, [])

  // ── Fit-to-screen ─────────────────────────────────────────────────────────
  const widthRef = useRef(width)
  const heightRef = useRef(height)
  widthRef.current = width
  heightRef.current = height

  useEffect(() => {
    if (fitRequested === 0) return
    const currentMap = useGridStore.getState().map
    if (!currentMap) return
    const { w: gw, h: gh } = totalCanvasSize(currentMap.config)
    const newZoom = Math.min(widthRef.current / gw, heightRef.current / gh) * 0.88
    const newPan = {
      x: (widthRef.current - gw * newZoom) / 2,
      y: (heightRef.current - gh * newZoom) / 2,
    }
    panRef.current = newPan
    zoomRef.current = newZoom
    applyTransform(newPan, newZoom)
    setZoom(newZoom)
    setPan(newPan)
    setZoomAboveThreshold(newZoom >= 0.7)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitRequested, applyTransform])

  // ── World-space coord helper ──────────────────────────────────────────────
  const worldPos = useCallback((stage: Konva.Stage) => {
    const p = stage.getPointerPosition()
    if (!p) return null
    return { x: (p.x - panRef.current.x) / zoomRef.current, y: (p.y - panRef.current.y) / zoomRef.current }
  }, [])

  const getCenterById = useCallback((id: string) => cellCenters.get(id) ?? null, [cellCenters])

  // ── Event handlers ────────────────────────────────────────────────────────
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = e.target.getStage()
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const scale = e.evt.deltaY < 0 ? 1.1 : 0.9
    const newZoom = Math.min(5, Math.max(0.1, zoomRef.current * scale))
    const newPan = {
      x: pointer.x - ((pointer.x - panRef.current.x) / zoomRef.current) * newZoom,
      y: pointer.y - ((pointer.y - panRef.current.y) / zoomRef.current) * newZoom,
    }
    panRef.current = newPan
    zoomRef.current = newZoom
    applyTransform(newPan, newZoom)
    setZoom(newZoom)
    setPan(newPan)
    const above = newZoom >= 0.7
    setZoomAboveThreshold(prev => prev !== above ? above : prev)
  }, [applyTransform, setZoom, setPan])

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!map) return
    if (e.evt.button === 1 || e.evt.button === 2) {
      isPanning.current = true
      lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY }
      return
    }
    const stage = e.target.getStage()
    if (!stage) return
    const wp = worldPos(stage)
    if (!wp) return

    const coord = posToCell(wp.x, wp.y, map.config)
    const cellId = coord ? (coordToId.get(`r${coord.row}c${coord.col}`) ?? null) : null

    setSelectedCellId(cellId)
    selectEdge(null)

    if (tool === 'draw') {
      if (coord && cellId) {
        setDrawStart({ coord, id: cellId })
      } else {
        isPanning.current = true
        lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY }
      }
    } else if (tool === 'type' && cellId) {
      if (!paintStrokedRef.current) { snapshotNow(); paintStrokedRef.current = true }
      queuePaint(cellId, activeNodeType)
    } else if (tool === 'erase') {
      if (!paintStrokedRef.current) { snapshotNow(); paintStrokedRef.current = true }
      if (cellId) queueErase(cellId)
      const edgeId = hitTestEdge(wp.x, wp.y, map.edges, cellMap, getCenterById)
      if (edgeId) removeEdge(edgeId)
    } else if (tool === 'path' && cellId) {
      setPathPoint(cellId)
    } else if (tool === 'select') {
      selectAnchor.current = wp
      clearSelection()
    } else if (tool === 'fill' && coord) {
      const cellIds = floodFill(coord.row, coord.col, map.cells, map.config)
      if (cellIds.length > 0) {
        snapshotNow()
        setCellTypeBatch(cellIds.map(id => ({ id, nodeType: activeNodeType })))
      }
    }
  }, [map, tool, activeNodeType, worldPos, coordToId, snapshotNow, queuePaint, queueErase, removeEdge, cellMap,
    getCenterById, selectEdge, setSelectedCellId, setPathPoint, clearSelection, setCellTypeBatch])

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!map) return

    if (isPanning.current) {
      const dx = e.evt.clientX - lastPanPos.current.x
      const dy = e.evt.clientY - lastPanPos.current.y
      lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY }
      const newPan = { x: panRef.current.x + dx, y: panRef.current.y + dy }
      panRef.current = newPan
      applyTransform(newPan, zoomRef.current)
      setPan(newPan)
      return
    }

    const stage = e.target.getStage()
    if (!stage) return
    const wp = worldPos(stage)
    if (!wp) return
    mouseRef.current = wp

    if (tool === 'select' && e.evt.buttons === 1 && selectAnchor.current) {
      const anchor = selectAnchor.current
      if (selectionRectRef.current) {
        selectionRectRef.current.x(Math.min(anchor.x, wp.x))
        selectionRectRef.current.y(Math.min(anchor.y, wp.y))
        selectionRectRef.current.width(Math.abs(wp.x - anchor.x))
        selectionRectRef.current.height(Math.abs(wp.y - anchor.y))
        selectionRectRef.current.visible(true)
        overlayLayerRef.current?.batchDraw()
      }
      return
    }

    const coord = posToCell(wp.x, wp.y, map.config)
    const newHoverId = coord ? (coordToId.get(`r${coord.row}c${coord.col}`) ?? null) : null
    setHoverCellId(prev => prev === newHoverId ? prev : newHoverId)

    if (drawStart && previewLineRef.current) {
      const startCenter = cellCenters.get(drawStart.id)
      if (startCenter) {
        previewLineRef.current.points([startCenter.x, startCenter.y, wp.x, wp.y])
        previewLineRef.current.visible(true)
        overlayLayerRef.current?.batchDraw()
      }
    }

    if (tool === 'draw' && e.evt.buttons === 1 && drawStart && coord) {
      const newId = coordToId.get(`r${coord.row}c${coord.col}`)
      if (newId && newId !== drawStart.id && isAdjacent(drawStart.coord, coord, map.config.cellShape)) {
        addEdge(drawStart.id, newId, getDirection(drawStart.coord, coord, map.config.cellShape))
        setDrawStart({ coord, id: newId })
      }
    }

    if (tool === 'type' && e.evt.buttons === 1 && coord) {
      const id = coordToId.get(`r${coord.row}c${coord.col}`)
      if (id) queuePaint(id, activeNodeType)
    }
    if (tool === 'erase' && e.evt.buttons === 1 && coord) {
      const id = coordToId.get(`r${coord.row}c${coord.col}`)
      if (id) queueErase(id)
    }
  }, [map, tool, activeNodeType, drawStart, worldPos, coordToId, applyTransform, setPan, cellCenters, addEdge, queuePaint, queueErase])

  const handleMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    isPanning.current = false
    if (previewLineRef.current) previewLineRef.current.visible(false)
    overlayLayerRef.current?.batchDraw()
    if (rafPaintRef.current) { cancelAnimationFrame(rafPaintRef.current); rafPaintRef.current = null }
    flushPaintQueue()
    paintStrokedRef.current = false

    if (tool === 'select' && selectAnchor.current && map) {
      const stage = e.target.getStage()
      if (stage) {
        const wp = worldPos(stage)
        if (wp) {
          const anchor = selectAnchor.current
          if (Math.abs(wp.x - anchor.x) < 2 && Math.abs(wp.y - anchor.y) < 2) {
            const coord = posToCell(wp.x, wp.y, map.config)
            const selId = coord ? coordToId.get(`r${coord.row}c${coord.col}`) : undefined
            if (selId) setSelection(new Set([selId]))
          } else {
            const minX = Math.min(anchor.x, wp.x), maxX = Math.max(anchor.x, wp.x)
            const minY = Math.min(anchor.y, wp.y), maxY = Math.max(anchor.y, wp.y)
            setSelection(new Set(
              map.cells
                .filter(c => {
                  const center = cellCenters.get(c.id)
                  return center && center.x >= minX && center.x <= maxX && center.y >= minY && center.y <= maxY
                })
                .map(c => c.id),
            ))
          }
        }
      }
      selectAnchor.current = null
      if (selectionRectRef.current) { selectionRectRef.current.visible(false); overlayLayerRef.current?.batchDraw() }
      setDrawStart(null)
      return
    }

    if (!map || !drawStart || tool !== 'draw') { setDrawStart(null); return }

    const stage = e.target.getStage()
    if (!stage) { setDrawStart(null); return }
    const wp = worldPos(stage)
    if (!wp) { setDrawStart(null); return }

    const endCoord = posToCell(wp.x, wp.y, map.config)
    if (endCoord) {
      const endId = coordToId.get(`r${endCoord.row}c${endCoord.col}`)
      if (endId === drawStart.id) {
        const edge = map.edges.find(ed => ed.from === drawStart.id || ed.to === drawStart.id)
        if (edge) toggleEdgeBidirectional(edge.id)
      } else if (endId && isAdjacent(drawStart.coord, endCoord, map.config.cellShape)) {
        addEdge(drawStart.id, endId, getDirection(drawStart.coord, endCoord, map.config.cellShape))
      }
    }
    setDrawStart(null)
  }, [map, drawStart, tool, worldPos, coordToId, addEdge, toggleEdgeBidirectional, flushPaintQueue, cellCenters, setSelection])

  if (!map) return null

  const hoverCenter = hoverCellId ? cellCenters.get(hoverCellId) : null
  const shape = map.config.cellShape

  // Trace: compute centers for the current route's start, end, and animated cursor
  const activeRoute = traceRunning ? traceRoutes[traceStep.routeIdx] : null
  const traceStartCenter = activeRoute ? cellCenters.get(activeRoute.pathIds[0]) : null
  const traceEndCenter   = activeRoute ? cellCenters.get(activeRoute.pathIds[activeRoute.pathIds.length - 1]) : null
  const traceCurCenter   = activeRoute && traceStep.cellIdx < activeRoute.pathIds.length
    ? cellCenters.get(activeRoute.pathIds[traceStep.cellIdx]) : null

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.evt.preventDefault()}
      style={{
        cursor: drawStart ? 'crosshair' : tool === 'erase' ? 'cell' : tool === 'select' ? 'crosshair' : 'default',
        background: bgTheme.canvas,
      }}
    >
      <Layer listening={false}>
        <Group ref={cellsGroupRef}
          x={panRef.current.x} y={panRef.current.y}
          scaleX={zoomRef.current} scaleY={zoomRef.current}>
          <CellsGroup
            cells={visibleCells}
            config={map.config}
            layerVisibility={layerVisibility}
            pathSet={pathSet}
            pathStart={pathStart}
            pathEnd={pathEnd}
            selectedCellId={selectedCellId}
            unreachableSet={unreachableSet}
            cellBg={bgTheme.cell}
            cellStroke={bgTheme.stroke}
            isDark={isDark}
            showCellLabels={showCellLabels}
          />
        </Group>
      </Layer>

      <Layer>
        <Group ref={edgesGroupRef}
          x={panRef.current.x} y={panRef.current.y}
          scaleX={zoomRef.current} scaleY={zoomRef.current}>
          <EdgesGroup
            edges={map.edges}
            cellCenters={cellCenters}
            selectedEdgeId={selectedEdgeId}
            pathSet={pathSet}
            tracedEdges={tracedEdges}
            onSelectEdge={selectEdge}
          />
        </Group>
      </Layer>

      {showCellCoords && zoomAboveThreshold && (
        <Layer listening={false}>
          <Group ref={coordsGroupRef}
            x={panRef.current.x} y={panRef.current.y}
            scaleX={zoomRef.current} scaleY={zoomRef.current}>
            <CoordsGroup
              cells={visibleCells}
              config={map.config}
              dotColor={bgTheme.dot}
              labelColor={bgTheme.coordText}
            />
          </Group>
        </Layer>
      )}

      <Layer ref={overlayLayerRef} listening={false}>
        <Group ref={overlayGroupRef}
          x={panRef.current.x} y={panRef.current.y}
          scaleX={zoomRef.current} scaleY={zoomRef.current}>
          <CanvasOverlay
            previewLineRef={previewLineRef}
            selectionRectRef={selectionRectRef}
            hoverCenter={hoverCenter}
            shape={shape}
            selection={selection}
            cells={visibleCells}
            cellCenters={cellCenters}
            pathStart={pathStart}
            pathEnd={pathEnd}
            traceActive={!!(traceRunning && activeRoute)}
            traceColor={activeRoute?.color ?? ''}
            traceStartCenter={traceStartCenter}
            traceEndCenter={traceEndCenter}
            traceCurCenter={traceCurCenter}
          />
        </Group>
      </Layer>
    </Stage>
  )
}
