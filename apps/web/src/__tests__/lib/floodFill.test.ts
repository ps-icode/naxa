import { describe, it, expect } from 'vitest'
import type { GridCell, GridConfig } from '@naxa/core'
import { floodFill } from '../../lib/grid/floodFill'

// unassigned = default/empty cell (no nodeType assigned by user) — floodable
function u(row: number, col: number): GridCell {
  return { id: `r${row}c${col}`, coord: { row, col }, nodeType: 'blocked', assigned: false }
}

// assigned = explicitly typed cell (any nodeType) — stops flood
function a(row: number, col: number, nodeType: GridCell['nodeType'] = 'source'): GridCell {
  return { id: `r${row}c${col}`, coord: { row, col }, nodeType, assigned: true }
}

const squareCfg = (rows: number, cols: number): GridConfig =>
  ({ rows, cols, cellShape: 'square', cellSizeMeters: 1 })

const hexCfg = (rows: number, cols: number): GridConfig =>
  ({ rows, cols, cellShape: 'hexagon', cellSizeMeters: 1 })

const rectCfg = (rows: number, cols: number): GridConfig =>
  ({ rows, cols, cellShape: 'rectangle', cellSizeMeters: 1 })

// ── square grid — basic flooding through unassigned cells ────────────────────

describe('floodFill — square grid', () => {
  it('fills entire grid of unassigned cells from any start', () => {
    const cfg = squareCfg(2, 2)
    const cells = [u(0,0), u(0,1), u(1,0), u(1,1)]
    const result = floodFill(0, 0, cells, cfg)
    expect(result.sort()).toEqual(['r0c0', 'r0c1', 'r1c0', 'r1c1'].sort())
  })

  it('stops at assigned cell boundaries', () => {
    const cfg = squareCfg(3, 3)
    // (0,0),(0,1),(1,0) are unassigned; rest are assigned
    const cells = [
      u(0,0), u(0,1), a(0,2),
      u(1,0), a(1,1), a(1,2),
      a(2,0), a(2,1), a(2,2),
    ]
    const result = floodFill(0, 0, cells, cfg)
    expect(result.sort()).toEqual(['r0c0', 'r0c1', 'r1c0'].sort())
  })

  it('returns [] when start cell is assigned', () => {
    const cfg = squareCfg(3, 3)
    const cells = [
      u(0,0), u(0,1), u(0,2),
      u(1,0), a(1,1), u(1,2),
      u(2,0), u(2,1), u(2,2),
    ]
    expect(floodFill(1, 1, cells, cfg)).toEqual([])
  })

  it('returns [] for out-of-bounds start coordinates', () => {
    const cfg = squareCfg(2, 2)
    const cells = [u(0,0), u(0,1), u(1,0), u(1,1)]
    expect(floodFill(5, 5, cells, cfg)).toEqual([])
  })

  it('uses 4-connectivity (does not flood through diagonal-only gap)', () => {
    const cfg = squareCfg(3, 3)
    // (0,0) and (2,2) both unassigned but only connected diagonally
    const cells = [
      u(0,0), a(0,1), a(0,2),
      a(1,0), a(1,1), a(1,2),
      a(2,0), a(2,1), u(2,2),
    ]
    const result = floodFill(0, 0, cells, cfg)
    expect(result).toEqual(['r0c0'])
  })

  it('isolated unassigned cell returns just itself', () => {
    const cfg = squareCfg(1, 1)
    const cells = [u(0,0)]
    expect(floodFill(0, 0, cells, cfg)).toEqual(['r0c0'])
  })

  it('unassigned cell surrounded by assigned cells returns just itself', () => {
    const cfg = squareCfg(3, 3)
    const cells = [
      a(0,0), a(0,1), a(0,2),
      a(1,0), u(1,1), a(1,2),
      a(2,0), a(2,1), a(2,2),
    ]
    expect(floodFill(1, 1, cells, cfg)).toEqual(['r1c1'])
  })

  it('works for rectangle cellShape (same 4-connectivity)', () => {
    const cfg = rectCfg(2, 3)
    const cells = [
      u(0,0), u(0,1), a(0,2),
      u(1,0), a(1,1), a(1,2),
    ]
    const result = floodFill(0, 0, cells, cfg)
    expect(result.sort()).toEqual(['r0c0', 'r0c1', 'r1c0'].sort())
  })

  it('explicitly-blocked assigned cells act as walls', () => {
    const cfg = squareCfg(3, 1)
    const cells = [
      u(0,0),
      a(1,0, 'blocked'),
      u(2,0),
    ]
    // Flood from (0,0) — (1,0) has assigned=true so it blocks
    expect(floodFill(0, 0, cells, cfg)).toEqual(['r0c0'])
  })
})

// ── hexagon grid ─────────────────────────────────────────────────────────────

describe('floodFill — hexagon grid', () => {
  it('floods all unassigned in 6-connected even row', () => {
    // Row 0 (even): in-bounds hex neighbors of (0,0) are E=(0,1) and SE=(1,0)
    const cfg = hexCfg(3, 3)
    const cells = [
      u(0,0), u(0,1), a(0,2),
      u(1,0), a(1,1), a(1,2),
      a(2,0), a(2,1), a(2,2),
    ]
    const result = floodFill(0, 0, cells, cfg)
    expect(result.sort()).toEqual(['r0c0', 'r0c1', 'r1c0'].sort())
  })

  it('floods all 9 cells when entire hex grid is unassigned', () => {
    const cfg = hexCfg(3, 3)
    const cells = [
      u(0,0), u(0,1), u(0,2),
      u(1,0), u(1,1), u(1,2),
      u(2,0), u(2,1), u(2,2),
    ]
    const result = floodFill(1, 0, cells, cfg)
    expect(result.length).toBe(9)
  })

  it('stops at assigned cells using hex connectivity', () => {
    const cfg = hexCfg(2, 2)
    const cells = [
      u(0,0), a(0,1),
      a(1,0), a(1,1),
    ]
    expect(floodFill(0, 0, cells, cfg)).toEqual(['r0c0'])
  })

  it('returns [] when start cell is assigned in hex grid', () => {
    const cfg = hexCfg(2, 2)
    const cells = [a(0,0), u(0,1), u(1,0), u(1,1)]
    expect(floodFill(0, 0, cells, cfg)).toEqual([])
  })
})

// ── edge cases ────────────────────────────────────────────────────────────────

describe('floodFill — edge cases', () => {
  it('1×1 grid with unassigned cell returns that cell', () => {
    const cfg = squareCfg(1, 1)
    expect(floodFill(0, 0, [u(0,0)], cfg)).toEqual(['r0c0'])
  })

  it('1×1 grid with assigned cell returns []', () => {
    const cfg = squareCfg(1, 1)
    expect(floodFill(0, 0, [a(0,0)], cfg)).toEqual([])
  })

  it('cells without assigned field (undefined) are treated as unassigned', () => {
    const cfg = squareCfg(2, 1)
    // No assigned field — backwards compat: treated as unassigned
    const cells: GridCell[] = [
      { id: 'r0c0', coord: { row: 0, col: 0 }, nodeType: 'blocked' },
      { id: 'r1c0', coord: { row: 1, col: 0 }, nodeType: 'blocked' },
    ]
    const result = floodFill(0, 0, cells, cfg)
    expect(result.sort()).toEqual(['r0c0', 'r1c0'].sort())
  })
})
