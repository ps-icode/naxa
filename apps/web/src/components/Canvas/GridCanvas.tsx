import React, {
  useRef, useCallback, useState, useMemo, useEffect, memo,
} from 'react'
import {
  Stage, Layer, Group, Rect, RegularPolygon, Arrow, Line, Circle, Text,
} from 'react-konva'
import type Konva from 'konva'
import { useGridStore } from '../../store/gridStore'
import { useUIStore } from '../../store/uiStore'
import {
  getCellCenter, posToCell, isAdjacent, getDirection,
  HEX_RADIUS, SQUARE_SIZE, RECT_W, RECT_H,
} from '../../lib/grid/geometry'
import { hitTestEdge, bfsPath } from '../../lib/graph'
import { NODE_TYPE_COLORS } from '@naxa/core'
import type { GridCell, GridMap, Edge, CellCoord } from '@naxa/core'

// ── Constants ─────────────────────────────────────────────────────────────────
const EDGE_COLOR = '#60a5fa'
const PATH_COLOR = '#f59e0b'
const SELECT_GLOW = '#a78bfa'
const CELL_STROKE = '#1e293b'
const CELL_BG = '#0d1424'

const NODE_ICONS: Record<string, string> = {
  source: 'S', destination: 'D', charging: '⚡', parking: 'P', blocked: '✕', junction: '✦',
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
}

