import { describe, it, expect, beforeEach } from 'vitest'
import type { GridConfig } from '@naxa/core'
import { useGridStore } from '../../store/gridStore'

const BASE_CONFIG: GridConfig = { rows: 3, cols: 3, cellShape: 'square', cellSizeMeters: 1 }

function freshStore(): void {
  useGridStore.setState({ map: null, past: [], future: [], savedList: [] })
}

beforeEach(freshStore)

// ── newMap ────────────────────────────────────────────────────────────────────

describe('newMap', () => {
  it('creates rows×cols cells', () => {
    useGridStore.getState().newMap('Test', BASE_CONFIG)
    expect(useGridStore.getState().map!.cells).toHaveLength(9)
  })

  it('all cells start as lane type', () => {
    useGridStore.getState().newMap('Test', BASE_CONFIG)
    expect(useGridStore.getState().map!.cells.every(c => c.nodeType === 'lane')).toBe(true)
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
    useGridStore.getState().setCellType('r0c0', 'source')
    expect(useGridStore.getState().map!.cells.find(c => c.id === 'r0c0')!.nodeType).toBe('source')
  })

  it('resets subtype when type changes', () => {
    // Prime the cell with a subtype
    useGridStore.setState(s => ({
      map: { ...s.map!, cells: s.map!.cells.map(c => c.id === 'r0c0' ? { ...c, subtype: 'pick' } : c) },
    }))
    useGridStore.getState().setCellType('r0c0', 'destination')
    expect(useGridStore.getState().map!.cells.find(c => c.id === 'r0c0')!.subtype).toBeUndefined()
  })

  it('pushes snapshot to past', () => {
    useGridStore.getState().setCellType('r0c0', 'source')
    expect(useGridStore.getState().past).toHaveLength(1)
  })

  it('clears future on new action', () => {
    useGridStore.getState().setCellType('r0c0', 'source')
    useGridStore.getState().undo()
    useGridStore.getState().setCellType('r0c0', 'charging')
    expect(useGridStore.getState().future).toHaveLength(0)
  })
})

// ── setCellTypeBatch ──────────────────────────────────────────────────────────

describe('setCellTypeBatch', () => {
  beforeEach(() => { useGridStore.getState().newMap('Test', BASE_CONFIG) })

  it('updates multiple cells at once', () => {
    useGridStore.getState().setCellTypeBatch([
      { id: 'r0c0', nodeType: 'source' },
      { id: 'r0c1', nodeType: 'destination' },
    ])
    const { cells } = useGridStore.getState().map!
    expect(cells.find(c => c.id === 'r0c0')!.nodeType).toBe('source')
    expect(cells.find(c => c.id === 'r0c1')!.nodeType).toBe('destination')
  })

  it('does NOT push snapshot — caller must call snapshotNow() before stroke', () => {
    useGridStore.getState().setCellTypeBatch([{ id: 'r0c0', nodeType: 'source' }])
    expect(useGridStore.getState().past).toHaveLength(0)
  })

  it('is a no-op for empty update list', () => {
    const before = useGridStore.getState().map
    useGridStore.getState().setCellTypeBatch([])
    expect(useGridStore.getState().map).toBe(before)
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
    useGridStore.getState().addEdge('r0c0', 'r0c1', 'E')
    expect(useGridStore.getState().map!.edges).toHaveLength(1)
    expect(useGridStore.getState().map!.edges[0].from).toBe('r0c0')
    expect(useGridStore.getState().map!.edges[0].to).toBe('r0c1')
  })

  it('ignores duplicate edges (same from+to)', () => {
    useGridStore.getState().addEdge('r0c0', 'r0c1', 'E')
    useGridStore.getState().addEdge('r0c0', 'r0c1', 'E')
    expect(useGridStore.getState().map!.edges).toHaveLength(1)
  })

  it('pushes snapshot', () => {
    useGridStore.getState().addEdge('r0c0', 'r0c1', 'E')
    expect(useGridStore.getState().past).toHaveLength(1)
  })
})

// ── removeEdge ────────────────────────────────────────────────────────────────

describe('removeEdge', () => {
  beforeEach(() => {
    useGridStore.getState().newMap('Test', BASE_CONFIG)
    useGridStore.getState().addEdge('r0c0', 'r0c1', 'E')
    useGridStore.setState({ past: [] }) // isolate from addEdge snapshot
  })

  it('removes the edge', () => {
    useGridStore.getState().removeEdge('e_r0c0_r0c1')
    expect(useGridStore.getState().map!.edges).toHaveLength(0)
  })

  it('pushes snapshot', () => {
    useGridStore.getState().removeEdge('e_r0c0_r0c1')
    expect(useGridStore.getState().past).toHaveLength(1)
  })
})

// ── toggleEdgeBidirectional ───────────────────────────────────────────────────

