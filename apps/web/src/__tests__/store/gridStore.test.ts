import { describe, it, expect, beforeEach } from 'vitest'
import type { GridConfig } from '@naxa/core'
import { useGridStore } from '../../store/gridStore'

const BASE_CONFIG: GridConfig = { rows: 3, cols: 3, cellShape: 'square', cellSizeMeters: 1 }

function freshStore(): void {
  useGridStore.setState({ map: null, past: [], future: [], savedList: [] })
}

/** Look up a cell by grid coordinate instead of by ID (IDs are now UUIDs). */
function cellAt(row: number, col: number) {
  const cell = useGridStore.getState().map!.cells.find(
    c => c.coord.row === row && c.coord.col === col,
  )
  if (!cell) throw new Error(`No cell at (${row},${col})`)
  return cell
}

beforeEach(freshStore)

// ── newMap ────────────────────────────────────────────────────────────────────

describe('newMap', () => {
  it('creates rows×cols cells', () => {
    useGridStore.getState().newMap('Test', BASE_CONFIG)
    expect(useGridStore.getState().map!.cells).toHaveLength(9)
  })

  it('all cells start as blocked type', () => {
    useGridStore.getState().newMap('Test', BASE_CONFIG)
    expect(useGridStore.getState().map!.cells.every(c => c.nodeType === 'blocked')).toBe(true)
  })

  it('all cells start as unassigned (assigned: false)', () => {
    useGridStore.getState().newMap('Test', BASE_CONFIG)
    expect(useGridStore.getState().map!.cells.every(c => c.assigned === false)).toBe(true)
  })

  it('edge list starts empty', () => {
    useGridStore.getState().newMap('Test', BASE_CONFIG)
    expect(useGridStore.getState().map!.edges).toHaveLength(0)
  })

  it('clears undo/redo history', () => {
    useGridStore.setState({ past: [{ id: 'old' } as never], future: [{ id: 'old' } as never] })
    useGridStore.getState().newMap('Test', BASE_CONFIG)
    expect(useGridStore.getState().past).toHaveLength(0)
    expect(useGridStore.getState().future).toHaveLength(0)
  })
})

// ── loadMap / clearMap / updateMapName / setSavedList ─────────────────────────

describe('loadMap', () => {
  it('loads a map and clears history', () => {
    const map = { id: 'x', name: 'X', createdAt: '', updatedAt: '',
      config: BASE_CONFIG, cells: [], edges: [], layers: [] }
    useGridStore.getState().loadMap(map)
    expect(useGridStore.getState().map!.id).toBe('x')
    expect(useGridStore.getState().past).toHaveLength(0)
    expect(useGridStore.getState().future).toHaveLength(0)
  })

  it('migration v1→v2: non-blocked cell without assigned field gets assigned: true', () => {
    const map = { id: 'x', name: 'X', createdAt: '', updatedAt: '',
      config: BASE_CONFIG, edges: [], layers: [],
      cells: [{ id: 'r0c0', coord: { row: 0, col: 0 }, nodeType: 'source' as const }],
    }
    useGridStore.getState().loadMap(map)
    expect(useGridStore.getState().map!.cells[0].assigned).toBe(true)
  })

  it('migration v1→v2: blocked cell without assigned field gets assigned: false', () => {
    const map = { id: 'x', name: 'X', createdAt: '', updatedAt: '',
      config: BASE_CONFIG, edges: [], layers: [],
      cells: [{ id: 'r0c0', coord: { row: 0, col: 0 }, nodeType: 'blocked' as const }],
    }
    useGridStore.getState().loadMap(map)
    expect(useGridStore.getState().map!.cells[0].assigned).toBe(false)
  })

  it('migration v1→v2: cell with explicit assigned field is preserved', () => {
    const map = { id: 'x', name: 'X', createdAt: '', updatedAt: '',
      config: BASE_CONFIG, edges: [], layers: [],
      cells: [{ id: 'r0c0', coord: { row: 0, col: 0 }, nodeType: 'blocked' as const, assigned: true }],
    }
    useGridStore.getState().loadMap(map)
    expect(useGridStore.getState().map!.cells[0].assigned).toBe(true)
  })

  it('map at current schemaVersion skips all migrations', () => {
    const map = { id: 'x', name: 'X', createdAt: '', updatedAt: '',
      schemaVersion: 2 as const,
      config: BASE_CONFIG, edges: [], layers: [],
      cells: [{ id: 'r0c0', coord: { row: 0, col: 0 }, nodeType: 'source' as const, assigned: true }],
    }
    useGridStore.getState().loadMap(map)
    expect(useGridStore.getState().map!.schemaVersion).toBe(2)
    expect(useGridStore.getState().map!.cells[0].assigned).toBe(true)
  })
})

