import type { Edge, GridCell, GridMap } from '@naxa/core'
import type { TraceRoute } from '../store/uiStore'

function buildAdj(edges: Edge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>()
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, [])
    adj.get(e.from)!.push(e.to)
    if (e.bidirectional) {
      if (!adj.has(e.to)) adj.set(e.to, [])
      adj.get(e.to)!.push(e.from)
    }
  }
  return adj
}

export function bfsPath(fromId: string, toId: string, edges: Edge[]): string[] | null {
  if (fromId === toId) return [fromId]
  const adj = buildAdj(edges)
  const visited = new Set<string>([fromId])
  const prev = new Map<string, string>()
  const queue = [fromId]

  while (queue.length > 0) {
    const curr = queue.shift()!
    for (const next of adj.get(curr) ?? []) {
      if (!visited.has(next)) {
        visited.add(next)
        prev.set(next, curr)
        if (next === toId) {
          const path: string[] = []
          let c: string | undefined = toId
          while (c !== undefined) { path.unshift(c); c = prev.get(c) }
          return path
        }
        queue.push(next)
      }
    }
  }
  return null
}

export function validateConnectivity(map: GridMap): { unreachable: string[] } {
  const sources = map.cells.filter(c => c.nodeType === 'source')
  const destinations = map.cells.filter(c => c.nodeType === 'destination')
  if (sources.length === 0 || destinations.length === 0) return { unreachable: [] }

  const unreachable: string[] = []
  for (const dest of destinations) {
    const reachable = sources.some(src => bfsPath(src.id, dest.id, map.edges) !== null)
    if (!reachable) unreachable.push(dest.id)
  }
  return { unreachable }
}

const TRACE_PALETTE = [
  '#10b981', '#f59e0b', '#a855f7', '#06b6d4',
  '#f97316', '#ec4899', '#84cc16', '#6366f1',
]

export function buildTraceRoutes(map: GridMap): TraceRoute[] {
  const sources = map.cells.filter(c => c.nodeType === 'source')
  const destinations = map.cells.filter(c => c.nodeType === 'destination')
  const routes: TraceRoute[] = []

  const getLabel = (cell: GridCell) =>
    cell.label ?? cell.subtype ?? cell.id

  for (const src of sources) {
    for (const dst of destinations) {
      const path = bfsPath(src.id, dst.id, map.edges)
      if (path) {
        routes.push({
          pathIds: path,
          color: TRACE_PALETTE[routes.length % TRACE_PALETTE.length],
          label: `${getLabel(src)} → ${getLabel(dst)}`,
        })
      }
    }
  }
  return routes
}

export function hitTestEdge(
  px: number,
  py: number,
  edges: Edge[],
  _cellMap: Map<string, GridCell>,
  getCellCenter: (id: string) => { x: number; y: number } | null,
  threshold = 10,
): string | null {
  for (const edge of edges) {
    const p1 = getCellCenter(edge.from)
    const p2 = getCellCenter(edge.to)
    if (!p1 || !p2) continue
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) continue
    const t = Math.max(0, Math.min(1, ((px - p1.x) * dx + (py - p1.y) * dy) / lenSq))
    const dist = Math.hypot(px - (p1.x + t * dx), py - (p1.y + t * dy))
    if (dist < threshold) return edge.id
  }
  return null
}
