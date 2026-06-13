import type React from 'react'
import type Konva from 'konva'
import { Rect, RegularPolygon, Line, Circle } from 'react-konva'
import type { CellShape, GridCell } from '@naxa/core'
import { HEX_RADIUS, RECT_W, RECT_H, SQUARE_SIZE } from '../../lib/grid/geometry'

interface Pt { x: number; y: number }

// ── Hover highlight ────────────────────────────────────────────────────────────

interface HoverHighlightProps {
  hoverCenter: Pt | null | undefined
  shape: CellShape
}

function HoverHighlight({ hoverCenter, shape }: HoverHighlightProps) {
  if (!hoverCenter) return null
  if (shape === 'hexagon') {
    return (
      <RegularPolygon
        x={hoverCenter.x} y={hoverCenter.y}
        sides={6} radius={HEX_RADIUS - 1}
        fill="transparent" stroke="#60a5fa" strokeWidth={2}
      />
    )
  }
  const w = shape === 'rectangle' ? RECT_W : SQUARE_SIZE
  const h = shape === 'rectangle' ? RECT_H : SQUARE_SIZE
  return (
    <Rect
      x={hoverCenter.x - w / 2 + 1} y={hoverCenter.y - h / 2 + 1}
      width={w - 2} height={h - 2}
      cornerRadius={4}
      fill="transparent" stroke="#60a5fa" strokeWidth={2}
    />
  )
}

// ── Selection overlay (selection rect drag + cell highlights) ──────────────────

interface SelectionOverlayProps {
  previewLineRef: React.RefObject<Konva.Line>
  selectionRectRef: React.RefObject<Konva.Rect>
  selection: Set<string>
  cells: GridCell[]
  cellCenters: Map<string, Pt>
  shape: CellShape
}

function SelectionOverlay({
  previewLineRef, selectionRectRef, selection, cells, cellCenters, shape,
}: SelectionOverlayProps) {
  const w = shape === 'rectangle' ? RECT_W : SQUARE_SIZE
  const h = shape === 'rectangle' ? RECT_H : SQUARE_SIZE
  return (
    <>
      <Line ref={previewLineRef} points={[0, 0, 0, 0]} visible={false}
        stroke="#60a5fa" strokeWidth={2} dash={[6, 4]} opacity={0.7} />

      <Rect
        ref={selectionRectRef}
        visible={false}
        x={0} y={0} width={0} height={0}
        fill="rgba(96,165,250,0.08)"
        stroke="#60a5fa" strokeWidth={1}
        dash={[6, 3]}
      />

      {selection.size > 0 && cells.filter(c => selection.has(c.id)).map(c => {
        const center = cellCenters.get(c.id)
        if (!center) return null
        return shape === 'hexagon'
          ? <RegularPolygon key={`sel-${c.id}`}
              x={center.x} y={center.y}
              sides={6} radius={HEX_RADIUS - 1}
              fill="rgba(96,165,250,0.22)" stroke="#60a5fa" strokeWidth={1.5}
            />
          : <Rect key={`sel-${c.id}`}
              x={center.x - w / 2 + 1} y={center.y - h / 2 + 1}
              width={w - 2} height={h - 2}
              cornerRadius={shape === 'square' ? 4 : 2}
              fill="rgba(96,165,250,0.22)" stroke="#60a5fa" strokeWidth={1.5}
            />
      })}
    </>
  )
}

// ── Path markers (BFS start/end pins) ─────────────────────────────────────────

interface PathOverlayProps {
  pathStart: string | null
  pathEnd: string | null
  cellCenters: Map<string, Pt>
}

function PathOverlay({ pathStart, pathEnd, cellCenters }: PathOverlayProps) {
  const sc = pathStart ? cellCenters.get(pathStart) : null
  const ec = pathEnd   ? cellCenters.get(pathEnd)   : null
  return (
    <>
      {sc && <Circle key="ps" x={sc.x} y={sc.y} radius={7} fill="#10b981" stroke="#fff" strokeWidth={1.5} />}
      {ec && <Circle key="pe" x={ec.x} y={ec.y} radius={7} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />}
    </>
  )
}

// ── Trace overlay (animated robot cursor + route start/end) ────────────────────

interface TraceOverlayProps {
  active: boolean
  color: string
  startCenter: Pt | null | undefined
  endCenter: Pt | null | undefined
  curCenter: Pt | null | undefined
}

function TraceOverlay({ active, color, startCenter, endCenter, curCenter }: TraceOverlayProps) {
  if (!active) return null
  return (
    <>
      {startCenter && (
        <Circle x={startCenter.x} y={startCenter.y} radius={7}
          fill={color} stroke="#fff" strokeWidth={1.5} opacity={0.85} />
      )}
      {endCenter && endCenter !== startCenter && (
        <Circle x={endCenter.x} y={endCenter.y} radius={7}
          fill="transparent" stroke={color} strokeWidth={2.5} opacity={0.85} />
      )}
      {curCenter && (
        <>
          <Circle x={curCenter.x} y={curCenter.y} radius={10}
            fill={color} opacity={0.3}
            shadowColor={color} shadowBlur={20} shadowOpacity={1} />
          <Circle x={curCenter.x} y={curCenter.y} radius={5}
            fill={color} stroke="#fff" strokeWidth={1.5}
            shadowColor={color} shadowBlur={10} shadowOpacity={1} />
        </>
      )}
    </>
  )
}

// ── Combined export ────────────────────────────────────────────────────────────

export interface CanvasOverlayProps {
  previewLineRef: React.RefObject<Konva.Line>
  selectionRectRef: React.RefObject<Konva.Rect>
  hoverCenter: Pt | null | undefined
  shape: CellShape
  selection: Set<string>
  cells: GridCell[]
  cellCenters: Map<string, Pt>
  pathStart: string | null
  pathEnd: string | null
  traceActive: boolean
  traceColor: string
  traceStartCenter: Pt | null | undefined
  traceEndCenter: Pt | null | undefined
  traceCurCenter: Pt | null | undefined
}

export default function CanvasOverlay({
  previewLineRef, selectionRectRef,
  hoverCenter, shape,
  selection, cells, cellCenters,
  pathStart, pathEnd,
  traceActive, traceColor, traceStartCenter, traceEndCenter, traceCurCenter,
}: CanvasOverlayProps) {
  return (
    <>
      <HoverHighlight hoverCenter={hoverCenter} shape={shape} />
      <SelectionOverlay
        previewLineRef={previewLineRef} selectionRectRef={selectionRectRef}
        selection={selection} cells={cells} cellCenters={cellCenters} shape={shape}
      />
      <PathOverlay pathStart={pathStart} pathEnd={pathEnd} cellCenters={cellCenters} />
      <TraceOverlay
        active={traceActive} color={traceColor}
        startCenter={traceStartCenter} endCenter={traceEndCenter} curCenter={traceCurCenter}
      />
    </>
  )
}
