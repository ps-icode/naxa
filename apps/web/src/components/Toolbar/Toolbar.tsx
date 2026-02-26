import { useGridStore } from '../../store/gridStore'
import { useUIStore } from '../../store/uiStore'
import { validateConnectivity, buildTraceRoutes } from '../../lib/graph'
import { exportJSON, exportPNG } from '../../lib/export'
import { api } from '../../lib/api'
import type { GridMap } from '@naxa/core'
import type { Tool } from '../../store/uiStore'

const TOOLS: { id: Tool; label: string; key: string; tip: string }[] = [
  { id: 'draw', label: 'Draw', key: 'D', tip: 'Drag across adjacent cells to paint lanes. Click lane to toggle bidirectional.' },
  { id: 'type', label: 'Type', key: 'T', tip: 'Click or drag to paint cell types. Select type in layer panel.' },
  { id: 'erase', label: 'Erase', key: 'E', tip: 'Click cell to reset type. Click lane to delete it.' },
  { id: 'path', label: 'Path', key: 'P', tip: 'Click two cells to preview shortest path.' },
]

export default function Toolbar() {
  const { map, past, future, undo, redo, setSavedList, loadMap } = useGridStore()
  const {
    tool, setTool, showToast,
    setValidationResult, clearPath,
    traceRunning, traceSpeed, traceRoutes,
    setTraceRoutes, setTraceRunning, setTraceSpeed,
  } = useUIStore()

  const canUndo = past.length > 0
  const canRedo = future.length > 0

  const handleSave = async () => {
    if (!map) return
    try {
      let saved: GridMap
      const existing = await api.maps.get(map.id).catch(() => null)
      if (existing) {
        saved = await api.maps.update(map.id, map)
      } else {
        saved = await api.maps.create(map)
        loadMap(saved)
      }
      const list = await api.maps.list()
      setSavedList(list.map(m => ({ id: m.id, name: m.name, updatedAt: m.updatedAt })))
      showToast('Map saved ✓')
    } catch {
      showToast('Save failed', 'error')
    }
  }

  const handleValidate = () => {
    if (!map) return
    const result = validateConnectivity(map)
    setValidationResult(result)
    if (result.unreachable.length === 0) {
      showToast('All destinations reachable ✓')
    } else {
      showToast(`${result.unreachable.length} unreachable destination(s) — highlighted in red`, 'error')
    }
  }

  const handleTrace = () => {
    if (!map) return
    if (traceRunning) {
      setTraceRunning(false)
      return
    }
    const routes = buildTraceRoutes(map)
    if (routes.length === 0) {
      showToast('No valid source→destination paths found', 'error')
      return
    }
    setTraceRoutes(routes)
    setTraceRunning(true)
    showToast(`Tracing ${routes.length} route(s)…`)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '8px 14px', background: '#060614',
      borderBottom: '1px solid #1e293b', flexShrink: 0, overflowX: 'auto',
    }}>
      {/* Tools */}
      <div style={{ display: 'flex', gap: 3 }}>
        {TOOLS.map(t => (
          <button
            key={t.id}
            title={t.tip}
            onClick={() => { setTool(t.id); clearPath(); setTraceRunning(false) }}
            style={toolBtn(tool === t.id)}
          >
            <span style={{ fontSize: 9, opacity: 0.45, marginRight: 3 }}>{t.key}</span>
            {t.label}
          </button>
        ))}
      </div>

      <Sep />

      {/* History */}
      <button title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo} style={iconBtn(!canUndo)}>↩</button>
      <button title="Redo (Ctrl+Y)" onClick={redo} disabled={!canRedo} style={iconBtn(!canRedo)}>↪</button>

      <Sep />

      {/* Path info */}
      {tool === 'path' && (
        <PathInfo />
      )}

      {/* Trace */}
      <button
        onClick={handleTrace}
        disabled={!map}
        title="Animate robots tracing all source→destination paths"
        style={{
          ...actionBtn(traceRunning ? '#7c3aed' : '#1e293b'),
          border: traceRunning ? '1px solid #a78bfa' : '1px solid #1e293b',
        }}
      >
        {traceRunning ? '⏹ Stop' : '▶ Trace'}
      </button>

      {/* Speed slider */}
      {(traceRunning || traceRoutes.length > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>Speed</span>
          <input
            type="range" min={1} max={10} step={0.5} value={traceSpeed}
            onChange={e => setTraceSpeed(Number(e.target.value))}
            style={{ width: 80, accentColor: '#a78bfa', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 11, color: '#64748b', minWidth: 28 }}>{traceSpeed}x</span>
        </div>
      )}

      {traceRunning && traceRoutes.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 200 }}>
          {traceRoutes.map((r, i) => (
            <span key={i} style={{ fontSize: 10, padding: '2px 5px', borderRadius: 3, background: r.color + '33', color: r.color, border: `1px solid ${r.color}66` }}>
              {r.label}
            </span>
          ))}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {map && (
        <span style={{ fontSize: 11, color: '#334155', marginRight: 4 }}>
          {map.name} · {map.config.rows}×{map.config.cols}
        </span>
      )}

      <Sep />

      <button onClick={handleValidate} disabled={!map} style={actionBtn('#1e293b')} title="Validate graph connectivity">Validate</button>
      <button onClick={() => map && exportJSON(map)} disabled={!map} style={actionBtn('#1e293b')} title="Export as JSON graph">JSON</button>
      <button onClick={() => map && exportPNG(map)} disabled={!map} style={actionBtn('#1e293b')} title="Export as PNG image">PNG</button>
      <button onClick={handleSave} disabled={!map} style={actionBtn('#1e40af')}>Save</button>
    </div>
  )
}

function PathInfo() {
  const pathStart = useUIStore(s => s.pathStart)
  const pathEnd = useUIStore(s => s.pathEnd)
  const pathResult = useUIStore(s => s.pathResult)
  const { clearPath } = useUIStore.getState()

  return (
    <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
      {!pathStart ? 'Click start cell'
        : !pathEnd ? 'Click end cell'
        : pathResult
          ? <span style={{ color: '#10b981' }}>↗ {pathResult.length} cells</span>
          : <span style={{ color: '#ef4444' }}>No path</span>
      }
      {pathStart && (
        <button onClick={clearPath} style={{ fontSize: 11, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer' }}>
          ✕ Clear
        </button>
      )}
    </div>
  )
}

function toolBtn(active: boolean): React.CSSProperties {
  return {
    padding: '5px 11px', borderRadius: 5, fontSize: 12, cursor: 'pointer',
    border: active ? '1px solid #3b82f6' : '1px solid #1e293b',
    background: active ? '#1e3a8a' : '#0a0f1e',
    color: active ? '#93c5fd' : '#64748b',
    transition: 'all 0.1s', whiteSpace: 'nowrap',
  }
}

function iconBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '5px 10px', borderRadius: 5, fontSize: 13, cursor: disabled ? 'default' : 'pointer',
    border: '1px solid #1e293b', background: '#0a0f1e',
    color: disabled ? '#1e293b' : '#64748b',
  }
}

function actionBtn(bg: string): React.CSSProperties {
  return {
    padding: '5px 12px', borderRadius: 5, fontSize: 12, cursor: 'pointer',
    border: '1px solid #1e293b', background: bg, color: '#e2e8f0', whiteSpace: 'nowrap',
  }
}

function Sep() {
  return <div style={{ width: 1, height: 18, background: '#1e293b', flexShrink: 0 }} />
}
