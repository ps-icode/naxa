import { describe, it, expect } from 'vitest'
import type { Edge, GridCell, GridMap } from '@naxa/core'
import { bfsPath, validateConnectivity, buildTraceRoutes, hitTestEdge } from '../../lib/graph'
import type { ValidationResult } from '../../lib/graph'

function makeEdge(from: string, to: string, bidirectional = false): Edge {
  return { id: `e_${from}_${to}`, from, to, direction: 'E', bidirectional, cost: 1 }
}

function makeCell(id: string, nodeType: GridCell['nodeType'] = 'lane'): GridCell {
  return { id, coord: { row: 0, col: 0 }, nodeType }
}

function makeMap(cells: GridCell[], edges: Edge[]): GridMap {
  return {
    id: 'test',
    name: 'Test',
    createdAt: '',
    updatedAt: '',
    config: { rows: 5, cols: 5, cellShape: 'square', cellSizeMeters: 1 },
    cells,
    edges,
    layers: [],
  }
}

// ── bfsPath ───────────────────────────────────────────────────────────────────

describe('bfsPath', () => {
  it('returns [id] when from === to (same cell)', () => {
    expect(bfsPath('a', 'a', [])).toEqual(['a'])
  })

  it('returns direct path when directly connected', () => {
    expect(bfsPath('a', 'b', [makeEdge('a', 'b')])).toEqual(['a', 'b'])
  })

  it('returns multi-hop path', () => {
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')]
    expect(bfsPath('a', 'c', edges)).toEqual(['a', 'b', 'c'])
  })

  it('returns null when no path exists', () => {
    expect(bfsPath('a', 'c', [makeEdge('a', 'b')])).toBeNull()
  })

  it('traverses bidirectional edges in reverse', () => {
    expect(bfsPath('b', 'a', [makeEdge('a', 'b', true)])).toEqual(['b', 'a'])
  })

  it('does NOT traverse unidirectional edges in reverse', () => {
    expect(bfsPath('b', 'a', [makeEdge('a', 'b', false)])).toBeNull()
  })

  it('handles multiple edges from the same source node (adj map reuse)', () => {
    // Covers the `adj.has(e.from)` false-branch in buildAdj when same from appears twice
    const edges = [makeEdge('a', 'b'), makeEdge('a', 'c')]
    expect(bfsPath('a', 'c', edges)).toEqual(['a', 'c'])
  })

  it('handles converging bidirectional paths (adj map reuse on to-node)', () => {
    // Covers the `adj.has(e.to)` false-branch in buildAdj when same to appears twice
    const edges = [makeEdge('a', 'c', true), makeEdge('b', 'c', true)]
    expect(bfsPath('b', 'a', edges)).toEqual(['b', 'c', 'a'])
  })

  it('skips already-visited nodes (covers !visited.has(next) false branch)', () => {
    // a→b, a→c, b→c, c→d: BFS visits c via a; when processing b, c is already visited
    const edges = [makeEdge('a', 'b'), makeEdge('a', 'c'), makeEdge('b', 'c'), makeEdge('c', 'd')]
    expect(bfsPath('a', 'd', edges)).toEqual(['a', 'c', 'd'])
  })
})

// ── validateConnectivity ──────────────────────────────────────────────────────

const EMPTY_RESULT: ValidationResult = {
  unreachable: [],
  unreachableDestinations: [],
  unreachableSources: [],
  unreachableCharging: [],
  unreachableParking: [],
}