describe('clearMap', () => {
  it('sets map to null and clears history', () => {
    useGridStore.getState().newMap('Test', BASE_CONFIG)
    useGridStore.getState().clearMap()
    expect(useGridStore.getState().map).toBeNull()
    expect(useGridStore.getState().past).toHaveLength(0)
    expect(useGridStore.getState().future).toHaveLength(0)
  })
})

describe('updateMapName', () => {
  it('updates map name when map is set', () => {
    useGridStore.getState().newMap('Old', BASE_CONFIG)
    useGridStore.getState().updateMapName('New Name')
    expect(useGridStore.getState().map!.name).toBe('New Name')
  })

  it('is a no-op when map is null', () => {
    useGridStore.getState().updateMapName('Should not crash')
    expect(useGridStore.getState().map).toBeNull()
  })
})

describe('setSavedList', () => {
  it('sets the saved list', () => {
    const list = [{ id: '1', name: 'Map 1', updatedAt: '2024-01-01' }]
    useGridStore.getState().setSavedList(list)
    expect(useGridStore.getState().savedList).toEqual(list)
  })
})

// ── snapshotNow no-op when map is null ────────────────────────────────────────

describe('snapshotNow (no map)', () => {
  it('is a no-op when map is null', () => {
    useGridStore.getState().snapshotNow()
    expect(useGridStore.getState().past).toHaveLength(0)
  })
})

// ── setCellType ───────────────────────────────────────────────────────────────

describe('setCellType', () => {
  beforeEach(() => { useGridStore.getState().newMap('Test', BASE_CONFIG) })

  it('changes cell type', () => {
    useGridStore.getState().setCellType(cellAt(0, 0).id, 'source')
    expect(cellAt(0, 0).nodeType).toBe('source')
  })

  it('marks cell as assigned: true', () => {
    useGridStore.getState().setCellType(cellAt(0, 0).id, 'source')
    expect(cellAt(0, 0).assigned).toBe(true)
  })

  it('marks explicitly-blocked cell as assigned: true (distinguishes from default)', () => {
    useGridStore.getState().setCellType(cellAt(0, 0).id, 'blocked')
    expect(cellAt(0, 0).assigned).toBe(true)
  })

  it('resets subtype when type changes', () => {
    const id = cellAt(0, 0).id
    useGridStore.setState(s => ({
      map: { ...s.map!, cells: s.map!.cells.map(c => c.id === id ? { ...c, subtype: 'pick' } : c) },
    }))
    useGridStore.getState().setCellType(id, 'destination')
    expect(cellAt(0, 0).subtype).toBeUndefined()
  })

  it('pushes snapshot to past', () => {
    useGridStore.getState().setCellType(cellAt(0, 0).id, 'source')
    expect(useGridStore.getState().past).toHaveLength(1)
  })

  it('clears future on new action', () => {
    useGridStore.getState().setCellType(cellAt(0, 0).id, 'source')
    useGridStore.getState().undo()
    useGridStore.getState().setCellType(cellAt(0, 0).id, 'charging')
    expect(useGridStore.getState().future).toHaveLength(0)
  })
})

// ── setCellTypeBatch ──────────────────────────────────────────────────────────

