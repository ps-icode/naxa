import { describe, it, expect } from 'vitest'
import type { GridConfig } from '@naxa/core'
import {
  getCellCenter,
  getCellDimensions,
  posToCell,
  isAdjacent,
  getDirection,
  totalCanvasSize,
  distToSegment,
  SQUARE_SIZE,
  RECT_W,
  RECT_H,
  HEX_RADIUS,
  GRID_PADDING,
} from '../../lib/grid/geometry'

const HEX_W = Math.sqrt(3) * HEX_RADIUS

const squareCfg: GridConfig = { rows: 5, cols: 5, cellShape: 'square', cellSizeMeters: 1 }
const rectCfg: GridConfig = { rows: 5, cols: 5, cellShape: 'rectangle', cellSizeMeters: 1 }
const hexCfg: GridConfig = { rows: 5, cols: 5, cellShape: 'hexagon', cellSizeMeters: 1 }

// ── getCellCenter ─────────────────────────────────────────────────────────────

describe('getCellCenter', () => {
  describe('square', () => {
    it('origin cell (0,0)', () => {
      expect(getCellCenter({ row: 0, col: 0 }, squareCfg)).toEqual({
        x: GRID_PADDING + SQUARE_SIZE / 2,
        y: GRID_PADDING + SQUARE_SIZE / 2,
      })
    })

    it('non-origin cell (1,2)', () => {
      expect(getCellCenter({ row: 1, col: 2 }, squareCfg)).toEqual({
        x: GRID_PADDING + 2 * SQUARE_SIZE + SQUARE_SIZE / 2,
        y: GRID_PADDING + 1 * SQUARE_SIZE + SQUARE_SIZE / 2,
      })
    })
  })

  describe('rectangle', () => {
    it('origin cell (0,0)', () => {
      expect(getCellCenter({ row: 0, col: 0 }, rectCfg)).toEqual({
        x: GRID_PADDING + RECT_W / 2,
        y: GRID_PADDING + RECT_H / 2,
      })
    })

    it('non-origin cell (2,1)', () => {
      expect(getCellCenter({ row: 2, col: 1 }, rectCfg)).toEqual({
        x: GRID_PADDING + 1 * RECT_W + RECT_W / 2,
        y: GRID_PADDING + 2 * RECT_H + RECT_H / 2,
      })
    })
  })

  describe('hexagon', () => {
    it('even-row origin cell (0,0) has no col offset', () => {
      const { x, y } = getCellCenter({ row: 0, col: 0 }, hexCfg)
      expect(x).toBeCloseTo(GRID_PADDING + HEX_W / 2)
      expect(y).toBeCloseTo(GRID_PADDING + HEX_RADIUS)
    })

    it('odd-row cell (1,0) is offset right by HEX_W/2', () => {
      const evenX = getCellCenter({ row: 0, col: 0 }, hexCfg).x
      const oddX = getCellCenter({ row: 1, col: 0 }, hexCfg).x
      expect(oddX).toBeCloseTo(evenX + HEX_W / 2)
    })

    it('col offset accumulates correctly', () => {
      const col0 = getCellCenter({ row: 0, col: 0 }, hexCfg).x
      const col1 = getCellCenter({ row: 0, col: 1 }, hexCfg).x
      expect(col1 - col0).toBeCloseTo(HEX_W)
    })
  })
})

// ── getCellDimensions ─────────────────────────────────────────────────────────

describe('getCellDimensions', () => {
  it('square', () => {
    expect(getCellDimensions('square')).toEqual({ w: SQUARE_SIZE, h: SQUARE_SIZE })
  })

  it('rectangle', () => {
    expect(getCellDimensions('rectangle')).toEqual({ w: RECT_W, h: RECT_H })
  })

  it('hexagon', () => {
    const { w, h } = getCellDimensions('hexagon')
    expect(w).toBeCloseTo(HEX_W)
    expect(h).toBeCloseTo(2 * HEX_RADIUS)
  })
})

// ── posToCell ─────────────────────────────────────────────────────────────────

