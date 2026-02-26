import { useEffect, useRef, useState, useCallback } from 'react'
import type Konva from 'konva'
import GridCanvas from './components/Canvas/GridCanvas'
import LayerPanel from './components/LayerPanel/LayerPanel'
import Toolbar from './components/Toolbar/Toolbar'
import MapSetupModal from './components/MapSetup/MapSetupModal'
import { useUIStore } from './store/uiStore'
import { useGridStore } from './store/gridStore'
import { api } from './lib/api'

const SIDEBAR = 220

export default function App() {
  const stageRef = useRef<Konva.Stage>(null)
  const [size, setSize] = useState({ w: window.innerWidth - SIDEBAR, h: window.innerHeight - 44 })
  const { showNewMapModal, toast } = useUIStore()
  const { map, setSavedList, undo, redo } = useGridStore()

  // Window resize
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth - SIDEBAR, h: window.innerHeight - 44 })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Load saved maps list on mount
  useEffect(() => {
    api.maps.list().then(maps =>
      setSavedList(maps.map(m => ({ id: m.id, name: m.name, updatedAt: m.updatedAt })))
    ).catch(() => {})
  }, [setSavedList])

  // Keyboard shortcuts
  const handleKey = useCallback((e: KeyboardEvent) => {
    const { setTool, clearPath } = useUIStore.getState()
    // Tool shortcuts
    if (!e.ctrlKey && !e.metaKey) {
      if (e.key === 'd' || e.key === 'D') { setTool('draw'); clearPath() }
      if (e.key === 't' || e.key === 'T') setTool('type')
      if (e.key === 'e' || e.key === 'E') { setTool('erase'); clearPath() }
      if (e.key === 'p' || e.key === 'P') setTool('path')
    }
    // Undo/redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
  }, [undo, redo])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#080818', overflow: 'hidden' }}>
      {/* Toolbar */}
      <Toolbar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside style={{
          width: SIDEBAR, flexShrink: 0, background: '#080c18',
          borderRight: '1px solid #1e293b', padding: '16px 14px',
          overflowY: 'auto', display: 'flex', flexDirection: 'column',
        }}>
          {/* Logo */}
          <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #1e293b' }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px', color: '#60a5fa' }}>
              naxa
            </div>
            <div style={{ fontSize: 10, color: '#334155', letterSpacing: 1, textTransform: 'uppercase' }}>
              grid map editor
            </div>
          </div>

          <LayerPanel />

          {/* Keyboard shortcuts hint */}
          <div style={{ marginTop: 'auto', paddingTop: 12, fontSize: 10, color: '#1e293b', lineHeight: 1.8 }}>
            D Draw · T Type · E Erase · P Path<br />
            Ctrl+Z Undo · Scroll Zoom · MMB Pan
          </div>
        </aside>

        {/* Canvas */}
        <main style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#080818' }}>
          {map ? (
            <GridCanvas width={size.w} height={size.h} stageRef={stageRef} />
          ) : (
            <EmptyCanvas onNew={() => useUIStore.getState().setShowNewMapModal(true)} />
          )}
        </main>
      </div>

      {/* Modals */}
      {showNewMapModal && <MapSetupModal />}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 999,
          padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: toast.type === 'error' ? '#7f1d1d' : '#064e3b',
          border: `1px solid ${toast.type === 'error' ? '#ef4444' : '#10b981'}`,
          color: '#e2e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

function EmptyCanvas({ onNew }: { onNew: () => void }) {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20, color: '#1e293b',
    }}>
      {/* Grid preview decoration */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,32px)', gap: 4, opacity: 0.3 }}>
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} style={{
            width: 32, height: 32, borderRadius: 4,
            background: ['#1e3a8a','#064e3b','#4a1d96','#1e293b'][i % 4],
          }} />
        ))}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
          No map loaded
        </div>
        <div style={{ fontSize: 14, color: '#1e293b', marginBottom: 24 }}>
          Create a grid to start drawing navigation lanes
        </div>
        <button
          onClick={onNew}
          style={{
            padding: '10px 28px', borderRadius: 8, fontSize: 15, cursor: 'pointer',
            border: '1px solid #3b82f6', background: '#1e40af',
            color: '#e2e8f0', fontWeight: 600,
          }}
        >
          + Create New Map
        </button>
      </div>
    </div>
  )
}
