import Konva from 'konva'
import type { GridMap } from '@naxa/core'
import { NODE_TYPE_COLORS } from '@naxa/core'
import {
  getCellCenter, totalCanvasSize,
  HEX_RADIUS, SQUARE_SIZE, RECT_W, RECT_H,
} from './grid/geometry'

const NODE_ICONS: Record<string, string> = {
  source: 'S', destination: 'D', charging: '⚡', parking: 'P', blocked: '✕', junction: '✦',
}

/** Exports the map to a clean PNG that matches the screen — zoom/pan independent. */
export function exportPNG(map: GridMap): void {
  const visibleTypes = new Set(
    map.layers.filter(l => l.visible).map(l => l.nodeType),
  )

  const { w, h } = totalCanvasSize(map.config)
  const PIX = 2  // retina

  // Create an off-screen container (not visible to user)
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-99999px;top:0;visibility:hidden;'
  document.body.appendChild(container)

  const stage = new Konva.Stage({ container, width: w, height: h })
  const layer = new Konva.Layer()
  stage.add(layer)

  // Background
  layer.add(new Konva.Rect({ x: 0, y: 0, width: w, height: h, fill: '#080818' }))

  const shape = map.config.cellShape

  // Cells
  for (const cell of map.cells) {
    const typed = cell.nodeType !== 'lane'
    const visible = !typed || visibleTypes.has(cell.nodeType)
    const opacity = typed ? 0.8 : 1

    const center = getCellCenter(cell.coord, map.config)
    const fill = typed ? NODE_TYPE_COLORS[cell.nodeType] : '#0d1424'
    const stroke = typed ? NODE_TYPE_COLORS[cell.nodeType] : '#1e293b'
    const strokeWidth = typed ? 2 : 1

    if (!visible) continue

    if (shape === 'hexagon') {
      layer.add(new Konva.RegularPolygon({
        x: center.x, y: center.y, sides: 6, radius: HEX_RADIUS - 1,
        fill, stroke, strokeWidth, opacity,
      }))
    } else {
      const cw = shape === 'rectangle' ? RECT_W : SQUARE_SIZE
      const ch = shape === 'rectangle' ? RECT_H : SQUARE_SIZE
      layer.add(new Konva.Rect({
        x: center.x - cw / 2 + 1, y: center.y - ch / 2 + 1,
        width: cw - 2, height: ch - 2,
        cornerRadius: 4, fill, stroke, strokeWidth, opacity,
      }))
    }

    if (typed) {
      const text = cell.label ?? cell.subtype?.replace(/_/g, ' ') ?? NODE_ICONS[cell.nodeType] ?? ''
      const cw = shape === 'hexagon' ? 32 : shape === 'rectangle' ? RECT_W : SQUARE_SIZE
      layer.add(new Konva.Text({
        x: center.x - cw / 2, y: center.y - 7,
        width: cw, text,
        fontSize: cell.subtype ? 8 : 10, fontStyle: 'bold',
        fill: '#fff', align: 'center', listening: false,
      }))
    }
  }

  // Edges
  const cellById = new Map(map.cells.map(c => [c.id, c]))
  for (const edge of map.edges) {
    const from = cellById.get(edge.from)
    const to = cellById.get(edge.to)
    if (!from || !to) continue

    const p1 = getCellCenter(from.coord, map.config)
    const p2 = getCellCenter(to.coord, map.config)
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const dist = Math.hypot(dx, dy)
    if (dist < 4) continue

    const trim = Math.min(dist / 2 - 4, 22)
    const ux = dx / dist
    const uy = dy / dist

    layer.add(new Konva.Arrow({
      points: [p1.x + ux * trim, p1.y + uy * trim, p2.x - ux * trim, p2.y - uy * trim],
      pointerAtBeginning: edge.bidirectional,
      pointerAtEnding: true,
      pointerLength: 8, pointerWidth: 6,
      stroke: '#60a5fa', strokeWidth: 2, fill: '#60a5fa',
      shadowColor: '#60a5fa', shadowBlur: 4, shadowOpacity: 0.5,
    }))
  }

  layer.batchDraw()

  const uri = stage.toDataURL({ pixelRatio: PIX })
  stage.destroy()
  document.body.removeChild(container)

  const a = document.createElement('a')
  a.href = uri
  a.download = `${map.name.replace(/\s+/g, '_')}.png`
  a.click()
}

/** Exports the full GridMap data as a JSON file. */
export function exportJSON(map: GridMap): void {
  const blob = new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${map.name.replace(/\s+/g, '_')}.naxa.json`
  a.click()
  URL.revokeObjectURL(url)
}
