/**
 * Performance regression tests.
 *
 * These guard against the class of slowdowns where adding more typed cells to
 * a map causes subsequent interactions to degrade non-linearly.
 *
 * Root causes previously identified and fixed:
 *   1. cellCenters useMemo depended on map.cells (O(n) rebuild on every paint).
 *      Fixed: dep is now map.config only; centres are computed from grid dims.
 *   2. Canvas shadowBlur on every typed cell forces an off-screen compositing
 *      pass per shape.  Fixed: shadows removed from regular typed cells.
 *
 * Thresholds are generous (10× typical measured time) so CI machines with
 * different hardware don't produce flaky results.  The point is to catch
 * O(n²) regressions, not to enforce absolute wall-clock limits.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useGridStore } from '../../store/gridStore'
import { floodFill } from '../../lib/grid/floodFill'
import type { GridConfig } from '@naxa/core'

// ── helpers ──────────────────────────────────────────────────────────────────

function freshGrid(rows: number, cols: number, cellShape: GridConfig['cellShape'] = 'square') {
  useGridStore.setState({
    map: null,
    savedList: [],
    history: [],
    historyIndex: -1,
  })
  useGridStore.getState().newMap('perf-test', { rows, cols, cellShape, cellSizeMeters: 1 })
}

function elapsed(fn: () => void): number {
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}

// ── setCellType on progressively larger grids ─────────────────────────────

describe('setCellType — single cell — O(1) regardless of map density', () => {
  it('is fast on a blank 10×10 grid', () => {
    freshGrid(10, 10)
    const map = useGridStore.getState().map!
    const cell = map.cells[0]
    const ms = elapsed(() => useGridStore.getState().setCellType(cell.id, 'source'))
    expect(ms).toBeLessThan(50)
  })

  it('is fast on a fully typed 50×50 grid (2500 cells)', () => {
    freshGrid(50, 50)
    // Paint all cells traversable so the map is "dense"
    const ids = useGridStore.getState().map!.cells.map(c => c.id)
    useGridStore.getState().setCellTypeBatch(ids, 'traversable')

    // Now type one more cell — must not degrade
    const targetId = useGridStore.getState().map!.cells[0].id
    const ms = elapsed(() => useGridStore.getState().setCellType(targetId, 'source'))
    expect(ms).toBeLessThan(50)
  })

  it('is fast on a fully typed 100×100 grid (10 000 cells)', () => {
    freshGrid(100, 100)
    const ids = useGridStore.getState().map!.cells.map(c => c.id)
    useGridStore.getState().setCellTypeBatch(ids, 'traversable')

    const targetId = useGridStore.getState().map!.cells[0].id
    const ms = elapsed(() => useGridStore.getState().setCellType(targetId, 'source'))
    expect(ms).toBeLessThan(120)
  })
})

// ── setCellTypeBatch — scales linearly ────────────────────────────────────

describe('setCellTypeBatch — scales linearly with cell count', () => {
  it('types 2500 cells (50×50) in under 100 ms', () => {
    freshGrid(50, 50)
    const ids = useGridStore.getState().map!.cells.map(c => c.id)
    const ms = elapsed(() => useGridStore.getState().setCellTypeBatch(ids, 'traversable'))
    expect(ms).toBeLessThan(100)
  })

  it('types 10 000 cells (100×100) in under 300 ms', () => {
    freshGrid(100, 100)
    const ids = useGridStore.getState().map!.cells.map(c => c.id)
    const ms = elapsed(() => useGridStore.getState().setCellTypeBatch(ids, 'traversable'))
    expect(ms).toBeLessThan(300)
  })

  it('batch is faster than N individual setCellType calls on a 20×20 grid', () => {
    // Individual calls
    freshGrid(20, 20)
    const ids1 = useGridStore.getState().map!.cells.map(c => c.id)
    const individual = elapsed(() => {
      for (const id of ids1) useGridStore.getState().setCellType(id, 'traversable')
    })

    // Batch call
    freshGrid(20, 20)
    const ids2 = useGridStore.getState().map!.cells.map(c => c.id)
    const batch = elapsed(() => useGridStore.getState().setCellTypeBatch(ids2, 'traversable'))

    // Batch must be meaningfully faster (at least 3×)
    expect(batch * 3).toBeLessThan(individual)
  })
})

// ── floodFill — BFS scales O(n) ──────────────────────────────────────────

describe('floodFill — BFS performance', () => {
  it('fills 2500-cell uniform grid (50×50 square) in under 50 ms', () => {
    freshGrid(50, 50)
    const { cells, config } = useGridStore.getState().map!
    const ms = elapsed(() => floodFill(0, 0, cells, config))
    expect(ms).toBeLessThan(50)
  })

  it('fills 10 000-cell uniform grid (100×100 square) in under 80 ms', () => {
    freshGrid(100, 100)
    const { cells, config } = useGridStore.getState().map!
    const ms = elapsed(() => floodFill(0, 0, cells, config))
    expect(ms).toBeLessThan(80)
  })

  it('fills 2500-cell uniform hex grid (50×50) in under 40 ms', () => {
    freshGrid(50, 50, 'hexagon')
    const { cells, config } = useGridStore.getState().map!
    const ms = elapsed(() => floodFill(0, 0, cells, config))
    expect(ms).toBeLessThan(40)
  })

  it('flood-fill time grows sub-quadratically: 4× cells → <8× time', () => {
    freshGrid(25, 25)
    const small = useGridStore.getState().map!
    const t25 = elapsed(() => floodFill(0, 0, small.cells, small.config))

    freshGrid(50, 50)
    const large = useGridStore.getState().map!
    const t50 = elapsed(() => floodFill(0, 0, large.cells, large.config))

    // 4× cells should not produce 8× time (would indicate O(n²) behaviour)
    if (t25 > 0.1) {
      expect(t50).toBeLessThan(t25 * 8)
    }
    // Always check absolute bound too
    expect(t50).toBeLessThan(20)
  })
})

// ── undo / redo with history ──────────────────────────────────────────────

describe('undo / redo — O(1) regardless of history depth', () => {
  it('undo is fast after 50 paint operations', () => {
    freshGrid(10, 10)
    const cells = useGridStore.getState().map!.cells.slice(0, 50)
    // Build up 50 history entries
    for (const cell of cells) {
      useGridStore.getState().snapshotNow()
      useGridStore.getState().setCellType(cell.id, 'source')
    }

    const ms = elapsed(() => useGridStore.getState().undo())
    expect(ms).toBeLessThan(50)
  })

  it('redo is fast after 50 operations followed by 50 undos', () => {
    freshGrid(10, 10)
    const cells = useGridStore.getState().map!.cells.slice(0, 50)
    for (const cell of cells) {
      useGridStore.getState().snapshotNow()
      useGridStore.getState().setCellType(cell.id, 'source')
    }
    // Undo all 50
    for (let i = 0; i < 50; i++) useGridStore.getState().undo()

    const ms = elapsed(() => useGridStore.getState().redo())
    expect(ms).toBeLessThan(50)
  })
})
