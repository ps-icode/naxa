import { useState } from 'react'
import { useGridStore } from '../../store/gridStore'
import { useUIStore } from '../../store/uiStore'
import { api } from '../../lib/api'
import { NODE_TYPE_COLORS, SUBTYPES } from '@naxa/core'
import { PANE_THEMES } from '../../lib/themes'
import type { NodeType } from '@naxa/core'

const ICONS: Record<string, string> = {
  lane: '→', source: 'S', destination: 'D',
  charging: '⚡', parking: 'P', blocked: '✕', junction: '✦',
}

const LAYER_INFO: Record<string, string> = {
  lane:        'Navigable pathways connecting all cells. Draw by dragging between adjacent cells.',
  source:      'Pickup / induction points where robots begin tasks (pick, feeder, conveyor_in…).',
  destination: 'Drop-off / delivery endpoints where robots complete tasks (drop, bin, conveyor_out…).',
  charging:    'Battery charging stations. Robots route here when power is low.',
  parking:     'Idle or maintenance zones where robots wait between tasks.',
  blocked:     'Obstacles and no-go zones. Robots cannot enter or traverse these cells.',
  junction:    'Topology decision points: merge, diverge, crossover, or roundabout intersections.',
}

export default function LayerPanel() {
  const {
    map, toggleLayerVisibility, savedList, loadMap, updateMapName,
    setCellSubtype, setCellLabel, clearEdges, resetCells,
  } = useGridStore()
  const {
    tool, activeNodeType, setActiveNodeType, showToast, setShowNewMapModal,
    selectedCellId, mapBg, requestFitToScreen,
  } = useUIStore()

  const pt = PANE_THEMES[mapBg]

  // Inline map name editing
  const [nameEditing, setNameEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  const commitName = () => {
    const trimmed = nameDraft.trim()
    if (trimmed && map && trimmed !== map.name) updateMapName(trimmed)
    setNameEditing(false)
  }

  const handleLoadJSON = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string)
          if (!parsed.cells || !parsed.config || !parsed.edges || !parsed.layers) {
            throw new Error('Invalid map file')
          }
          loadMap(parsed)
          showToast(`Loaded "${parsed.name}" ✓`)
        } catch {
          showToast('Invalid map file', 'error')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  if (!map) return <EmptyState onNew={() => setShowNewMapModal(true)} pt={pt} />

  const selectedCell = selectedCellId ? map.cells.find(c => c.id === selectedCellId) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* Map title (click to edit) */}
      <div style={{ paddingBottom: 14, marginBottom: 14, borderBottom: `1px solid ${pt.border}` }}>
        <div style={{ fontSize: 10, color: pt.label, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Map</div>
        {nameEditing ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setNameEditing(false) }}
            style={{
              width: '100%', padding: '3px 6px', borderRadius: 4, fontSize: 13,
              fontWeight: 600, border: `1px solid ${NODE_TYPE_COLORS.source}`,
              background: pt.inputBg, color: pt.textPrimary, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <div
            title="Click to rename"
            onClick={() => { setNameDraft(map.name); setNameEditing(true) }}
            style={{
              fontSize: 13, fontWeight: 600, color: pt.textPrimary,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              cursor: 'text', padding: '2px 0',
            }}
          >
            {map.name} <span style={{ fontSize: 9, color: pt.label, marginLeft: 2 }}>✎</span>
          </div>
        )}
        <div style={{ fontSize: 11, color: pt.label, marginTop: 2 }}>{map.config.rows}×{map.config.cols} · {map.config.cellShape}</div>
      </div>

      {/* Layers */}
      <div style={{ marginBottom: 14, flexShrink: 0 }}>
        <SectionLabel pt={pt}>Layers</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {map.layers.map(layer => {
            const isActive = tool === 'type' && activeNodeType === layer.nodeType
            return (
              <div
                key={layer.id}
                title={LAYER_INFO[layer.nodeType]}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '6px 8px', borderRadius: 5, cursor: 'pointer',
                  background: isActive ? 'rgba(96,165,250,0.1)' : 'transparent',
                  border: isActive ? '1px solid rgba(96,165,250,0.25)' : `1px solid transparent`,
                }}
                onClick={() => { if (tool === 'type') setActiveNodeType(layer.nodeType as NodeType) }}
              >
                <div
                  style={{
                    width: 12, height: 12, borderRadius: 2, flexShrink: 0, cursor: 'pointer',
                    border: `2px solid ${layer.visible ? layer.color : pt.label}`,
                    background: layer.visible ? layer.color : 'transparent',
                  }}
                  onClick={e => { e.stopPropagation(); toggleLayerVisibility(layer.id) }}
                />
                <span style={{ fontSize: 12, color: pt.muted, width: 12, textAlign: 'center', flexShrink: 0 }}>{ICONS[layer.nodeType]}</span>
                <span style={{ fontSize: 12, flex: 1, color: layer.visible ? pt.text : pt.label }}>
                  {layer.name}
                  <span style={{ fontSize: 9, color: pt.label, marginLeft: 4 }} title={LAYER_INFO[layer.nodeType]}>ⓘ</span>
                </span>
                {isActive && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#60a5fa' }} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Cell info panel */}
      {selectedCell && selectedCell.nodeType !== 'lane' && (
        <CellInfoPanel
          key={selectedCellId}
          cell={selectedCell}
          pt={pt}
          onSubtype={sub => setCellSubtype(selectedCell.id, sub)}
          onLabel={lbl => setCellLabel(selectedCell.id, lbl || undefined)}
        />
      )}

      {/* Stats */}
      <div style={{ marginBottom: 14, flexShrink: 0 }}>
        <SectionLabel pt={pt}>Stats</SectionLabel>
        <StatRow label="Typed cells" value={map.cells.filter(c => c.nodeType !== 'lane').length} pt={pt} />
        <StatRow label="Lanes" value={map.edges.length} pt={pt} />
        <StatRow label="Scale" value={`${map.config.cellSizeMeters}m/cell`} pt={pt} />
        <StatRow label="Area" value={`${(map.config.rows * map.config.cols * map.config.cellSizeMeters ** 2).toFixed(1)} m²`} pt={pt} />
      </div>

      <div style={{ flex: 1 }} />

      {/* Saved maps */}
      {savedList.length > 0 && (
        <div style={{ paddingTop: 10, borderTop: `1px solid ${pt.border}`, overflow: 'auto', maxHeight: 150, marginBottom: 10 }}>
          <SectionLabel pt={pt}>Saved</SectionLabel>
          {savedList.map(m => (
            <div
              key={m.id}
              style={{
                padding: '5px 6px', borderRadius: 4, cursor: 'pointer', fontSize: 11,
                color: m.id === map.id ? '#60a5fa' : pt.muted,
                background: m.id === map.id ? 'rgba(96,165,250,0.08)' : 'transparent',
              }}
              onClick={async () => {
                try { loadMap(await api.maps.get(m.id)) }
                catch { showToast('Failed to load', 'error') }
              }}
            >
              {m.name}
            </div>
          ))}
        </div>
      )}

      {/* New Map + Load */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <button onClick={() => setShowNewMapModal(true)} style={{ ...newMapBtn, flex: 1 }}>+ New Map</button>
        <button onClick={handleLoadJSON} style={loadBtn(pt)} title="Load map from a .naxa.json file">↑ Load</button>
      </div>

      {/* Reset + Fit buttons */}
      <div style={{ display: 'flex', gap: 5 }}>
        <button
          onClick={requestFitToScreen}
          title="Fit map to viewport"
          style={{ ...resetBtn(pt), flex: 1, color: '#60a5fa', borderColor: 'rgba(96,165,250,0.3)' }}
        >
          ⤢ Fit
        </button>
        <button
          onClick={() => { clearEdges(); showToast('Lanes cleared ✓') }}
          title="Remove all lanes (keep cell types)"
          style={resetBtn(pt)}
        >
          ↺ Lanes
        </button>
        <button
          onClick={() => { resetCells(); showToast('Map reset ✓') }}
          title="Reset entire map to blank grid"
          style={resetBtn(pt)}
        >
          ↺ All
        </button>
      </div>
    </div>
  )
}

// ── Cell info / subtype panel ─────────────────────────────────────────────────
interface CellInfoPanelProps {
  cell: { id: string; nodeType: NodeType; subtype?: string; label?: string; coord: { row: number; col: number } }
  pt: typeof PANE_THEMES.dark
  onSubtype: (s: string | undefined) => void
  onLabel: (l: string) => void
}

function CellInfoPanel({ cell, pt, onSubtype, onLabel }: CellInfoPanelProps) {
  const [labelDraft, setLabelDraft] = useState(cell.label ?? '')
  const options = SUBTYPES[cell.nodeType] ?? []
  const color = NODE_TYPE_COLORS[cell.nodeType]

  return (
    <div style={{
      padding: '10px 10px', marginBottom: 14, borderRadius: 6,
      border: `1px solid ${color}44`, background: `${color}0d`,
    }}>
      <div style={{ fontSize: 10, color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        {ICONS[cell.nodeType]} {cell.nodeType} · r{cell.coord.row + 1}c{cell.coord.col + 1}
      </div>

      {/* Subtype chips */}
      {options.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: pt.muted, marginBottom: 5 }}>Subtype</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {options.map(opt => (
              <button
                key={opt}
                onClick={() => onSubtype(cell.subtype === opt ? undefined : opt)}
                style={{
                  padding: '2px 7px', borderRadius: 10, fontSize: 10, cursor: 'pointer',
                  border: `1px solid ${cell.subtype === opt ? color : pt.border}`,
                  background: cell.subtype === opt ? color + '33' : 'transparent',
                  color: cell.subtype === opt ? color : pt.muted,
                }}
              >
                {opt.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom label */}
      <div>
        <div style={{ fontSize: 10, color: pt.muted, marginBottom: 4 }}>Label</div>
        <input
          value={labelDraft}
          onChange={e => setLabelDraft(e.target.value)}
          onBlur={() => onLabel(labelDraft)}
          onKeyDown={e => e.key === 'Enter' && onLabel(labelDraft)}
          placeholder={cell.subtype ?? 'e.g. feeder_1, bin_2…'}
          style={{
            width: '100%', padding: '5px 8px', borderRadius: 4, fontSize: 11,
            border: `1px solid ${pt.border}`, background: pt.inputBg, color: pt.textPrimary,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  )
}

function EmptyState({ onNew, pt }: { onNew: () => void; pt: typeof PANE_THEMES.dark }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, padding: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 28 }}>🗺️</div>
      <div style={{ fontSize: 12, color: pt.label, lineHeight: 1.7 }}>
        Create a grid map to start designing navigation lanes
      </div>
      <button onClick={onNew} style={newMapBtn}>+ New Map</button>
    </div>
  )
}

function SectionLabel({ children, pt }: { children: React.ReactNode; pt: typeof PANE_THEMES.dark }) {
  return <div style={{ fontSize: 10, color: pt.label, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 7 }}>{children}</div>
}

function StatRow({ label, value, pt }: { label: string; value: string | number; pt: typeof PANE_THEMES.dark }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
      <span style={{ fontSize: 11, color: pt.label }}>{label}</span>
      <span style={{ fontSize: 11, color: pt.text }}>{value}</span>
    </div>
  )
}

const newMapBtn: React.CSSProperties = {
  width: '100%', padding: '7px 0', borderRadius: 5,
  border: '1px solid #1e40af', background: '#1e3a8a',
  color: '#93c5fd', fontSize: 12, cursor: 'pointer', fontWeight: 500,
}

const loadBtn = (pt: typeof PANE_THEMES.dark): React.CSSProperties => ({
  padding: '7px 10px', borderRadius: 5,
  border: `1px solid ${pt.border}`, background: pt.inputBg,
  color: pt.muted, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
})

const resetBtn = (pt: typeof PANE_THEMES.dark): React.CSSProperties => ({
  padding: '5px 0', borderRadius: 5, fontSize: 11, cursor: 'pointer',
  border: `1px solid ${pt.border}`, background: pt.inputBg,
  color: pt.muted, whiteSpace: 'nowrap',
})
