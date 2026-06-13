import type { GridCell, GridConfig } from '@naxa/core'

// Returns [row, col] offsets for all valid in-bounds neighbors of (row, col).
// Square/rectangle: 4-connected (orthogonal only).
// Hexagon: 6-connected using offset-grid parity rules.
function getNeighborCoords(row: number, col: number, config: GridConfig): Array<[number, number]> {
  const { rows, cols, cellShape } = config
  const result: Array<[number, number]> = []

  if (cellShape === 'hexagon') {
    const offsets: Array<[number, number]> = row % 2 === 0
      ? [[-1, 0], [0, 1], [1, 0], [1, -1], [0, -1], [-1, -1]]
      : [[-1, 1], [0, 1], [1, 1], [1, 0], [0, -1], [-1, 0]]
    for (const [dr, dc] of offsets) {
      const nr = row + dr, nc = col + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) result.push([nr, nc])
    }
  } else {
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as Array<[number, number]>) {
      const nr = row + dr, nc = col + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) result.push([nr, nc])
    }
  }
  return result
}

/**
 * Returns the IDs of all cells contiguous with the start cell that are unassigned
 * (cell.assigned === false or absent — the default/empty state).
 *
 * If the start cell itself is assigned (explicitly typed by the user), returns [].
 * Flood stops at any cell boundary where cell.assigned is truthy.
 *
 * Uses 4-connectivity for square/rectangle grids, 6-connectivity for hexagon grids.
 * Returns [] if startRow/startCol is out of bounds.
 */
export function floodFill(
  startRow: number,
  startCol: number,
  cells: GridCell[],
  config: GridConfig,
): string[] {
  const byCoord = new Map(cells.map(c => [`${c.coord.row},${c.coord.col}`, c]))
  const start = byCoord.get(`${startRow},${startCol}`)
  if (!start) return []

  // Only flood if start cell is unassigned
  if (start.assigned) return []

  const visited = new Set<string>()
  const queue: Array<[number, number]> = [[startRow, startCol]]
  const result: string[] = []

  while (queue.length > 0) {
    const [row, col] = queue.shift()!
    const key = `${row},${col}`
    if (visited.has(key)) continue
    visited.add(key)

    const cell = byCoord.get(key)
    if (!cell || cell.assigned) continue   // stop at assigned cell boundary

    result.push(cell.id)
    for (const [nr, nc] of getNeighborCoords(row, col, config)) {
      if (!visited.has(`${nr},${nc}`)) queue.push([nr, nc])
    }
  }

  return result
}
