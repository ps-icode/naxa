import { useState } from 'react'
import { useGridStore } from '../../store/gridStore'
import { useUIStore } from '../../store/uiStore'
import { api } from '../../lib/api'
import { NODE_TYPE_COLORS, SUBTYPES } from '@naxa/core'
import type { NodeType } from '@naxa/core'

const ICONS: Record<string, string> = {
  lane: '→', source: 'S', destination: 'D',
  charging: '⚡', parking: 'P', blocked: '✕', junction: '✦',
}

export default function LayerPanel() {
  const { map, toggleLayerVisibility, savedList, loadMap, setCellSubtype, setCellLabel } = useGridStore()
  const { tool, activeNodeType, setActiveNodeType, showToast, setShowNewMapModal, selectedCellId } = useUIStore()

  if (!map) return <EmptyState onNew={() => setShowNewMapModal(true)} />

  const selectedCell = selectedCellId ? map.cells.find(c => c.id === selectedCellId) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* Map title */}
      <div style={{ paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid #1e293b' }}>
        <div style={{ fontSize: 10, color: '#334155', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Map</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{map.name}</div>
        <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>{map.config.rows}×{map.config.cols} · {map.config.cellShape}</div>
      </div>

      {/* Layers */}
      <div style={{ marginBottom: 14, flexShrink: 0 }}>
        <SectionLabel>Layers</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {map.layers.map(layer => {
            const isActive = tool === 'type' && activeNodeType === layer.nodeType
            return (
              <div
                key={layer.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '6px 8px', borderRadius: 5, cursor: 'pointer',
                  background: isActive ? 'rgba(96,165,250,0.1)' : 'transparent',
                  border: isActive ? '1px solid rgba(96,165,250,0.25)' : '1px solid transparent',
                }}
                onClick={() => { if (tool === 'type') setActiveNodeType(layer.nodeType as NodeType) }}
              >
                <div
                  style={{
                    width: 12, height: 12, borderRadius: 2, flexShrink: 0, cursor: 'pointer',
                    border: `2px solid ${layer.visible ? layer.color : '#334155'}`,
                    background: layer.visible ? layer.color : 'transparent',
                  }}
                  onClick={e => { e.stopPropagation(); toggleLayerVisibility(layer.id) }}
                />
                <span style={{ fontSize: 12, color: '#475569', width: 12, textAlign: 'center', flexShrink: 0 }}>{ICONS[layer.nodeType]}</span>
                <span style={{ fontSize: 12, flex: 1, color: layer.visible ? '#cbd5e1' : '#334155' }}>{layer.name}</span>
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
          onSubtype={sub => setCellSubtype(selectedCell.id, sub)}
          onLabel={lbl => setCellLabel(selectedCell.id, lbl || undefined)}
        />
      )}

      {/* Stats */}
      <div style={{ marginBottom: 14, flexShrink: 0 }}>
        <SectionLabel>Stats</SectionLabel>
        <StatRow label="Typed cells" value={map.cells.filter(c => c.nodeType !== 'lane').length} />
        <StatRow label="Lanes" value={map.edges.length} />
        <StatRow label="Scale" value={`${map.config.cellSizeMeters}m/cell`} />
      </div>

      <div style={{ flex: 1 }} />

      {/* Saved maps */}
      {savedList.length > 0 && (
        <div style={{ paddingTop: 10, borderTop: '1px solid #1e293b', overflow: 'auto', maxHeight: 150, marginBottom: 10 }}>
          <SectionLabel>Saved</SectionLabel>
          {savedList.map(m => (
            <div
              key={m.id}
              style={{
                padding: '5px 6px', borderRadius: 4, cursor: 'pointer', fontSize: 11,
                color: m.id === map.id ? '#60a5fa' : '#475569',
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

      <button onClick={() => setShowNewMapModal(true)} style={newMapBtn}>+ New Map</button>
    </div>
  )
}

// ── Cell info / subtype panel ─────────────────────────────────────────────────
interface CellInfoPanelProps {
  cell: { id: string; nodeType: NodeType; subtype?: string; label?: string; coord: { row: number; col: number } }
  onSubtype: (s: string | undefined) => void
  onLabel: (l: string) => void
}

function CellInfoPanel({ cell, onSubtype, onLabel }: CellInfoPanelProps) {
  const [labelDraft, setLabelDraft] = useState(cell.label ?? '')
  const options = SUBTYPES[cell.nodeType] ?? []
  const color = NODE_TYPE_COLORS[cell.nodeType]

  return (
    <div style={{
      padding: '10px 10px', marginBottom: 14, borderRadius: 6,
      border: `1px solid ${color}44`, background: `${color}0d`,
    }}>
      <div style={{ fontSize: 10, color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        {ICONS[cell.nodeType]} {cell.nodeType} · r{cell.coord.row}c{cell.coord.col}
      </div>

      {/* Subtype chips */}
      {options.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 5 }}>Subtype</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {options.map(opt => (
              <button
                key={opt}
                onClick={() => onSubtype(cell.subtype === opt ? undefined : opt)}
                style={{
                  padding: '2px 7px', borderRadius: 10, fontSize: 10, cursor: 'pointer',
                  border: `1px solid ${cell.subtype === opt ? color : '#1e293b'}`,
                  background: cell.subtype === opt ? color + '33' : 'transparent',
                  color: cell.subtype === opt ? color : '#475569',
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
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>Label</div>
        <input
          value={labelDraft}
          onChange={e => setLabelDraft(e.target.value)}
          onBlur={() => onLabel(labelDraft)}
          onKeyDown={e => e.key === 'Enter' && onLabel(labelDraft)}
          placeholder={cell.subtype ?? 'e.g. feeder_1, bin_2…'}
          style={{
            width: '100%', padding: '5px 8px', borderRadius: 4, fontSize: 11,
            border: '1px solid #1e293b', background: '#060614', color: '#e2e8f0',
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, padding: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 28 }}>🗺️</div>
      <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.7 }}>
        Create a grid map to start designing navigation lanes
      </div>
      <button onClick={onNew} style={newMapBtn}>+ New Map</button>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, color: '#334155', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 7 }}>{children}</div>
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
      <span style={{ fontSize: 11, color: '#334155' }}>{label}</span>
      <span style={{ fontSize: 11, color: '#94a3b8' }}>{value}</span>
    </div>
  )
}

const newMapBtn: React.CSSProperties = {
  width: '100%', padding: '7px 0', borderRadius: 5,
  border: '1px solid #1e40af', background: '#1e3a8a',
  color: '#93c5fd', fontSize: 12, cursor: 'pointer', fontWeight: 500,
}
