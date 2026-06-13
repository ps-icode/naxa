import { useState } from 'react'
import { useGridStore } from '../../store/gridStore'
import { useUIStore } from '../../store/uiStore'
import { downloadCustomExport, FIELD_PRESETS } from '../../lib/exportData'
import type { ExportFieldNames, ExportOptions } from '../../lib/exportData'
import { PANE_THEMES } from '../../lib/themes'

type Preset = 'naxa' | 'ros2' | 'amr' | 'custom'

const PRESET_LABELS: Record<Preset, string> = {
  naxa:   'Naxa native',
  ros2:   'ROS 2 / Nav2',
  amr:    'AMR generic',
  custom: 'Custom',
}

export default function ExportModal() {
  const { map } = useGridStore()
  const { setShowExportModal, showToast, mapBg } = useUIStore()
  const pt = PANE_THEMES[mapBg]

  const [format, setFormat] = useState<'json' | 'yaml'>('json')
  const [coordOrigin, setCoordOrigin] = useState<0 | 1>(0)
  const [preset, setPreset] = useState<Preset>('naxa')
  const [customFields, setCustomFields] = useState<ExportFieldNames>({ ...FIELD_PRESETS.naxa })
  const [excludeBlocked, setExcludeBlocked] = useState(true)
  const [includeConfig, setIncludeConfig] = useState(true)
  const [includeLayers, setIncludeLayers] = useState(false)

  const activeFields: ExportFieldNames = preset === 'custom' ? customFields : FIELD_PRESETS[preset]

  const handlePreset = (p: Preset) => {
    setPreset(p)
    if (p !== 'custom') setCustomFields({ ...FIELD_PRESETS[p] })
  }

  const handleDownload = () => {
    if (!map) return
    const opts: ExportOptions = {
      format,
      coordOrigin,
      excludeDefaultBlocked: excludeBlocked,
      includeConfig,
      includeLayers,
      fieldNames: activeFields,
    }
    downloadCustomExport(map, opts)
    showToast(`Exported ${map.name} as ${format.toUpperCase()} ✓`)
    setShowExportModal(false)
  }

  const typedCount = map
    ? map.cells.filter(c => !(c.nodeType === 'blocked' && !c.subtype)).length
    : 0
  const blockedCount = map ? map.cells.length - typedCount : 0

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}
      onClick={e => { if (e.target === e.currentTarget) setShowExportModal(false) }}
    >
      <div style={{
        background: '#0f172a', borderRadius: 12, padding: 28, width: 440,
        border: '1px solid #1e293b', boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>Custom Export</div>
          <button
            onClick={() => setShowExportModal(false)}
            style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Format */}
        <Section label="Format">
          <ToggleGroup
            options={[{ value: 'json', label: 'JSON' }, { value: 'yaml', label: 'YAML' }]}
            value={format}
            onChange={v => setFormat(v as 'json' | 'yaml')}
          />
        </Section>

        {/* Coordinate origin */}
        <Section label="Coordinate origin">
          <ToggleGroup
            options={[{ value: '0', label: '0-indexed' }, { value: '1', label: '1-indexed' }]}
            value={String(coordOrigin)}
            onChange={v => setCoordOrigin(Number(v) as 0 | 1)}
          />
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 5 }}>
            Affects all row / col values in cell output.
          </div>
        </Section>

        {/* Field name presets */}
        <Section label="Field names">
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
            {(['naxa', 'ros2', 'amr', 'custom'] as Preset[]).map(p => (
              <button
                key={p}
                onClick={() => handlePreset(p)}
                style={{
                  padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
                  border: preset === p ? '1px solid #3b82f6' : '1px solid #1e293b',
                  background: preset === p ? '#1e3a8a' : '#0f172a',
                  color: preset === p ? '#93c5fd' : '#64748b',
                }}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Field name grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
            {([
              ['Cell type key', 'cellType'],
              ['Row key', 'row'],
              ['Col key', 'col'],
              ['Edge from key', 'edgeFrom'],
              ['Edge to key', 'edgeTo'],
            ] as [string, keyof ExportFieldNames][]).map(([label, field]) => (
              <div key={field}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>{label}</div>
                <input
                  value={activeFields[field]}
                  disabled={preset !== 'custom'}
                  onChange={e => setCustomFields(prev => ({ ...prev, [field]: e.target.value }))}
                  style={{
                    width: '100%', padding: '4px 8px', borderRadius: 4, fontSize: 11,
                    border: '1px solid #1e293b', background: preset === 'custom' ? '#0a0f1e' : '#080d18',
                    color: preset === 'custom' ? '#e2e8f0' : '#64748b',
                    outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace',
                  }}
                />
              </div>
            ))}
          </div>
        </Section>

        {/* Sections to include */}
        <Section label="Include">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <CheckRow
              checked={excludeBlocked}
              onChange={setExcludeBlocked}
              label="Exclude default-blocked cells"
              hint={`omits ${blockedCount} implicit floor cells`}
            />
            <CheckRow
              checked={includeConfig}
              onChange={setIncludeConfig}
              label="Include grid config"
              hint="rows, cols, shape, scale"
            />
            <CheckRow
              checked={includeLayers}
              onChange={setIncludeLayers}
              label="Include layer definitions"
              hint="visibility, color metadata"
            />
          </div>
        </Section>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowExportModal(false)}
            style={{
              padding: '8px 18px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
              border: '1px solid #1e293b', background: 'transparent', color: '#64748b',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={!map}
            style={{
              padding: '8px 20px', borderRadius: 6, fontSize: 13, cursor: map ? 'pointer' : 'default',
              border: '1px solid #1e40af', background: '#1e3a8a', color: '#93c5fd', fontWeight: 600,
            }}
          >
            Download {format.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function ToggleGroup({ options, value, onChange }: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            padding: '5px 14px', borderRadius: 5, fontSize: 12, cursor: 'pointer',
            border: value === o.value ? '1px solid #3b82f6' : '1px solid #1e293b',
            background: value === o.value ? '#1e3a8a' : '#0f172a',
            color: value === o.value ? '#93c5fd' : '#64748b',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function CheckRow({ checked, onChange, label, hint }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint: string
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ accentColor: '#3b82f6', width: 14, height: 14 }}
      />
      <span style={{ fontSize: 12, color: '#cbd5e1' }}>{label}</span>
      <span style={{ fontSize: 10, color: '#475569' }}>({hint})</span>
    </label>
  )
}
