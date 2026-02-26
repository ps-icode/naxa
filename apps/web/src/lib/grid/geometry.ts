import type { CellCoord, GridConfig, Direction, CellShape } from '@naxa/core'

export const SQUARE_SIZE = 56
export const RECT_W = 84
export const RECT_H = 42
export const HEX_RADIUS = 30
export const GRID_PADDING = 40

const HEX_W = Math.sqrt(3) * HEX_RADIUS  // ≈ 51.96
const HEX_H = 2 * HEX_RADIUS              // 60

export function getCellCenter(coord: CellCoord, config: GridConfig): { x: number; y: number } {
  const { row, col } = coord
  if (config.cellShape === 'hexagon') {
    const x = GRID_PADDING + HEX_W / 2 + col * HEX_W + (row % 2 === 1 ? HEX_W / 2 : 0)
    const y = GRID_PADDING + HEX_RADIUS + row * HEX_RADIUS * 1.5
    return { x, y }
  }
  if (config.cellShape === 'rectangle') {
    return {
      x: GRID_PADDING + col * RECT_W + RECT_W / 2,
      y: GRID_PADDING + row * RECT_H + RECT_H / 2,
    }
  }
  return {
    x: GRID_PADDING + col * SQUARE_SIZE + SQUARE_SIZE / 2,
    y: GRID_PADDING + row * SQUARE_SIZE + SQUARE_SIZE / 2,
  }
}

export function getCellDimensions(shape: CellShape): { w: number; h: number } {
  if (shape === 'hexagon') return { w: HEX_W, h: HEX_H }
  if (shape === 'rectangle') return { w: RECT_W, h: RECT_H }
  return { w: SQUARE_SIZE, h: SQUARE_SIZE }
}

export function posToCell(px: number, py: number, config: GridConfig): CellCoord | null {
  const { rows, cols, cellShape } = config

  if (cellShape === 'hexagon') {
    // No closed-form inverse exists for offset hex grids: a pixel can lie in the
    // overlap zone of up to 3 neighboring cells depending on row parity.
    // We approximate the target row, then search a 3×3 candidate window and pick
    // the cell whose center is closest to the hit point.
    const rowApprox = Math.round((py - GRID_PADDING - HEX_RADIUS) / (HEX_RADIUS * 1.5))
    let best: CellCoord | null = null
    let bestDist = HEX_RADIUS + 2

    for (let row = Math.max(0, rowApprox - 1); row <= Math.min(rows - 1, rowApprox + 1); row++) {
      const xOffset = row % 2 === 1 ? HEX_W / 2 : 0
      const colApprox = Math.round((px - GRID_PADDING - HEX_W / 2 - xOffset) / HEX_W)
      for (let col = Math.max(0, colApprox - 1); col <= Math.min(cols - 1, colApprox + 1); col++) {
        const c = getCellCenter({ row, col }, config)
        const dist = Math.hypot(px - c.x, py - c.y)
        if (dist < bestDist) { bestDist = dist; best = { row, col } }
      }
    }
    return best
  }

  const { w, h } = getCellDimensions(cellShape)
  const col = Math.floor((px - GRID_PADDING) / w)
  const row = Math.floor((py - GRID_PADDING) / h)
  if (row >= 0 && row < rows && col >= 0 && col < cols) return { row, col }
  return null
}

export function isAdjacent(a: CellCoord, b: CellCoord, shape: CellShape): boolean {
  const dr = b.row - a.row
  const dc = b.col - a.col
  if (shape === 'hexagon') {
    // Hex cells have exactly 6 neighbors (not 8); the valid set depends on row parity.
    return getHexNeighborOffsets(a.row).some(([nr, nc]) => nr === dr && nc === dc)
  }
  return Math.abs(dr) <= 1 && Math.abs(dc) <= 1 && !(dr === 0 && dc === 0)
}

export function getDirection(from: CellCoord, to: CellCoord, shape: CellShape): Direction {
  const dr = to.row - from.row
  const dc = to.col - from.col
  if (shape === 'hexagon') {
    const offsets = getHexNeighborOffsets(from.row)
    const names: Direction[] = ['NE', 'E', 'SE', 'SW', 'W', 'NW']
    const idx = offsets.findIndex(([r, c]) => r === dr && c === dc)
    return idx >= 0 ? names[idx] : 'E'
  }
  if (dr === 0 && dc === 1) return 'E'
  if (dr === 0 && dc === -1) return 'W'
  if (dr === 1 && dc === 0) return 'S'
  if (dr === -1 && dc === 0) return 'N'
  if (dr === -1 && dc === 1) return 'NE'
  if (dr === -1 && dc === -1) return 'NW'
  if (dr === 1 && dc === 1) return 'SE'
  return 'SW'
}

// Returns [dr, dc] offsets for all 6 hex neighbors in order [NE, E, SE, SW, W, NW].
// Even and odd rows use two alternating offset templates because flat-top offset grids
// shift every other row right by half a cell width.
function getHexNeighborOffsets(row: number): [number, number][] {
  if (row % 2 === 0) {
    return [[-1, 0], [0, 1], [1, 0], [1, -1], [0, -1], [-1, -1]]
  }
  return [[-1, 1], [0, 1], [1, 1], [1, 0], [0, -1], [-1, 0]]
}

export function distToSegment(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

export function totalCanvasSize(config: GridConfig): { w: number; h: number } {
  const { rows, cols, cellShape } = config
  if (cellShape === 'hexagon') {
    return {
      w: GRID_PADDING * 2 + cols * HEX_W + HEX_W / 2 + 10,
      h: GRID_PADDING * 2 + rows * HEX_RADIUS * 1.5 + HEX_RADIUS + 10,
    }
  }
  const { w, h } = getCellDimensions(cellShape)
  return { w: GRID_PADDING * 2 + cols * w, h: GRID_PADDING * 2 + rows * h }
}