describe('validateConnectivity', () => {
  it('returns all-empty result when no sources', () => {
    const map = makeMap([makeCell('d1', 'destination')], [])
    expect(validateConnectivity(map)).toEqual(EMPTY_RESULT)
  })

  it('returns all-empty result when no destinations', () => {
    const map = makeMap([makeCell('s1', 'source')], [])
    expect(validateConnectivity(map)).toEqual(EMPTY_RESULT)
  })

  it('returns empty when all nodes reachable (bidirectional edges)', () => {
    const cells = [makeCell('s1', 'source'), makeCell('d1', 'destination')]
    // Bidirectional: s1 reaches d1 forward, d1 reaches s1 for return path
    const map = makeMap(cells, [makeEdge('s1', 'd1', true)])
    expect(validateConnectivity(map)).toEqual(EMPTY_RESULT)
  })

  it('returns unreachableDestinations when dest not reachable from any source', () => {
    const cells = [
      makeCell('s1', 'source'),
      makeCell('d1', 'destination'),
      makeCell('d2', 'destination'),
    ]
    const map = makeMap(cells, [makeEdge('s1', 'd1')])
    const r = validateConnectivity(map)
    expect(r.unreachableDestinations).toEqual(['d2'])
    expect(r.unreachable).toContain('d2')
  })

  it('reports unreachableCharging when charging not reachable from sources', () => {
    const cells = [
      makeCell('s1', 'source'), makeCell('d1', 'destination'), makeCell('ch1', 'charging'),
    ]
    const map = makeMap(cells, [makeEdge('s1', 'd1')])
    const r = validateConnectivity(map)
    expect(r.unreachableCharging).toEqual(['ch1'])
    expect(r.unreachable).toContain('ch1')
  })

  it('does not report charging when reachable from sources', () => {
    const cells = [
      makeCell('s1', 'source'), makeCell('d1', 'destination'), makeCell('ch1', 'charging'),
    ]
    const map = makeMap(cells, [makeEdge('s1', 'd1'), makeEdge('s1', 'ch1')])
    const r = validateConnectivity(map)
    expect(r.unreachableCharging).toEqual([])
  })

  it('reports unreachableParking when parking not reachable from sources', () => {
    const cells = [
      makeCell('s1', 'source'), makeCell('d1', 'destination'), makeCell('pk1', 'parking'),
    ]
    const map = makeMap(cells, [makeEdge('s1', 'd1')])
    const r = validateConnectivity(map)
    expect(r.unreachableParking).toEqual(['pk1'])
    expect(r.unreachable).toContain('pk1')
  })

  it('does not report parking when reachable from sources', () => {
    const cells = [
      makeCell('s1', 'source'), makeCell('d1', 'destination'), makeCell('pk1', 'parking'),
    ]
    const map = makeMap(cells, [makeEdge('s1', 'd1'), makeEdge('s1', 'pk1')])
    const r = validateConnectivity(map)
    expect(r.unreachableParking).toEqual([])
  })

  it('reports unreachableSources when source not reachable from any destination', () => {
    const cells = [
      makeCell('s1', 'source'), makeCell('s2', 'source'), makeCell('d1', 'destination'),
    ]
    // s1→d1 (forward), d1→s1 (return ok), but s2 is isolated
    const map = makeMap(cells, [makeEdge('s1', 'd1'), makeEdge('d1', 's1')])
    const r = validateConnectivity(map)
    expect(r.unreachableSources).toEqual(['s2'])
    expect(r.unreachable).toContain('s2')
  })

  it('does not report source when reachable from destinations (return path exists)', () => {
    const cells = [makeCell('s1', 'source'), makeCell('d1', 'destination')]
    const map = makeMap(cells, [makeEdge('s1', 'd1'), makeEdge('d1', 's1')])
    const r = validateConnectivity(map)
    expect(r.unreachableSources).toEqual([])
  })

  it('multi-source BFS: isolated source only appears in unreachableSources', () => {
    const cells = [
      makeCell('sA', 'source'), makeCell('sB', 'source'), makeCell('dX', 'destination'),
    ]
    // sA reaches dX; sB is completely disconnected
    const map = makeMap(cells, [makeEdge('sA', 'dX'), makeEdge('dX', 'sA')])
    const r = validateConnectivity(map)
    expect(r.unreachableDestinations).toEqual([])  // dX is reachable from sA
    expect(r.unreachableSources).toEqual(['sB'])   // sB not reachable from dX
    expect(r.unreachable).toEqual(['sB'])
  })

  it('deduplicates unreachable when same id would appear in multiple categories', () => {
    // Not possible by type (each cell has one nodeType), but test union is unique
    const cells = [
      makeCell('s1', 'source'), makeCell('d1', 'destination'),
      makeCell('ch1', 'charging'), makeCell('pk1', 'parking'),
    ]
    const map = makeMap(cells, [makeEdge('s1', 'd1')])
    const r = validateConnectivity(map)
    const unique = new Set(r.unreachable)
    expect(unique.size).toBe(r.unreachable.length)
  })
})

