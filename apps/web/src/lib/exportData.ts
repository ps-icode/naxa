/**
 * Pure data-transform functions for custom export.
 * No Konva dependency — safe to import in tests and non-browser contexts.
 */
import type { GridMap } from '@naxa/core'

export interface ExportFieldNames {
  cellType: string   // GridCell.nodeType key in output
  row: string        // GridCell.coord.row key in output
  col: string        // GridCell.coord.col key in output
  edgeFrom: string   // Edge.from key in output
  edgeTo: string     // Edge.to key in output
}

export interface ExportOptions {
  format: 'json' | 'yaml'
  coordOrigin: 0 | 1          // offset added to row/col values in output
  excludeDefaultBlocked: boolean
  includeConfig: boolean
  includeLayers: boolean
  fieldNames: ExportFieldNames
}

export const FIELD_PRESETS: Record<string, ExportFieldNames> = {
  naxa: { cellType: 'nodeType',   row: 'row', col: 'col', edgeFrom: 'from',      edgeTo: 'to'      },
  ros2: { cellType: 'type',       row: 'y',   col: 'x',  edgeFrom: 'source',    edgeTo: 'target'   },
  amr:  { cellType: 'node_type',  row: 'row', col: 'col', edgeFrom: 'from_node', edgeTo: 'to_node'  },
}

export function buildExportPayload(map: GridMap, opts: ExportOptions): Record<string, unknown> {
  const fn = opts.fieldNames
  const cells = map.cells
    .filter(c => !opts.excludeDefaultBlocked || !(c.nodeType === 'blocked' && !c.subtype))
    .map(c => {
      const out: Record<string, unknown> = {
        id: c.id,
        [fn.row]: c.coord.row + opts.coordOrigin,
        [fn.col]: c.coord.col + opts.coordOrigin,
        [fn.cellType]: c.nodeType,
      }
      if (c.subtype !== undefined) out.subtype = c.subtype
      if (c.label !== undefined) out.label = c.label
      if (c.metadata !== undefined) out.metadata = c.metadata
      return out
    })

  const edges = map.edges.map(e => {
    const out: Record<string, unknown> = {
      id: e.id,
      [fn.edgeFrom]: e.from,
      [fn.edgeTo]: e.to,
      bidirectional: e.bidirectional,
    }
    if (e.cost !== undefined) out.cost = e.cost
    return out
  })

  const payload: Record<string, unknown> = { name: map.name, cells, edges }
  if (opts.includeConfig) payload.config = { ...map.config }
  if (opts.includeLayers) payload.layers = map.layers.map(l => ({ id: l.id, name: l.name, nodeType: l.nodeType, visible: l.visible }))
  return payload
}

function needsYAMLQuotes(s: string): boolean {
  if (s === '') return true
  if (/^(true|false|null|~|yes|no|on|off)$/i.test(s)) return true
  if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return true
  if (/[:#\[\]{},&*?|<>=!%@`'"\\]|^\s|\s$/.test(s)) return true
  return false
}

function toYAML(val: unknown, indent: number): string {
  const pad = '  '.repeat(indent)
  if (val === null || val === undefined) return 'null'
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'string') return needsYAMLQuotes(val) ? JSON.stringify(val) : val
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]'
    return val.map(item => {
      if (item === null || item === undefined || typeof item !== 'object' || Array.isArray(item)) {
        return `${pad}- ${toYAML(item, indent + 1)}`
      }
      const entries = Object.entries(item as Record<string, unknown>)
      if (entries.length === 0) return `${pad}- {}`
      const [fk, fv] = entries[0]
      const firstLine = typeof fv === 'object' && fv !== null
        ? `${pad}- ${fk}:\n${toYAML(fv, indent + 2)}`
        : `${pad}- ${fk}: ${toYAML(fv, indent + 1)}`
      const innerPad = '  '.repeat(indent + 1)
      const rest = entries.slice(1).map(([k, v]) => {
        if (typeof v === 'object' && v !== null) {
          if (Array.isArray(v) && (v as unknown[]).length === 0) return `${innerPad}${k}: []`
          return `${innerPad}${k}:\n${toYAML(v, indent + 2)}`
        }
        return `${innerPad}${k}: ${toYAML(v, indent + 1)}`
      })
      return [firstLine, ...rest].join('\n')
    }).join('\n')
  }
  const entries = Object.entries(val as Record<string, unknown>)
  if (entries.length === 0) return '{}'
  return entries.map(([k, v]) => {
    if (typeof v === 'object' && v !== null) {
      if (Array.isArray(v) && (v as unknown[]).length === 0) return `${pad}${k}: []`
      return `${pad}${k}:\n${toYAML(v, indent + 1)}`
    }
    return `${pad}${k}: ${toYAML(v, indent)}`
  }).join('\n')
}

export function downloadCustomExport(map: GridMap, opts: ExportOptions): void {
  const payload = buildExportPayload(map, opts)
  let content: string
  let ext: string
  let mime: string
  if (opts.format === 'yaml') {
    content = toYAML(payload, 0) + '\n'
    ext = 'yaml'
    mime = 'text/yaml'
  } else {
    content = JSON.stringify(payload, null, 2)
    ext = 'json'
    mime = 'application/json'
  }
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${map.name.replace(/\s+/g, '_')}_export.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}