describe('setCellTypeBatch', () => {
  beforeEach(() => { useGridStore.getState().newMap('Test', BASE_CONFIG) })

  it('updates multiple cells at once', () => {
    useGridStore.getState().setCellTypeBatch([
      { id: cellAt(0, 0).id, nodeType: 'source' },
      { id: cellAt(0, 1).id, nodeType: 'destination' },
    ])
    expect(cellAt(0, 0).nodeType).toBe('source')
    expect(cellAt(0, 1).nodeType).toBe('destination')
  })

  it('marks updated cells as assigned: true', () => {
    useGridStore.getState().setCellTypeBatch([{ id: cellAt(0, 0).id, nodeType: 'source' }])
    expect(cellAt(0, 0).assigned).toBe(true)
  })

  it('leaves unaffected cells unchanged', () => {
    useGridStore.getState().setCellTypeBatch([{ id: cellAt(0, 0).id, nodeType: 'source' }])
    expect(cellAt(0, 1).assigned).toBe(false)
  })

  it('does NOT push snapshot — caller must call snapshotNow() before stroke', () => {
    useGridStore.getState().setCellTypeBatch([{ id: cellAt(0, 0).id, nodeType: 'source' }])
    expect(useGridStore.getState().past).toHaveLength(0)
  })

  it('is a no-op for empty update list', () => {
    const before = useGridStore.getState().map
    useGridStore.getState().setCellTypeBatch([])
    expect(useGridStore.getState().map).toBe(before)
  })
})

// ── clearCellBatch ────────────────────────────────────────────────────────────

describe('clearCellBatch', () => {
  beforeEach(() => { useGridStore.getState().newMap('Test', BASE_CONFIG) })

  it('resets cells to blocked nodeType', () => {
    const id = cellAt(0, 0).id
    useGridStore.getState().setCellType(id, 'source')
    useGridStore.getState().clearCellBatch([id])
    expect(cellAt(0, 0).nodeType).toBe('blocked')
  })

  it('sets assigned: false (unassigned state, not explicit blocked)', () => {
    const id = cellAt(0, 0).id
    useGridStore.getState().setCellType(id, 'source')
    useGridStore.getState().clearCellBatch([id])
    expect(cellAt(0, 0).assigned).toBe(false)
  })

  it('clears subtype and label', () => {
    const id = cellAt(0, 0).id
    useGridStore.getState().setCellType(id, 'source')
    useGridStore.getState().setCellSubtype(id, 'pick')
    useGridStore.getState().setCellLabel(id, 'Station')
    useGridStore.getState().clearCellBatch([id])
    expect(cellAt(0, 0).subtype).toBeUndefined()
    expect(cellAt(0, 0).label).toBeUndefined()
  })

  it('only affects the specified cell ids', () => {
    useGridStore.getState().setCellType(cellAt(0, 0).id, 'source')
    useGridStore.getState().setCellType(cellAt(0, 1).id, 'destination')
    useGridStore.getState().clearCellBatch([cellAt(0, 0).id])
    expect(cellAt(0, 1).nodeType).toBe('destination')
  })

  it('does NOT push snapshot (caller must call snapshotNow before stroke)', () => {
    const id = cellAt(0, 0).id
    useGridStore.getState().setCellType(id, 'source')
    useGridStore.setState({ past: [] })
    useGridStore.getState().clearCellBatch([id])
    expect(useGridStore.getState().past).toHaveLength(0)
  })

  it('is a no-op for empty id list', () => {
    const before = useGridStore.getState().map
    useGridStore.getState().clearCellBatch([])
    expect(useGridStore.getState().map).toBe(before)
  })

  it('is a no-op when map is null', () => {
    useGridStore.setState({ map: null })
    useGridStore.getState().clearCellBatch(['any-id'])
    expect(useGridStore.getState().map).toBeNull()
  })
})

// ── snapshotNow ───────────────────────────────────────────────────────────────

describe('snapshotNow', () => {
  it('pushes snapshot without changing the current map', () => {
    useGridStore.getState().newMap('Test', BASE_CONFIG)
    const mapBefore = useGridStore.getState().map
    useGridStore.getState().snapshotNow()
    expect(useGridStore.getState().past).toHaveLength(1)
    expect(useGridStore.getState().map).toEqual(mapBefore)
  })
})

// ── addEdge ───────────────────────────────────────────────────────────────────

