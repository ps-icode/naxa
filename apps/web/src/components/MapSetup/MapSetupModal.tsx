import { useState } from 'react'
import { useGridStore } from '../../store/gridStore'
import { useUIStore } from '../../store/uiStore'
import type { CellShape } from '@naxa/core'

export default function MapSetupModal() {
  const { newMap } = useGridStore()
  const { setShowNewMapModal, setTool } = useUIStore()

  const [name, setName] = useState('New Map')
  const [shape, setShape] = useState<CellShape>('square')
  const [rows, setRows] = useState(15)
  const [cols, setCols] = useState(20)
  const [scale, setScale] = useState(0.5)

  const create = () => {
    newMap(name.trim() || 'Map', { rows, cols, cellShape: shape, cellSizeMeters: scale })
    setTool('draw')
    setShowNewMapModal(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        background: '#0f172a', borderRadius: 12, padding: 32, width: 420,
        border: '1px solid #1e293b', boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#e2e8f0' }}>New Map</h2>
        <p style={{ fontSize: 13, color: '#475569', marginBottom: 24 }}>
          Configure your grid before drawing lanes
        </p>

        <Field label="Map name">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            style={inputStyle}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && create()}
          />
        </Field>

        <Field label="Cell shape">
          <div style={{ display: 'flex', gap: 8 }}>
            {(['square', 'rectangle', 'hexagon'] as CellShape[]).map(s => (
              <button
                key={s}
                onClick={() => setShape(s)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                  border: shape === s ? '1px solid #3b82f6' : '1px solid #1e293b',
                  background: shape === s ? '#1e3a8a' : '#0f172a',
                  color: shape === s ? '#93c5fd' : '#64748b',
                  textTransform: 'capitalize',
                }}
              >
                {s === 'square' ? '⬜' : s === 'rectangle' ? '▭' : '⬡'} {s}
              </button>
            ))}
          </div>
        </Field>

        <div style={{ display: 'flex', gap: 12 }}>
          <Field label="Rows">
            <input
              type="number" min={3} max={50} value={rows}
              onChange={e => setRows(Math.min(50, Math.max(3, +e.target.value)))}
              style={{ ...inputStyle, width: '100%' }}
            />
          </Field>
          <Field label="Columns">
            <input
              type="number" min={3} max={80} value={cols}
              onChange={e => setCols(Math.min(80, Math.max(3, +e.target.value)))}
              style={{ ...inputStyle, width: '100%' }}
            />
          </Field>
          <Field label="m / cell">
            <input
              type="number" min={0.1} max={10} step={0.1} value={scale}
              onChange={e => setScale(+e.target.value)}
              style={{ ...inputStyle, width: '100%' }}
            />
          </Field>
        </div>

        <div style={{ background: '#0a0f1e', borderRadius: 6, padding: '10px 12px', marginBottom: 20, fontSize: 12, color: '#475569' }}>
          Grid: <strong style={{ color: '#94a3b8' }}>{rows * cols}</strong> cells ·{' '}
          Real size: <strong style={{ color: '#94a3b8' }}>{(rows * scale).toFixed(1)}m × {(cols * scale).toFixed(1)}m</strong>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => setShowNewMapModal(false)} style={cancelBtn}>Cancel</button>
          <button onClick={create} style={createBtn}>Create Map</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 14,
  border: '1px solid #1e293b', background: '#0a0f1e', color: '#e2e8f0',
  outline: 'none',
}

const cancelBtn: React.CSSProperties = {
  padding: '8px 20px', borderRadius: 6, fontSize: 14, cursor: 'pointer',
  border: '1px solid #1e293b', background: 'transparent', color: '#64748b',
}

const createBtn: React.CSSProperties = {
  padding: '8px 24px', borderRadius: 6, fontSize: 14, cursor: 'pointer',
  border: '1px solid #3b82f6', background: '#1e40af', color: '#e2e8f0', fontWeight: 600,
}