const CellItem = memo(function CellItem({
  cell, config, isPathNode, isPathStart, isPathEnd, isSelected, layerVisible, unreachable,
}: CellItemProps) {
  const center = getCellCenter(cell.coord, config)
  const shape = config.cellShape
  const typed = cell.nodeType !== 'lane'

  const fill = isPathStart || isPathEnd ? '#d97706'
    : isPathNode ? '#78350f'
    : typed ? NODE_TYPE_COLORS[cell.nodeType]
    : CELL_BG

  const borderColor = unreachable ? '#ef4444'
    : isSelected ? '#a78bfa'
    : typed ? NODE_TYPE_COLORS[cell.nodeType]
    : CELL_STROKE

  const borderW = typed || isSelected || unreachable ? 2 : 1
  const opacity = layerVisible ? (typed ? 0.8 : 1) : 0.1

  const displayText = cell.label ?? cell.subtype?.replace(/_/g, ' ') ?? (typed ? NODE_ICONS[cell.nodeType] : undefined)

  const shadowProps = isSelected
    ? { shadowColor: '#a78bfa', shadowBlur: 14, shadowOpacity: 0.9 }
    : unreachable
      ? { shadowColor: '#ef4444', shadowBlur: 10, shadowOpacity: 0.8 }
      : typed
        ? { shadowColor: NODE_TYPE_COLORS[cell.nodeType], shadowBlur: 6, shadowOpacity: 0.5 }
        : {}

  if (shape === 'hexagon') {
    return (
      <>
        <RegularPolygon
          x={center.x} y={center.y}
          sides={6} radius={HEX_RADIUS - 1}
          fill={fill} stroke={borderColor} strokeWidth={borderW}
          opacity={opacity} {...shadowProps}
        />
        {displayText && (
          <Text
            x={center.x - 16} y={center.y - 7}
            width={32} fontSize={typed && cell.subtype ? 8 : 10}
            fontStyle="bold" text={displayText}
            fill="#fff" align="center" listening={false}
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
        fill={fill} stroke={borderColor} strokeWidth={borderW}
        opacity={opacity} {...shadowProps}
      />
      {displayText && (
        <Text
          x={center.x - w / 2} y={center.y - 7}
          width={w} fontSize={typed && cell.subtype ? 8 : 10}
          fontStyle="bold" text={displayText}
          fill="#fff" align="center" listening={false}
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
}

const CellsGroup = memo(function CellsGroup({
  cells, config, layerVisibility, pathSet, pathStart, pathEnd, selectedCellId, unreachableSet,
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
  prev.unreachableSet === next.unreachableSet,
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

  const trim = Math.min(dist / 2 - 4, 22)
  const ux = dx / dist
  const uy = dy / dist
  const color = isTraced ? traceColor : isSelected ? SELECT_GLOW : isPathEdge ? PATH_COLOR : EDGE_COLOR
  const sw = isTraced || isSelected || isPathEdge ? 3 : 2
  const glow = { shadowColor: color, shadowBlur: isTraced || isSelected ? 12 : 4, shadowOpacity: isTraced ? 0.9 : 0.5 }

  return (
    <Arrow
      points={[from.x + ux * trim, from.y + uy * trim, to.x - ux * trim, to.y - uy * trim]}
      pointerAtBeginning={edge.bidirectional}
      pointerAtEnding={true}
      pointerLength={8} pointerWidth={6}
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
  tracedEdges: Map<string, string>  // edgeId → color
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

// ── Main Component ────────────────────────────────────────────────────────────
interface Props {
  width: number
  height: number
  stageRef: React.RefObject<Konva.Stage>
}

export default function GridCanvas({ width, height, stageRef }: Props) {
  const map = useGridStore(s => s.map)
  const { addEdge, removeEdge, setCellType, setCellTypeBatch, snapshotNow, toggleEdgeBidirectional } = useGridStore.getState()

  const tool = useUIStore(s => s.tool)
  const activeNodeType = useUIStore(s => s.activeNodeType)
  const zoom = useUIStore(s => s.zoom)
  const pan = useUIStore(s => s.pan)
  const { setZoom, setPan } = useUIStore.getState()
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

  // Refs — no re-render on update
  const isPanning = useRef(false)
  const lastPanPos = useRef({ x: 0, y: 0 })
  const mouseRef = useRef({ x: 0, y: 0 })
  const previewLineRef = useRef<Konva.Line>(null)
  const overlayLayerRef = useRef<Konva.Layer>(null)
  // RAF coalescing: mousemove fires far faster than 60 fps, so we accumulate cell
  // updates in paintQueueRef and flush them once per animation frame via rafPaintRef.
  // paintStrokedRef ensures exactly one snapshotNow() call per drag stroke,
  // keeping the undo history clean regardless of how many cells are painted.
  const paintQueueRef = useRef<Map<string, NodeType>>(new Map())
  const rafPaintRef = useRef<number | null>(null)
  const paintStrokedRef = useRef(false)

  // React state — only things that must trigger re-render
  const [drawStart, setDrawStart] = useState<{ coord: CellCoord; id: string } | null>(null)
  const [hoverCellId, setHoverCellId] = useState<string | null>(null)
  const [traceStep, setTraceStep] = useState<{ routeIdx: number; cellIdx: number }>({ routeIdx: 0, cellIdx: 0 })

  // ── RAF-batched paint flush ────────────────────────────────────────────────
  const flushPaintQueue = useCallback(() => {
    rafPaintRef.current = null
    if (paintQueueRef.current.size === 0) return
    const updates = Array.from(paintQueueRef.current.entries()).map(([id, nodeType]) => ({ id, nodeType }))
    paintQueueRef.current.clear()
    setCellTypeBatch(updates)
  }, [setCellTypeBatch])

  const queuePaint = useCallback((id: string, nodeType: NodeType) => {
    paintQueueRef.current.set(id, nodeType)
    if (!rafPaintRef.current) {
      rafPaintRef.current = requestAnimationFrame(flushPaintQueue)
    }
  }, [flushPaintQueue])

  // ── Derived data (stable refs) ────────────────────────────────────────────
  const cellMap = useMemo(() => {
    if (!map) return new Map<string, GridCell>()
    return new Map(map.cells.map(c => [c.id, c]))
  }, [map?.cells])

  const cellCenters = useMemo(() => {
    if (!map) return new Map<string, { x: number; y: number }>()
    return new Map(map.cells.map(c => [c.id, getCellCenter(c.coord, map.config)]))
  }, [map?.cells, map?.config])

  const layerVisibility = useMemo(() => {
    if (!map) return new Map<string, boolean>()
    return new Map(map.layers.map(l => [l.nodeType, l.visible]))
  }, [map?.layers])

  const pathSet = useMemo(() => new Set(pathResult ?? []), [pathResult])

  const unreachableSet = useMemo(
    () => new Set(validationResult?.unreachable ?? []),
    [validationResult],
  )

  // Current traced edges and cells for this animation frame
  const tracedEdges = useMemo((): Map<string, string> => {
    if (!traceRunning || traceRoutes.length === 0) return new Map()
    const m = new Map<string, string>()
    const { routeIdx, cellIdx } = traceStep
    const route = traceRoutes[routeIdx]
    if (!route) return m
    // Highlight edges traversed so far in this route
    for (let i = 0; i < cellIdx && i + 1 < route.pathIds.length; i++) {
      m.set(`e_${route.pathIds[i]}_${route.pathIds[i + 1]}`, route.color)
    }
    return m
  }, [traceRunning, traceRoutes, traceStep])

  const tracedCells = useMemo((): Map<string, string> => {
    if (!traceRunning || traceRoutes.length === 0) return new Map()
    const m = new Map<string, string>()
    const { routeIdx, cellIdx } = traceStep
    const route = traceRoutes[routeIdx]
    if (!route || cellIdx >= route.pathIds.length) return m
    m.set(route.pathIds[cellIdx], route.color)
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
        if (nextCell < route.pathIds.length) {
          return { ...prev, cellIdx: nextCell }
        }
        // Move to next route
        const nextRoute = prev.routeIdx + 1
        if (nextRoute < traceRoutes.length) {
          return { routeIdx: nextRoute, cellIdx: 0 }
        }
        // All done — loop back
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

  // ── World-space coord helper ──────────────────────────────────────────────
  // Converts screen pixel → world coordinate: worldPx = (screenPx - pan) / zoom
  const worldPos = useCallback((stage: Konva.Stage) => {
    const p = stage.getPointerPosition()
    if (!p) return null
    return { x: (p.x - pan.x) / zoom, y: (p.y - pan.y) / zoom }
  }, [pan, zoom])

  const getCenterById = useCallback((id: string) => cellCenters.get(id) ?? null, [cellCenters])

  // ── Event handlers ────────────────────────────────────────────────────────
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = e.target.getStage()
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const scale = e.evt.deltaY < 0 ? 1.1 : 0.9
    const newZoom = Math.min(5, Math.max(0.1, zoom * scale))
    setZoom(newZoom)
    setPan({
      x: pointer.x - ((pointer.x - pan.x) / zoom) * newZoom,
      y: pointer.y - ((pointer.y - pan.y) / zoom) * newZoom,
    })
  }, [zoom, pan, setZoom, setPan])

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
    const cellId = coord ? `r${coord.row}c${coord.col}` : null

    // Select cell for cell-info panel
    setSelectedCellId(cellId)
    selectEdge(null)

    if (tool === 'draw') {
      if (coord) {
        setDrawStart({ coord, id: cellId! })
      } else {
        isPanning.current = true
        lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY }
      }
    } else if (tool === 'type' && coord) {
      // Snapshot once at stroke start — no clone during drag
      if (!paintStrokedRef.current) {
        snapshotNow()
        paintStrokedRef.current = true
      }
      queuePaint(cellId!, activeNodeType)
    } else if (tool === 'erase') {
      if (coord) setCellType(cellId!, 'lane')
      const edgeId = hitTestEdge(wp.x, wp.y, map.edges, cellMap, getCenterById)
      if (edgeId) removeEdge(edgeId)
    } else if (tool === 'path' && coord) {
      setPathPoint(cellId!)
    }
  }, [map, tool, activeNodeType, worldPos, snapshotNow, queuePaint, setCellType, removeEdge, cellMap, getCenterById,
    selectEdge, setSelectedCellId, setPathPoint])

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!map) return

    if (isPanning.current) {
      const dx = e.evt.clientX - lastPanPos.current.x
      const dy = e.evt.clientY - lastPanPos.current.y
      lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY }
      setPan({ x: pan.x + dx, y: pan.y + dy })
      return
    }

    const stage = e.target.getStage()
    if (!stage) return
    const wp = worldPos(stage)
    if (!wp) return
    mouseRef.current = wp

    // Update hover (lightweight state — only triggers overlay re-render, not cells)
    const coord = posToCell(wp.x, wp.y, map.config)
    const newHoverId = coord ? `r${coord.row}c${coord.col}` : null
    setHoverCellId(prev => prev === newHoverId ? prev : newHoverId)

    // Update draw preview line imperatively — no state change needed
    if (drawStart && previewLineRef.current) {
      const startCenter = cellCenters.get(drawStart.id)
      if (startCenter) {
        previewLineRef.current.points([startCenter.x, startCenter.y, wp.x, wp.y])
        previewLineRef.current.visible(true)
        overlayLayerRef.current?.batchDraw()
      }
    }

    // Continuous lane painting — create edge each time cursor enters new adjacent cell
    if (tool === 'draw' && e.evt.buttons === 1 && drawStart && coord) {
      const newId = `r${coord.row}c${coord.col}`
      if (newId !== drawStart.id && isAdjacent(drawStart.coord, coord, map.config.cellShape)) {
        addEdge(drawStart.id, newId, getDirection(drawStart.coord, coord, map.config.cellShape))
        setDrawStart({ coord, id: newId })  // chain: new start is current cell
      }
    }

    // Paint type — queued, flushed at most once per animation frame
    if (tool === 'type' && e.evt.buttons === 1 && coord) {
      queuePaint(`r${coord.row}c${coord.col}`, activeNodeType)
    }
  }, [map, tool, activeNodeType, drawStart, worldPos, pan, setPan, cellCenters, addEdge, queuePaint])

  const handleMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    isPanning.current = false
    if (previewLineRef.current) previewLineRef.current.visible(false)
    overlayLayerRef.current?.batchDraw()
    // Flush any pending paint and end the stroke
    if (rafPaintRef.current) { cancelAnimationFrame(rafPaintRef.current); rafPaintRef.current = null }
    flushPaintQueue()
    paintStrokedRef.current = false

    if (!map || !drawStart || tool !== 'draw') { setDrawStart(null); return }

    const stage = e.target.getStage()
    if (!stage) { setDrawStart(null); return }
    const wp = worldPos(stage)
    if (!wp) { setDrawStart(null); return }

    const endCoord = posToCell(wp.x, wp.y, map.config)
    if (endCoord) {
      const endId = `r${endCoord.row}c${endCoord.col}`
      if (endId === drawStart.id) {
        // Click on same cell → toggle existing edge direction
        const edge = map.edges.find(ed => ed.from === drawStart.id || ed.to === drawStart.id)
        if (edge) toggleEdgeBidirectional(edge.id)
      } else if (isAdjacent(drawStart.coord, endCoord, map.config.cellShape)) {
        addEdge(drawStart.id, endId, getDirection(drawStart.coord, endCoord, map.config.cellShape))
      }
    }
    setDrawStart(null)
  }, [map, drawStart, tool, worldPos, addEdge, toggleEdgeBidirectional, flushPaintQueue])

  if (!map) return null

  // Hover highlight position
  const hoverCenter = hoverCellId ? cellCenters.get(hoverCellId) : null
  const shape = map.config.cellShape

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
      style={{ cursor: drawStart ? 'crosshair' : tool === 'erase' ? 'cell' : 'default' }}
    >
      {/* ── Static cells layer (listening=false for perf) ─────────────── */}
      <Layer listening={false}>
        <Group x={pan.x} y={pan.y} scaleX={zoom} scaleY={zoom}>
          <CellsGroup
            cells={map.cells}
            config={map.config}
            layerVisibility={layerVisibility}
            pathSet={pathSet}
            pathStart={pathStart}
            pathEnd={pathEnd}
            selectedCellId={selectedCellId}
            unreachableSet={unreachableSet}
          />
        </Group>
      </Layer>

      {/* ── Edges layer (has click handlers) ─────────────────────────── */}
      <Layer>
        <Group x={pan.x} y={pan.y} scaleX={zoom} scaleY={zoom}>
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

      {/* ── Cell coordinate labels ────────────────────────────────────── */}
      {showCellCoords && (() => {
        const halfH = map.config.cellShape === 'hexagon' ? HEX_RADIUS
          : map.config.cellShape === 'rectangle' ? RECT_H / 2
          : SQUARE_SIZE / 2
        return (
          <Layer listening={false}>
            <Group x={pan.x} y={pan.y} scaleX={zoom} scaleY={zoom}>
              {map.cells.map(cell => {
                const c = getCellCenter(cell.coord, map.config)
                return (
                  <React.Fragment key={`coord-${cell.id}`}>
                    <Circle x={c.x} y={c.y} radius={3} fill="#ffffff" opacity={0.85} listening={false} />
                    <Text
                      x={c.x - 25} y={c.y - halfH + 2}
                      text={`(${cell.coord.row},${cell.coord.col})`}
                      fontSize={7} fill="#94a3b8" fontFamily="monospace"
                      width={50} align="center" listening={false}
                    />
                  </React.Fragment>
                )
              })}
            </Group>
          </Layer>
        )
      })()}

      {/* ── Overlay: hover + preview + trace + path endpoints ─────────── */}
      <Layer ref={overlayLayerRef} listening={false}>
        <Group x={pan.x} y={pan.y} scaleX={zoom} scaleY={zoom}>
          {/* Hover highlight */}
          {hoverCenter && (
            shape === 'hexagon'
              ? <RegularPolygon
                  x={hoverCenter.x} y={hoverCenter.y}
                  sides={6} radius={HEX_RADIUS - 1}
                  fill="transparent" stroke="#60a5fa" strokeWidth={2}
                />
              : <Rect
                  x={hoverCenter.x - (shape === 'rectangle' ? RECT_W : SQUARE_SIZE) / 2 + 1}
                  y={hoverCenter.y - (shape === 'rectangle' ? RECT_H : SQUARE_SIZE) / 2 + 1}
                  width={(shape === 'rectangle' ? RECT_W : SQUARE_SIZE) - 2}
                  height={(shape === 'rectangle' ? RECT_H : SQUARE_SIZE) - 2}
                  cornerRadius={4}
                  fill="transparent" stroke="#60a5fa" strokeWidth={2}
                />
          )}

          {/* Draw preview line — updated imperatively via ref */}
          <Line ref={previewLineRef} points={[0, 0, 0, 0]} visible={false}
            stroke="#60a5fa" strokeWidth={2} dash={[6, 4]} opacity={0.7} />

          {/* Path endpoints */}
          {pathStart && (() => {
            const c = cellCenters.get(pathStart)
            if (!c) return null
            return <Circle key="ps" x={c.x} y={c.y} radius={7} fill="#10b981" stroke="#fff" strokeWidth={1.5} />
          })()}
          {pathEnd && (() => {
            const c = cellCenters.get(pathEnd)
            if (!c) return null
            return <Circle key="pe" x={c.x} y={c.y} radius={7} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />
          })()}

          {/* Trace animation — glowing dot on current cell */}
          {traceRunning && (() => {
            const { routeIdx, cellIdx } = traceStep
            const route = traceRoutes[routeIdx]
            if (!route || cellIdx >= route.pathIds.length) return null
            const c = cellCenters.get(route.pathIds[cellIdx])
            if (!c) return null
            return (
              <>
                <Circle x={c.x} y={c.y} radius={10}
                  fill={route.color} opacity={0.3}
                  shadowColor={route.color} shadowBlur={20} shadowOpacity={1} />
                <Circle x={c.x} y={c.y} radius={5}
                  fill={route.color} stroke="#fff" strokeWidth={1.5}
                  shadowColor={route.color} shadowBlur={10} shadowOpacity={1} />
              </>
            )
          })()}
        </Group>
      </Layer>
    </Stage>
  )
}