describe('toggleEdgeBidirectional', () => {
  beforeEach(() => {
    useGridStore.getState().newMap('Test', BASE_CONFIG)
    useGridStore.getState().addEdge('r0c0', 'r0c1', 'E')
    useGridStore.setState({ past: [] })
  })

  it('toggles from false → true → false', () => {
    expect(useGridStore.getState().map!.edges[0].bidirectional).toBe(false)
    useGridStore.getState().toggleEdgeBidirectional('e_r0c0_r0c1')
    expect(useGridStore.getState().map!.edges[0].bidirectional).toBe(true)
    useGridStore.getState().toggleEdgeBidirectional('e_r0c0_r0c1')
    expect(useGridStore.getState().map!.edges[0].bidirectional).toBe(false)
  })

  it('leaves other edges unchanged', () => {
    useGridStore.getState().addEdge('r0c1', 'r0c2', 'E')
    useGridStore.setState({ past: [] })
    useGridStore.getState().toggleEdgeBidirectional('e_r0c0_r0c1')
    // the second edge e_r0c1_r0c2 must still be unidirectional
    expect(useGridStore.getState().map!.edges.find(e => e.id === 'e_r0c1_r0c2')!.bidirectional).toBe(false)
  })

  it('pushes snapshot', () => {
    useGridStore.getState().toggleEdgeBidirectional('e_r0c0_r0c1')
    expect(useGridStore.getState().past).toHaveLength(1)
  })
})

// ── setCellSubtype ────────────────────────────────────────────────────────────

describe('setCellSubtype', () => {
  beforeEach(() => { useGridStore.getState().newMap('Test', BASE_CONFIG) })

  it('sets subtype', () => {
    useGridStore.getState().setCellSubtype('r0c0', 'pick')
    expect(useGridStore.getState().map!.cells.find(c => c.id === 'r0c0')!.subtype).toBe('pick')
  })

  it('clears subtype when set to undefined', () => {
    useGridStore.getState().setCellSubtype('r0c0', 'pick')
    useGridStore.getState().setCellSubtype('r0c0', undefined)
    expect(useGridStore.getState().map!.cells.find(c => c.id === 'r0c0')!.subtype).toBeUndefined()
  })

  it('pushes snapshot', () => {
    useGridStore.getState().setCellSubtype('r0c0', 'pick')
    expect(useGridStore.getState().past).toHaveLength(1)
  })
})

// ── setCellLabel ──────────────────────────────────────────────────────────────

describe('setCellLabel', () => {
  beforeEach(() => { useGridStore.getState().newMap('Test', BASE_CONFIG) })

  it('sets label', () => {
    useGridStore.getState().setCellLabel('r0c0', 'Station A')
    expect(useGridStore.getState().map!.cells.find(c => c.id === 'r0c0')!.label).toBe('Station A')
  })

  it('intentionally does NOT push snapshot (label edits are not undo-tracked)', () => {
    useGridStore.getState().setCellLabel('r0c0', 'Station A')
    expect(useGridStore.getState().past).toHaveLength(0)
  })
})

// ── toggleLayerVisibility ─────────────────────────────────────────────────────

describe('toggleLayerVisibility', () => {
  beforeEach(() => { useGridStore.getState().newMap('Test', BASE_CONFIG) })

  it('toggles layer visible flag', () => {
    const before = useGridStore.getState().map!.layers.find(l => l.id === 'layer-lane')!.visible
    useGridStore.getState().toggleLayerVisibility('layer-lane')
    const after = useGridStore.getState().map!.layers.find(l => l.id === 'layer-lane')!.visible
    expect(after).toBe(!before)
  })

  it('does NOT push snapshot', () => {
    useGridStore.getState().toggleLayerVisibility('layer-lane')
    expect(useGridStore.getState().past).toHaveLength(0)
  })
})

// ── undo / redo ───────────────────────────────────────────────────────────────

describe('undo', () => {
  beforeEach(() => { useGridStore.getState().newMap('Test', BASE_CONFIG) })

  it('restores the previous map state', () => {
    const originalType = useGridStore.getState().map!.cells.find(c => c.id === 'r0c0')!.nodeType
    useGridStore.getState().setCellType('r0c0', 'source')
    useGridStore.getState().undo()
    expect(useGridStore.getState().map!.cells.find(c => c.id === 'r0c0')!.nodeType).toBe(originalType)
  })

  it('moves current map to future', () => {
    useGridStore.getState().setCellType('r0c0', 'source')
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
    useGridStore.getState().setCellType('r0c0', 'source')
    useGridStore.getState().undo()
    useGridStore.getState().redo()
    expect(useGridStore.getState().map!.cells.find(c => c.id === 'r0c0')!.nodeType).toBe('source')
  })

  it('is a no-op when future is empty', () => {
    useGridStore.getState().setCellType('r0c0', 'source')
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
    useGridStore.getState().toggleLayerVisibility('layer-lane')
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

// ── history cap ───────────────────────────────────────────────────────────────

describe('history cap', () => {
  it('caps past at 50 entries', () => {
    useGridStore.getState().newMap('Test', BASE_CONFIG)
    for (let i = 0; i < 55; i++) {
      useGridStore.getState().setCellType('r0c0', i % 2 === 0 ? 'source' : 'lane')
    }
    expect(useGridStore.getState().past).toHaveLength(50)
  })
})