// ── buildTraceRoutes ──────────────────────────────────────────────────────────

describe('buildTraceRoutes', () => {
  it('returns empty array when no sources or destinations', () => {
    expect(buildTraceRoutes(makeMap([makeCell('c1')], []))).toEqual([])
  })

  it('builds single route for one src→dst pair', () => {
    const cells = [makeCell('s1', 'source'), makeCell('d1', 'destination')]
    const routes = buildTraceRoutes(makeMap(cells, [makeEdge('s1', 'd1')]))
    expect(routes).toHaveLength(1)
    expect(routes[0].pathIds).toEqual(['s1', 'd1'])
    expect(routes[0].label).toBe('s1 → d1')
  })

  it('uses cell label when available', () => {
    const src = { ...makeCell('s1', 'source'), label: 'Alpha' }
    const dst = { ...makeCell('d1', 'destination'), label: 'Beta' }
    const routes = buildTraceRoutes(makeMap([src, dst], [makeEdge('s1', 'd1')]))
    expect(routes[0].label).toBe('Alpha → Beta')
  })

  it('uses subtype as label fallback when no label', () => {
    const src = { ...makeCell('s1', 'source'), subtype: 'feeder' }
    const dst = { ...makeCell('d1', 'destination'), subtype: 'bin' }
    const routes = buildTraceRoutes(makeMap([src, dst], [makeEdge('s1', 'd1')]))
    expect(routes[0].label).toBe('feeder → bin')
  })

  it('cycles through palette colors (modulo 8)', () => {
    const cells: GridCell[] = []
    const edges: Edge[] = []
    for (let i = 0; i < 9; i++) {
      cells.push(makeCell(`s${i}`, 'source'), makeCell(`d${i}`, 'destination'))
      edges.push(makeEdge(`s${i}`, `d${i}`))
    }
    const routes = buildTraceRoutes(makeMap(cells, edges))
    expect(routes).toHaveLength(9)
    // index 8 % 8 === 0, so same color as first route
    expect(routes[8].color).toBe(routes[0].color)
  })

  it('skips unreachable src-dst pairs (no edges)', () => {
    const cells = [makeCell('s1', 'source'), makeCell('d1', 'destination')]
    expect(buildTraceRoutes(makeMap(cells, []))).toHaveLength(0)
  })
})

// ── hitTestEdge ───────────────────────────────────────────────────────────────

describe('hitTestEdge', () => {
  const cellMap = new Map<string, GridCell>([
    ['a', makeCell('a')],
    ['b', makeCell('b')],
  ])
  const edges: Edge[] = [makeEdge('a', 'b')]

  const getCellCenter = (id: string): { x: number; y: number } | null => {
    if (id === 'a') return { x: 0, y: 0 }
    if (id === 'b') return { x: 100, y: 0 }
    return null
  }

  it('returns edge id when point is on the edge', () => {
    expect(hitTestEdge(50, 0, edges, cellMap, getCellCenter)).toBe('e_a_b')
  })

  it('returns null when point is far from any edge', () => {
    expect(hitTestEdge(50, 100, edges, cellMap, getCellCenter)).toBeNull()
  })

  it('hits just inside the threshold', () => {
    expect(hitTestEdge(50, 9, edges, cellMap, getCellCenter, 10)).toBe('e_a_b')
  })

  it('misses just outside the threshold', () => {
    expect(hitTestEdge(50, 11, edges, cellMap, getCellCenter, 10)).toBeNull()
  })

  it('skips zero-length edges (both centers at same point)', () => {
    const zeroEdge = makeEdge('a', 'a')
    const sameCenter = (_id: string) => ({ x: 0, y: 0 })
    expect(hitTestEdge(0, 0, [zeroEdge], cellMap, sameCenter)).toBeNull()
  })

  it('skips edges with missing cell centers', () => {
    const missingCenter = (_id: string): null => null
    expect(hitTestEdge(50, 0, edges, cellMap, missingCenter)).toBeNull()
  })
})
