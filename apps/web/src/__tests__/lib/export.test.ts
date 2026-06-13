import { describe, it, expect } from 'vitest'
import { buildExportPayload, FIELD_PRESETS } from '../../lib/exportData'
import type { ExportOptions } from '../../lib/exportData'
import type { GridMap } from '@naxa/core'

// ── fixture ───────────────────────────────────────────────────────────────────

const MAP: GridMap = {
  id: 'test', name: 'Test Map', createdAt: '', updatedAt: '',
  config: { rows: 2, cols: 2, cellShape: 'square', cellSizeMeters: 0.5 },
  cells: [
    { id: 'r0c0', coord: { row: 0, col: 0 }, nodeType: 'blocked' },
    { id: 'r0c1', coord: { row: 0, col: 1 }, nodeType: 'source', subtype: 'feeder', label: 'S1' },
    { id: 'r1c0', coord: { row: 1, col: 0 }, nodeType: 'traversable' },
    { id: 'r1c1', coord: { row: 1, col: 1 }, nodeType: 'destination' },
  ],
  edges: [
    { id: 'e1', from: 'r0c1', to: 'r1c1', direction: 'S', bidirectional: false },
  ],
  layers: [
    { id: 'l1', name: 'Source', nodeType: 'source', visible: true, color: '#22c55e' },
  ],
}

function opts(overrides: Partial<ExportOptions> = {}): ExportOptions {
  return {
    format: 'json',
    coordOrigin: 0,
    excludeDefaultBlocked: true,
    includeConfig: false,
    includeLayers: false,
    fieldNames: { ...FIELD_PRESETS.naxa },
    ...overrides,
  }
}

// ── excludeDefaultBlocked ─────────────────────────────────────────────────────

describe('buildExportPayload — excludeDefaultBlocked', () => {
  it('omits cells where nodeType===blocked and no subtype when true', () => {
    const { cells } = buildExportPayload(MAP, opts({ excludeDefaultBlocked: true })) as { cells: { id: string }[] }
    expect(cells.map(c => c.id)).not.toContain('r0c0')
    expect(cells).toHaveLength(3)
  })

  it('includes all cells when false', () => {
    const { cells } = buildExportPayload(MAP, opts({ excludeDefaultBlocked: false })) as { cells: { id: string }[] }
    expect(cells).toHaveLength(4)
  })

  it('keeps explicitly-typed blocked cell (has subtype)', () => {
    const mapWithSubtype: GridMap = {
      ...MAP,
      cells: [{ id: 'r0c0', coord: { row: 0, col: 0 }, nodeType: 'blocked', subtype: 'wall' }],
    }
    const { cells } = buildExportPayload(mapWithSubtype, opts({ excludeDefaultBlocked: true })) as { cells: { id: string }[] }
    expect(cells).toHaveLength(1)
    expect(cells[0].id).toBe('r0c0')
  })
})

// ── coordOrigin ───────────────────────────────────────────────────────────────

describe('buildExportPayload — coordOrigin', () => {
  it('0-indexed: row/col values start at 0', () => {
    const { cells } = buildExportPayload(MAP, opts({ coordOrigin: 0, excludeDefaultBlocked: false })) as {
      cells: { id: string; row: number; col: number }[]
    }
    const c = cells.find(x => x.id === 'r0c0')!
    expect(c.row).toBe(0)
    expect(c.col).toBe(0)
  })

  it('1-indexed: row/col values start at 1', () => {
    const { cells } = buildExportPayload(MAP, opts({ coordOrigin: 1, excludeDefaultBlocked: false })) as {
      cells: { id: string; row: number; col: number }[]
    }
    const c = cells.find(x => x.id === 'r0c0')!
    expect(c.row).toBe(1)
    expect(c.col).toBe(1)

    const c2 = cells.find(x => x.id === 'r1c1')!
    expect(c2.row).toBe(2)
    expect(c2.col).toBe(2)
  })
})

// ── field name presets ────────────────────────────────────────────────────────