describe('posToCell', () => {
  describe('square', () => {
    it('center of origin cell → (0,0)', () => {
      const cx = GRID_PADDING + SQUARE_SIZE / 2
      const cy = GRID_PADDING + SQUARE_SIZE / 2
      expect(posToCell(cx, cy, squareCfg)).toEqual({ row: 0, col: 0 })
    })

    it('center of (1,2) → (1,2)', () => {
      const cx = GRID_PADDING + 2 * SQUARE_SIZE + SQUARE_SIZE / 2
      const cy = GRID_PADDING + 1 * SQUARE_SIZE + SQUARE_SIZE / 2
      expect(posToCell(cx, cy, squareCfg)).toEqual({ row: 1, col: 2 })
    })

    it('outside grid → null', () => {
      expect(posToCell(-1, -1, squareCfg)).toBeNull()
    })
  })

  describe('rectangle', () => {
    it('center of (1,1) → (1,1)', () => {
      const cx = GRID_PADDING + RECT_W + RECT_W / 2
      const cy = GRID_PADDING + RECT_H + RECT_H / 2
      expect(posToCell(cx, cy, rectCfg)).toEqual({ row: 1, col: 1 })
    })

    it('outside grid → null', () => {
      expect(posToCell(0, 0, rectCfg)).toBeNull()
    })
  })

  describe('hexagon', () => {
    it('center of even-row cell (0,0) → (0,0)', () => {
      const center = getCellCenter({ row: 0, col: 0 }, hexCfg)
      expect(posToCell(center.x, center.y, hexCfg)).toEqual({ row: 0, col: 0 })
    })

    it('center of odd-row cell (1,1) → (1,1)', () => {
      const center = getCellCenter({ row: 1, col: 1 }, hexCfg)
      expect(posToCell(center.x, center.y, hexCfg)).toEqual({ row: 1, col: 1 })
    })

    it('far outside grid → null', () => {
      expect(posToCell(-100, -100, hexCfg)).toBeNull()
    })
  })
})

// ── isAdjacent ────────────────────────────────────────────────────────────────

describe('isAdjacent', () => {
  describe('square', () => {
    it('orthogonally adjacent (right)', () => {
      expect(isAdjacent({ row: 0, col: 0 }, { row: 0, col: 1 }, 'square')).toBe(true)
    })

    it('orthogonally adjacent (down)', () => {
      expect(isAdjacent({ row: 0, col: 0 }, { row: 1, col: 0 }, 'square')).toBe(true)
    })

    it('diagonally adjacent', () => {
      expect(isAdjacent({ row: 0, col: 0 }, { row: 1, col: 1 }, 'square')).toBe(true)
    })

    it('same cell → false', () => {
      expect(isAdjacent({ row: 0, col: 0 }, { row: 0, col: 0 }, 'square')).toBe(false)
    })

    it('2 steps away → false', () => {
      expect(isAdjacent({ row: 0, col: 0 }, { row: 2, col: 0 }, 'square')).toBe(false)
    })
  })

  describe('hexagon', () => {
    it('valid hex neighbor for even row', () => {
      // Even row (2) offsets include [0,1] (E) and [-1,0] (NE)
      expect(isAdjacent({ row: 2, col: 2 }, { row: 2, col: 3 }, 'hexagon')).toBe(true)
      expect(isAdjacent({ row: 2, col: 2 }, { row: 1, col: 2 }, 'hexagon')).toBe(true)
    })

    it('valid hex neighbor for odd row', () => {
      // Odd row (1) offsets include [-1,1] (NE) and [0,1] (E)
      expect(isAdjacent({ row: 1, col: 1 }, { row: 0, col: 2 }, 'hexagon')).toBe(true)
    })

    it('hex has 6 neighbors, not 8 — diagonal-in-square-sense is not adjacent', () => {
      // For even row, [-1,+1] is NOT a valid hex neighbor
      expect(isAdjacent({ row: 2, col: 2 }, { row: 1, col: 3 }, 'hexagon')).toBe(false)
    })

    it('non-adjacent cells', () => {
      expect(isAdjacent({ row: 0, col: 0 }, { row: 2, col: 2 }, 'hexagon')).toBe(false)
    })
  })
})

// ── getDirection ──────────────────────────────────────────────────────────────

