import { describe, it, expect } from 'vitest'
import type { GridCell, GridConfig } from '@naxa/core'
import { floodFill } from '../../lib/grid/floodFill'

function cell(row: number, col: number, nodeType: GridCell['nodeType'] = 'blocked'): GridCell {
  return { id: `r${row}c${col}`, coord: { row, col }, nodeType }
}

function makeGrid(rows: number, cols: number, cellShape: GridConfig['cellShape'], types: GridCell['nodeType'][][]): GridCell[] {
  const cells: GridCell[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(cell(r, c, types[r][c]))
    }
  }
  return cells
}

const squareCfg = (rows: number, cols: number): GridConfig =>
  ({ rows, cols, cellShape: 'square', cellSizeMeters: 1 })

const hexCfg = (rows: number, cols: number): GridConfig =>
  ({ rows, cols, cellShape: 'hexagon', cellSizeMeters: 1 })

const rectCfg = (rows: number, cols: number): GridConfig =>
  ({ rows, cols, cellShape: 'rectangle', cellSizeMeters: 1 })

// ── basic square grid ──────────────────────────────────────────────────────────

describe('floodFill — square grid', () => {
  it('returns just the start cell when surrounded by different types', () => {
    const cfg = squareCfg(3, 3)
    const cells = makeGrid(3, 3, 'square', [
      ['lane',    'blocked', 'blocked'],
      ['blocked', 'blocked', 'blocked'],
      ['blocked', 'blocked', 'blocked'],
    ])
    expect(floodFill(0, 0, cells, cfg)).toEqual(['r0c0'])
  })

  it('fills entire grid when all cells share the same type', () => {
    const cfg = squareCfg(2, 2)
    const cells = makeGrid(2, 2, 'square', [
      ['blocked', 'blocked'],
      ['blocked', 'blocked'],
    ])
    const result = floodFill(0, 0, cells, cfg)
    expect(result.sort()).toEqual(['r0c0', 'r0c1', 'r1c0', 'r1c1'].sort())
  })

  it('fills only the contiguous region matching start type', () => {
    const cfg = squareCfg(3, 3)
    const cells = makeGrid(3, 3, 'square', [
      ['blocked', 'blocked', 'lane'],
      ['blocked', 'lane',    'lane'],
      ['lane',    'lane',    'lane'],
    ])
    // Start at (0,0) blocked — only (0,0) and (0,1) and (1,0) are contiguous blocked
    const result = floodFill(0, 0, cells, cfg)
    expect(result.sort()).toEqual(['r0c0', 'r0c1', 'r1c0'].sort())
  })

  it('uses 4-connectivity (does not fill diagonal-only neighbors)', () => {
    const cfg = squareCfg(3, 3)
    // blocked at corners (0,0) and (2,2), connected only diagonally
    const cells = makeGrid(3, 3, 'square', [
      ['blocked', 'lane',    'lane'],
      ['lane',    'lane',    'lane'],
      ['lane',    'lane',    'blocked'],
    ])
    const result = floodFill(0, 0, cells, cfg)
    expect(result).toEqual(['r0c0'])  // (2,2) is NOT reached via diagonal
  })

  it('returns empty array for invalid start coordinates', () => {
    const cfg = squareCfg(2, 2)
    const cells = makeGrid(2, 2, 'square', [
      ['blocked', 'blocked'],
      ['blocked', 'blocked'],
    ])
    expect(floodFill(5, 5, cells, cfg)).toEqual([])
  })

  it('works for rectangle cellShape', () => {
    const cfg = rectCfg(2, 3)
    const cells = makeGrid(2, 3, 'rectangle', [
      ['lane', 'lane', 'blocked'],
      ['lane', 'blocked', 'blocked'],
    ])
    const result = floodFill(0, 0, cells, cfg)
    expect(result.sort()).toEqual(['r0c0', 'r0c1', 'r1c0'].sort())
  })
})

// ── hexagon grid ───────────────────────────────────────────────────────────────

describe('floodFill — hexagon grid', () => {
  it('uses 6-connectivity for even rows', () => {
    // Row 0 (even): neighbors of (0,0) are NE=(-1,0), E=(0,1), SE=(1,0), SW=(1,-1), W=(0,-1), NW=(-1,-1)
    // Only in-bounds: E=(0,1) and SE=(1,0)
    const cfg = hexCfg(3, 3)
    const cells = makeGrid(3, 3, 'hexagon', [
      ['blocked', 'blocked', 'lane'],
      ['blocked', 'lane',    'lane'],
      ['lane',    'lane',    'lane'],
    ])
    // (0,0) blocked → neighbors E=(0,1) blocked, SE=(1,0) blocked
    // (0,1) blocked → NE=(-1,1) OOB, E=(0,2)=lane, SE=(1,1)=lane, SW=(1,0), W=(0,0), NW=(-1,0) OOB
    // (1,0) blocked → NE=(-1+1,0+1)=(0,1), E=(1,1)=lane, SE=(2,1)=lane, SW=(2,0)=lane, W=(1,-1) OOB, NW=(0,0)
    // So fill: r0c0, r0c1, r1c0
    const result = floodFill(0, 0, cells, cfg)
    expect(result.sort()).toEqual(['r0c0', 'r0c1', 'r1c0'].sort())
  })

  it('uses correct offsets for odd rows', () => {
    // Row 1 (odd): neighbors of (1,0) are NE=(-1+1,0+1)=(0,1), E=(1,1), SE=(2,1), SW=(2,0), W=(1,-1) OOB, NW=(0,0)
    const cfg = hexCfg(3, 3)
    const all_blocked = makeGrid(3, 3, 'hexagon', [
      ['blocked', 'blocked', 'blocked'],
      ['blocked', 'blocked', 'blocked'],
      ['blocked', 'blocked', 'blocked'],
    ])
    const result = floodFill(1, 0, all_blocked, cfg)
    expect(result.length).toBe(9)  // all 9 cells connected
  })

  it('does not cross to cells of different type via hex neighbor', () => {
    const cfg = hexCfg(2, 2)
    const cells = makeGrid(2, 2, 'hexagon', [
      ['blocked', 'lane'],
      ['lane',    'lane'],
    ])
    expect(floodFill(0, 0, cells, cfg)).toEqual(['r0c0'])
  })
})

// ── single cell ───────────────────────────────────────────────────────────────

describe('floodFill — edge cases', () => {
  it('1×1 grid returns the single cell', () => {
    const cfg = squareCfg(1, 1)
    const cells = [cell(0, 0, 'source')]
    expect(floodFill(0, 0, cells, cfg)).toEqual(['r0c0'])
  })

  it('start cell is of unique type surrounded by different cells', () => {
    const cfg = squareCfg(3, 1)
    const cells = [
      cell(0, 0, 'blocked'),
      cell(1, 0, 'source'),
      cell(2, 0, 'blocked'),
    ]
    expect(floodFill(1, 0, cells, cfg)).toEqual(['r1c0'])
  })
})