describe('addEdge', () => {
  beforeEach(() => { useGridStore.getState().newMap('Test', BASE_CONFIG) })

  it('adds an edge', () => {
    const fromId = cellAt(0, 0).id
    const toId = cellAt(0, 1).id
    useGridStore.getState().addEdge(fromId, toId, 'E')
    expect(useGridStore.getState().map!.edges).toHaveLength(1)
    expect(useGridStore.getState().map!.edges[0].from).toBe(fromId)
    expect(useGridStore.getState().map!.edges[0].to).toBe(toId)
  })

  it('ignores duplicate edges (same from+to)', () => {
    const fromId = cellAt(0, 0).id
    const toId = cellAt(0, 1).id
    useGridStore.getState().addEdge(fromId, toId, 'E')
    useGridStore.getState().addEdge(fromId, toId, 'E')
    expect(useGridStore.getState().map!.edges).toHaveLength(1)
  })

  it('pushes snapshot', () => {
    useGridStore.getState().addEdge(cellAt(0, 0).id, cellAt(0, 1).id, 'E')
    expect(useGridStore.getState().past).toHaveLength(1)
  })
})

// ── removeEdge ────────────────────────────────────────────────────────────────

describe('removeEdge', () => {
  beforeEach(() => {
    useGridStore.getState().newMap('Test', BASE_CONFIG)
    useGridStore.getState().addEdge(cellAt(0, 0).id, cellAt(0, 1).id, 'E')
    useGridStore.setState({ past: [] }) // isolate from addEdge snapshot
  })

  it('removes the edge', () => {
    const edgeId = useGridStore.getState().map!.edges[0].id
    useGridStore.getState().removeEdge(edgeId)
    expect(useGridStore.getState().map!.edges).toHaveLength(0)
  })

  it('pushes snapshot', () => {
    const edgeId = useGridStore.getState().map!.edges[0].id
    useGridStore.getState().removeEdge(edgeId)
    expect(useGridStore.getState().past).toHaveLength(1)
  })
})

// ── toggleEdgeBidirectional ───────────────────────────────────────────────────

describe('toggleEdgeBidirectional', () => {
  beforeEach(() => {
    useGridStore.getState().newMap('Test', BASE_CONFIG)
    useGridStore.getState().addEdge(cellAt(0, 0).id, cellAt(0, 1).id, 'E')
    useGridStore.setState({ past: [] })
  })

  it('toggles from false → true → false', () => {
    const edgeId = useGridStore.getState().map!.edges[0].id
    expect(useGridStore.getState().map!.edges[0].bidirectional).toBe(false)
    useGridStore.getState().toggleEdgeBidirectional(edgeId)
    expect(useGridStore.getState().map!.edges[0].bidirectional).toBe(true)
    useGridStore.getState().toggleEdgeBidirectional(edgeId)
    expect(useGridStore.getState().map!.edges[0].bidirectional).toBe(false)
  })

  it('leaves other edges unchanged', () => {
    const firstEdgeId = useGridStore.getState().map!.edges[0].id
    useGridStore.getState().addEdge(cellAt(0, 1).id, cellAt(0, 2).id, 'E')
    useGridStore.setState({ past: [] })
    const secondEdgeId = useGridStore.getState().map!.edges[1].id
    useGridStore.getState().toggleEdgeBidirectional(firstEdgeId)
    expect(useGridStore.getState().map!.edges.find(e => e.id === secondEdgeId)!.bidirectional).toBe(false)
  })

  it('pushes snapshot', () => {
    const edgeId = useGridStore.getState().map!.edges[0].id
    useGridStore.getState().toggleEdgeBidirectional(edgeId)
    expect(useGridStore.getState().past).toHaveLength(1)
  })
})

// ── setCellSubtype ────────────────────────────────────────────────────────────