describe('getDirection', () => {
  describe('square', () => {
    it('E: dc=+1', () => expect(getDirection({ row: 0, col: 0 }, { row: 0, col: 1 }, 'square')).toBe('E'))
    it('W: dc=-1', () => expect(getDirection({ row: 0, col: 1 }, { row: 0, col: 0 }, 'square')).toBe('W'))
    it('S: dr=+1', () => expect(getDirection({ row: 0, col: 0 }, { row: 1, col: 0 }, 'square')).toBe('S'))
    it('N: dr=-1', () => expect(getDirection({ row: 1, col: 0 }, { row: 0, col: 0 }, 'square')).toBe('N'))
    it('NE: dr=-1,dc=+1', () => expect(getDirection({ row: 1, col: 0 }, { row: 0, col: 1 }, 'square')).toBe('NE'))
    it('NW: dr=-1,dc=-1', () => expect(getDirection({ row: 1, col: 1 }, { row: 0, col: 0 }, 'square')).toBe('NW'))
    it('SE: dr=+1,dc=+1', () => expect(getDirection({ row: 0, col: 0 }, { row: 1, col: 1 }, 'square')).toBe('SE'))
    it('SW: dr=+1,dc=-1', () => expect(getDirection({ row: 0, col: 1 }, { row: 1, col: 0 }, 'square')).toBe('SW'))
  })

  describe('hexagon', () => {
    it('even-row E: [0,+1]', () => {
      // Even row offsets: NE=[-1,0], E=[0,1], SE=[1,0], SW=[1,-1], W=[0,-1], NW=[-1,-1]
      expect(getDirection({ row: 0, col: 0 }, { row: 0, col: 1 }, 'hexagon')).toBe('E')
    })

    it('even-row NW: [-1,-1]', () => {
      expect(getDirection({ row: 2, col: 2 }, { row: 1, col: 1 }, 'hexagon')).toBe('NW')
    })

    it('odd-row NE: [-1,+1]', () => {
      // Odd row offsets: NE=[-1,1], E=[0,1], SE=[1,1], SW=[1,0], W=[0,-1], NW=[-1,0]
      expect(getDirection({ row: 1, col: 0 }, { row: 0, col: 1 }, 'hexagon')).toBe('NE')
    })

    it('falls back to E for a non-neighbor hex movement', () => {
      // [+2,+2] is not a valid hex neighbor offset → idx < 0 → default 'E'
      expect(getDirection({ row: 0, col: 0 }, { row: 2, col: 2 }, 'hexagon')).toBe('E')
    })
  })
})

// ── distToSegment ─────────────────────────────────────────────────────────────

describe('distToSegment', () => {
  it('point on segment → 0', () => {
    expect(distToSegment(5, 0, 0, 0, 10, 0)).toBeCloseTo(0)
  })

  it('point perpendicular to segment midpoint', () => {
    expect(distToSegment(5, 3, 0, 0, 10, 0)).toBeCloseTo(3)
  })

  it('zero-length segment → distance to endpoint', () => {
    // lenSq === 0 branch: falls back to Math.hypot(px-x1, py-y1)
    expect(distToSegment(3, 4, 0, 0, 0, 0)).toBeCloseTo(5)
  })

  it('point past end of segment clamps to endpoint', () => {
    // t is clamped to 1, so dist = distance to (10,0)
    expect(distToSegment(15, 0, 0, 0, 10, 0)).toBeCloseTo(5)
  })
})

// ── totalCanvasSize ───────────────────────────────────────────────────────────

describe('totalCanvasSize', () => {
  it('square', () => {
    const cfg: GridConfig = { rows: 3, cols: 4, cellShape: 'square', cellSizeMeters: 1 }
    expect(totalCanvasSize(cfg)).toEqual({
      w: GRID_PADDING * 2 + 4 * SQUARE_SIZE,
      h: GRID_PADDING * 2 + 3 * SQUARE_SIZE,
    })
  })

  it('rectangle', () => {
    const cfg: GridConfig = { rows: 2, cols: 3, cellShape: 'rectangle', cellSizeMeters: 1 }
    expect(totalCanvasSize(cfg)).toEqual({
      w: GRID_PADDING * 2 + 3 * RECT_W,
      h: GRID_PADDING * 2 + 2 * RECT_H,
    })
  })

  it('hexagon', () => {
    const cfg: GridConfig = { rows: 3, cols: 4, cellShape: 'hexagon', cellSizeMeters: 1 }
    const result = totalCanvasSize(cfg)
    expect(result.w).toBeCloseTo(GRID_PADDING * 2 + 4 * HEX_W + HEX_W / 2 + 10)
    expect(result.h).toBeCloseTo(GRID_PADDING * 2 + 3 * HEX_RADIUS * 1.5 + HEX_RADIUS + 10)
  })
})