describe('buildExportPayload — field name presets', () => {
  it('naxa preset: uses nodeType, row, col, from, to', () => {
    const payload = buildExportPayload(MAP, opts({ fieldNames: FIELD_PRESETS.naxa, excludeDefaultBlocked: false })) as {
      cells: Record<string, unknown>[]
      edges: Record<string, unknown>[]
    }
    expect(payload.cells[0]).toHaveProperty('nodeType')
    expect(payload.cells[0]).toHaveProperty('row')
    expect(payload.cells[0]).toHaveProperty('col')
    expect(payload.edges[0]).toHaveProperty('from')
    expect(payload.edges[0]).toHaveProperty('to')
  })

  it('ros2 preset: uses type, y, x, source, target', () => {
    const payload = buildExportPayload(MAP, opts({ fieldNames: FIELD_PRESETS.ros2, excludeDefaultBlocked: false })) as {
      cells: Record<string, unknown>[]
      edges: Record<string, unknown>[]
    }
    expect(payload.cells[0]).toHaveProperty('type')
    expect(payload.cells[0]).toHaveProperty('y')
    expect(payload.cells[0]).toHaveProperty('x')
    expect(payload.edges[0]).toHaveProperty('source')
    expect(payload.edges[0]).toHaveProperty('target')
  })

  it('amr preset: uses node_type, row, col, from_node, to_node', () => {
    const payload = buildExportPayload(MAP, opts({ fieldNames: FIELD_PRESETS.amr, excludeDefaultBlocked: false })) as {
      cells: Record<string, unknown>[]
      edges: Record<string, unknown>[]
    }
    expect(payload.cells[0]).toHaveProperty('node_type')
    expect(payload.edges[0]).toHaveProperty('from_node')
    expect(payload.edges[0]).toHaveProperty('to_node')
  })
})

// ── optional sections ─────────────────────────────────────────────────────────

describe('buildExportPayload — optional sections', () => {
  it('includeConfig: false omits config', () => {
    const p = buildExportPayload(MAP, opts({ includeConfig: false }))
    expect(p).not.toHaveProperty('config')
  })

  it('includeConfig: true adds config', () => {
    const p = buildExportPayload(MAP, opts({ includeConfig: true })) as { config: unknown }
    expect(p.config).toMatchObject({ rows: 2, cols: 2 })
  })

  it('includeLayers: false omits layers', () => {
    const p = buildExportPayload(MAP, opts({ includeLayers: false }))
    expect(p).not.toHaveProperty('layers')
  })

  it('includeLayers: true adds layer list without color', () => {
    const p = buildExportPayload(MAP, opts({ includeLayers: true })) as {
      layers: { id: string; nodeType: string; visible: boolean }[]
    }
    expect(p.layers).toHaveLength(1)
    expect(p.layers[0]).toMatchObject({ id: 'l1', nodeType: 'source', visible: true })
    // color is stripped from layer output
    expect(p.layers[0]).not.toHaveProperty('color')
  })
})

// ── cell fields: optional subtype / label / metadata ─────────────────────────

describe('buildExportPayload — per-cell optional fields', () => {
  it('includes subtype and label when present', () => {
    const { cells } = buildExportPayload(MAP, opts({ excludeDefaultBlocked: false })) as {
      cells: Record<string, unknown>[]
    }
    const source = cells.find(c => c.id === 'r0c1')!
    expect(source.subtype).toBe('feeder')
    expect(source.label).toBe('S1')
  })

  it('omits subtype and label when absent', () => {
    const { cells } = buildExportPayload(MAP, opts({ excludeDefaultBlocked: false })) as {
      cells: Record<string, unknown>[]
    }
    const traversable = cells.find(c => c.id === 'r1c0')!
    expect(traversable).not.toHaveProperty('subtype')
    expect(traversable).not.toHaveProperty('label')
  })
})

// ── edge fields ───────────────────────────────────────────────────────────────

describe('buildExportPayload — edges', () => {
  it('maps from/to correctly', () => {
    const { edges } = buildExportPayload(MAP, opts()) as { edges: Record<string, unknown>[] }
    expect(edges[0].from).toBe('r0c1')
    expect(edges[0].to).toBe('r1c1')
    expect(edges[0].bidirectional).toBe(false)
  })

  it('omits cost when not set', () => {
    const { edges } = buildExportPayload(MAP, opts()) as { edges: Record<string, unknown>[] }
    expect(edges[0]).not.toHaveProperty('cost')
  })

  it('includes cost when set', () => {
    const mapWithCost: GridMap = {
      ...MAP,
      edges: [{ ...MAP.edges[0], cost: 1.5 }],
    }
    const { edges } = buildExportPayload(mapWithCost, opts()) as { edges: Record<string, unknown>[] }
    expect(edges[0].cost).toBe(1.5)
  })
})
