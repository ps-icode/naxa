import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { buildExportPayload, FIELD_PRESETS, toYAML, needsYAMLQuotes, downloadCustomExport } from '../../lib/exportData'
import type { ExportOptions } from '../../lib/exportData'
import type { GridMap } from '@naxa/core'

// ── fixture ───────────────────────────────────────────────────────────────────

const MAP: GridMap = {
  id: 'test', name: 'Test Map', createdAt: '', updatedAt: '',
  config: { rows: 2, cols: 2, cellShape: 'square', cellSizeMeters: 0.5 },
  cells: [
    { id: 'r0c0', coord: { row: 0, col: 0 }, nodeType: 'blocked', assigned: false },   // default/unassigned
    { id: 'r0c1', coord: { row: 0, col: 1 }, nodeType: 'source', assigned: true, subtype: 'feeder', label: 'S1' },
    { id: 'r1c0', coord: { row: 1, col: 0 }, nodeType: 'traversable', assigned: true },
    { id: 'r1c1', coord: { row: 1, col: 1 }, nodeType: 'destination', assigned: true },
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

  it('keeps explicitly-assigned blocked cell (assigned: true)', () => {
    const mapWithAssigned: GridMap = {
      ...MAP,
      cells: [{ id: 'r0c0', coord: { row: 0, col: 0 }, nodeType: 'blocked', assigned: true }],
    }
    const { cells } = buildExportPayload(mapWithAssigned, opts({ excludeDefaultBlocked: true })) as { cells: { id: string }[] }
    expect(cells).toHaveLength(1)
    expect(cells[0].id).toBe('r0c0')
  })

  it('omits unassigned blocked cell (assigned: false)', () => {
    const mapUnassigned: GridMap = {
      ...MAP,
      cells: [{ id: 'r0c0', coord: { row: 0, col: 0 }, nodeType: 'blocked', assigned: false }],
    }
    const { cells } = buildExportPayload(mapUnassigned, opts({ excludeDefaultBlocked: true })) as { cells: { id: string }[] }
    expect(cells).toHaveLength(0)
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
  it('includes subtype, label, and metadata when present', () => {
    const mapWithMeta: GridMap = {
      ...MAP,
      cells: [{ id: 'r0c0', coord: { row: 0, col: 0 }, nodeType: 'source', assigned: true,
        subtype: 'feeder', label: 'S1', metadata: { zone: 'A' } }],
    }
    const { cells } = buildExportPayload(mapWithMeta, opts({ excludeDefaultBlocked: false })) as {
      cells: Record<string, unknown>[]
    }
    expect(cells[0].subtype).toBe('feeder')
    expect(cells[0].label).toBe('S1')
    expect(cells[0].metadata).toEqual({ zone: 'A' })
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

// ── needsYAMLQuotes ───────────────────────────────────────────────────────────

describe('needsYAMLQuotes', () => {
  it('empty string needs quotes', () => { expect(needsYAMLQuotes('')).toBe(true) })
  it('boolean-like strings need quotes', () => {
    expect(needsYAMLQuotes('true')).toBe(true)
    expect(needsYAMLQuotes('false')).toBe(true)
    expect(needsYAMLQuotes('null')).toBe(true)
    expect(needsYAMLQuotes('yes')).toBe(true)
    expect(needsYAMLQuotes('no')).toBe(true)
  })
  it('numeric strings need quotes', () => {
    expect(needsYAMLQuotes('42')).toBe(true)
    expect(needsYAMLQuotes('3.14')).toBe(true)
    expect(needsYAMLQuotes('1e10')).toBe(true)
  })
  it('strings with special chars need quotes', () => {
    expect(needsYAMLQuotes('foo: bar')).toBe(true)
    expect(needsYAMLQuotes('[arr]')).toBe(true)
    expect(needsYAMLQuotes(' leading')).toBe(true)
  })
  it('plain identifiers do not need quotes', () => {
    expect(needsYAMLQuotes('hello')).toBe(false)
    expect(needsYAMLQuotes('source')).toBe(false)
    expect(needsYAMLQuotes('r0c0')).toBe(false)
  })
})

// ── toYAML ────────────────────────────────────────────────────────────────────

describe('toYAML', () => {
  it('serializes null/undefined as null', () => {
    expect(toYAML(null, 0)).toBe('null')
    expect(toYAML(undefined, 0)).toBe('null')
  })

  it('serializes booleans', () => {
    expect(toYAML(true, 0)).toBe('true')
    expect(toYAML(false, 0)).toBe('false')
  })

  it('serializes numbers', () => {
    expect(toYAML(42, 0)).toBe('42')
    expect(toYAML(3.14, 0)).toBe('3.14')
  })

  it('serializes plain strings without quotes', () => {
    expect(toYAML('hello', 0)).toBe('hello')
  })

  it('serializes special strings with JSON quotes', () => {
    expect(toYAML('true', 0)).toBe('"true"')
    expect(toYAML('', 0)).toBe('""')
  })

  it('serializes empty array as []', () => {
    expect(toYAML([], 0)).toBe('[]')
  })

  it('serializes empty object as {}', () => {
    expect(toYAML({}, 0)).toBe('{}')
  })

  it('serializes array of scalars', () => {
    const result = toYAML([1, 2], 0)
    expect(result).toContain('- 1')
    expect(result).toContain('- 2')
  })

  it('serializes array of objects (YAML block sequence)', () => {
    const result = toYAML([{ id: 'a', type: 'source' }], 0)
    expect(result).toContain('- id: a')
    expect(result).toContain('type: source')
  })

  it('serializes nested objects', () => {
    const result = toYAML({ name: 'test', config: { rows: 2, cols: 3 } }, 0)
    expect(result).toContain('name: test')
    expect(result).toContain('config:')
    expect(result).toContain('rows: 2')
  })

  it('handles object with empty array value', () => {
    const result = toYAML({ items: [] }, 0)
    expect(result).toContain('items: []')
  })

  it('handles array item with nested object value for first key', () => {
    const result = toYAML([{ meta: { x: 1 } }], 0)
    expect(result).toContain('meta:')
    expect(result).toContain('x: 1')
  })

  it('handles array item with empty-array property', () => {
    const result = toYAML([{ id: 'a', tags: [] }], 0)
    expect(result).toContain('tags: []')
  })

  it('handles array item where non-first key has a nested object value', () => {
    const result = toYAML([{ id: 'a', meta: { x: 1 } }], 0)
    expect(result).toContain('id: a')
    expect(result).toContain('meta:')
    expect(result).toContain('x: 1')
  })

  it('serializes empty-object array item as - {}', () => {
    const result = toYAML([{}], 0)
    expect(result).toContain('- {}')
  })
})

// ── downloadCustomExport ──────────────────────────────────────────────────────

describe('downloadCustomExport', () => {
  const clickSpy = vi.fn()
  const revokeSpy = vi.fn()

  beforeAll(() => {
    // jsdom doesn't implement createObjectURL / revokeObjectURL
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:fake',
      revokeObjectURL: revokeSpy,
    })
    // Spy on anchor click
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag)
      if (tag === 'a') {
        Object.defineProperty(el, 'click', { value: clickSpy, writable: true })
      }
      return el
    })
  })

  afterAll(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('triggers a download click for JSON format', () => {
    clickSpy.mockClear()
    downloadCustomExport(MAP, opts({ format: 'json' }))
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('triggers a download click for YAML format', () => {
    clickSpy.mockClear()
    downloadCustomExport(MAP, opts({ format: 'yaml' }))
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('sets download filename from map name with spaces replaced', () => {
    clickSpy.mockClear()
    const anchorSpy = vi.spyOn(document, 'createElement')
    downloadCustomExport(MAP, opts({ format: 'json' }))
    const anchor = anchorSpy.mock.results.find(r => (r.value as HTMLElement).tagName === 'A')?.value as HTMLAnchorElement
    expect(anchor?.download).toMatch(/Test_Map_export\.json/)
  })

  it('revokes the object URL after download', () => {
    revokeSpy.mockClear()
    downloadCustomExport(MAP, opts({ format: 'json' }))
    expect(revokeSpy).toHaveBeenCalledWith('blob:fake')
  })
})