describe('setCellSubtype', () => {
  beforeEach(() => { useGridStore.getState().newMap('Test', BASE_CONFIG) })

  it('sets subtype', () => {
    useGridStore.getState().setCellSubtype(cellAt(0, 0).id, 'pick')
    expect(cellAt(0, 0).subtype).toBe('pick')
  })

  it('clears subtype when set to undefined', () => {
    const id = cellAt(0, 0).id
    useGridStore.getState().setCellSubtype(id, 'pick')
    useGridStore.getState().setCellSubtype(id, undefined)
    expect(cellAt(0, 0).subtype).toBeUndefined()
  })

  it('pushes snapshot', () => {
    useGridStore.getState().setCellSubtype(cellAt(0, 0).id, 'pick')
    expect(useGridStore.getState().past).toHaveLength(1)
  })
})

// ── setCellLabel ──────────────────────────────────────────────────────────────

describe('setCellLabel', () => {
  beforeEach(() => { useGridStore.getState().newMap('Test', BASE_CONFIG) })

  it('sets label', () => {
    useGridStore.getState().setCellLabel(cellAt(0, 0).id, 'Station A')
    expect(cellAt(0, 0).label).toBe('Station A')
  })

  it('intentionally does NOT push snapshot (label edits are not undo-tracked)', () => {
    useGridStore.getState().setCellLabel(cellAt(0, 0).id, 'Station A')
    expect(useGridStore.getState().past).toHaveLength(0)
  })
})

// ── toggleLayerVisibility ─────────────────────────────────────────────────────

describe('toggleLayerVisibility', () => {
  beforeEach(() => { useGridStore.getState().newMap('Test', BASE_CONFIG) })

  it('toggles layer visible flag', () => {
    const before = useGridStore.getState().map!.layers.find(l => l.id === 'layer-path')!.visible
    useGridStore.getState().toggleLayerVisibility('layer-path')
    const after = useGridStore.getState().map!.layers.find(l => l.id === 'layer-path')!.visible
    expect(after).toBe(!before)
  })

  it('does NOT push snapshot', () => {
    useGridStore.getState().toggleLayerVisibility('layer-path')
    expect(useGridStore.getState().past).toHaveLength(0)
  })
})

// ── undo / redo ───────────────────────────────────────────────────────────────

describe('undo', () => {
  beforeEach(() => { useGridStore.getState().newMap('Test', BASE_CONFIG) })

  it('restores the previous map state', () => {
    const originalType = cellAt(0, 0).nodeType
    useGridStore.getState().setCellType(cellAt(0, 0).id, 'source')
    useGridStore.getState().undo()
    expect(cellAt(0, 0).nodeType).toBe(originalType)
  })

  it('moves current map to future', () => {
    useGridStore.getState().setCellType(cellAt(0, 0).id, 'source')
    useGridStore.getState().undo()
    expect(useGridStore.getState().future).toHaveLength(1)
  })

  it('is a no-op when past is empty', () => {
    const mapBefore = useGridStore.getState().map
    useGridStore.getState().undo()
    expect(useGridStore.getState().map).toEqual(mapBefore)
    expect(useGridStore.getState().future).toHaveLength(0)
  })
})

describe('redo', () => {
  beforeEach(() => { useGridStore.getState().newMap('Test', BASE_CONFIG) })

  it('restores the undone map state', () => {
    useGridStore.getState().setCellType(cellAt(0, 0).id, 'source')
    useGridStore.getState().undo()
    useGridStore.getState().redo()
    expect(cellAt(0, 0).nodeType).toBe('source')
  })

  it('is a no-op when future is empty', () => {
    useGridStore.getState().setCellType(cellAt(0, 0).id, 'source')
    const mapBefore = useGridStore.getState().map
    useGridStore.getState().redo()
    expect(useGridStore.getState().map).toEqual(mapBefore)
  })
})

// ── null map guards ───────────────────────────────────────────────────────────
// All mutating actions are no-ops (return {}) when map is null; freshStore() ensures that.

describe('null map guards', () => {
  it('setCellType is a no-op', () => {
    useGridStore.getState().setCellType('r0c0', 'source')
    expect(useGridStore.getState().map).toBeNull()
  })

  it('setCellTypeBatch is a no-op when map is null', () => {
    useGridStore.getState().setCellTypeBatch([{ id: 'r0c0', nodeType: 'source' }])
    expect(useGridStore.getState().map).toBeNull()
  })

  it('setCellSubtype is a no-op', () => {
    useGridStore.getState().setCellSubtype('r0c0', 'pick')
    expect(useGridStore.getState().map).toBeNull()
  })

  it('setCellLabel is a no-op', () => {
    useGridStore.getState().setCellLabel('r0c0', 'X')
    expect(useGridStore.getState().map).toBeNull()
  })

  it('addEdge is a no-op', () => {
    useGridStore.getState().addEdge('r0c0', 'r0c1', 'E')
    expect(useGridStore.getState().map).toBeNull()
  })

  it('removeEdge is a no-op', () => {
    useGridStore.getState().removeEdge('e_r0c0_r0c1')
    expect(useGridStore.getState().map).toBeNull()
  })

  it('toggleEdgeBidirectional is a no-op', () => {
    useGridStore.getState().toggleEdgeBidirectional('e_r0c0_r0c1')
    expect(useGridStore.getState().map).toBeNull()
  })

  it('toggleLayerVisibility is a no-op', () => {
    useGridStore.getState().toggleLayerVisibility('layer-path')
    expect(useGridStore.getState().map).toBeNull()
  })

  it('undo is a no-op when map is null', () => {
    useGridStore.getState().undo()
    expect(useGridStore.getState().map).toBeNull()
  })

  it('redo is a no-op when map is null', () => {
    useGridStore.getState().redo()
    expect(useGridStore.getState().map).toBeNull()
  })
})

// ── clearEdges ────────────────────────────────────────────────────────────────

describe('clearEdges', () => {
  beforeEach(() => {
    useGridStore.getState().newMap('Test', BASE_CONFIG)
    useGridStore.getState().addEdge(cellAt(0, 0).id, cellAt(0, 1).id, 'E')
    useGridStore.setState({ past: [] })
  })

  it('removes all edges', () => {
    useGridStore.getState().clearEdges()
    expect(useGridStore.getState().map!.edges).toHaveLength(0)
  })

  it('pushes snapshot to past', () => {
    useGridStore.getState().clearEdges()
    expect(useGridStore.getState().past).toHaveLength(1)
  })

  it('is a no-op when map is null', () => {
    useGridStore.setState({ map: null })
    useGridStore.getState().clearEdges()
    expect(useGridStore.getState().map).toBeNull()
  })
})

// ── resetCells ────────────────────────────────────────────────────────────────

describe('resetCells', () => {
  beforeEach(() => {
    useGridStore.getState().newMap('Test', BASE_CONFIG)
    useGridStore.getState().setCellType(cellAt(0, 0).id, 'source')
    useGridStore.getState().addEdge(cellAt(0, 0).id, cellAt(0, 1).id, 'E')
    useGridStore.setState({ past: [] })
  })

  it('resets all cells to blocked type', () => {
    useGridStore.getState().resetCells()
    expect(useGridStore.getState().map!.cells.every(c => c.nodeType === 'blocked')).toBe(true)
  })

  it('sets all cells to assigned: false after reset', () => {
    useGridStore.getState().resetCells()
    expect(useGridStore.getState().map!.cells.every(c => c.assigned === false)).toBe(true)
  })

  it('clears all edges', () => {
    useGridStore.getState().resetCells()
    expect(useGridStore.getState().map!.edges).toHaveLength(0)
  })

  it('pushes snapshot to past', () => {
    useGridStore.getState().resetCells()
    expect(useGridStore.getState().past).toHaveLength(1)
  })

  it('is a no-op when map is null', () => {
    useGridStore.setState({ map: null })
    useGridStore.getState().resetCells()
    expect(useGridStore.getState().map).toBeNull()
  })
})

// ── history cap ───────────────────────────────────────────────────────────────

describe('history cap', () => {
  it('caps past at 50 entries', () => {
    useGridStore.getState().newMap('Test', BASE_CONFIG)
    const id = cellAt(0, 0).id
    for (let i = 0; i < 55; i++) {
      useGridStore.getState().setCellType(id, i % 2 === 0 ? 'source' : 'path')
    }
    expect(useGridStore.getState().past).toHaveLength(50)
  })
})
