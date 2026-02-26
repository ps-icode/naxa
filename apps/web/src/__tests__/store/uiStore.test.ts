import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useUIStore } from '../../store/uiStore'
import type { TraceRoute } from '../../store/uiStore'

function freshStore(): void {
  useUIStore.setState({
    tool: 'draw',
    activeNodeType: 'lane',
    selectedEdgeId: null,
    selectedCellId: null,
    pathStart: null,
    pathEnd: null,
    pathResult: null,
    zoom: 1,
    pan: { x: 40, y: 40 },
    showNewMapModal: false,
    validationResult: null,
    toast: null,
    traceRoutes: [],
    traceRunning: false,
    traceSpeed: 3,
    showCellCoords: false,
  })
}

beforeEach(freshStore)

// ── setTool ───────────────────────────────────────────────────────────────────

describe('setTool', () => {
  it('changes the active tool', () => {
    useUIStore.getState().setTool('erase')
    expect(useUIStore.getState().tool).toBe('erase')
  })

  it('clears selectedEdgeId, pathStart, pathEnd, pathResult, traceRunning on switch', () => {
    useUIStore.setState({
      selectedEdgeId: 'e1',
      pathStart: 'c1',
      pathEnd: 'c2',
      pathResult: ['c1', 'c2'],
      traceRunning: true,
    })
    useUIStore.getState().setTool('type')
    const s = useUIStore.getState()
    expect(s.selectedEdgeId).toBeNull()
    expect(s.pathStart).toBeNull()
    expect(s.pathEnd).toBeNull()
    expect(s.pathResult).toBeNull()
    expect(s.traceRunning).toBe(false)
  })
})

// ── setPathPoint ──────────────────────────────────────────────────────────────

describe('setPathPoint', () => {
  it('first call sets pathStart, leaves pathEnd null', () => {
    useUIStore.getState().setPathPoint('c1')
    expect(useUIStore.getState().pathStart).toBe('c1')
    expect(useUIStore.getState().pathEnd).toBeNull()
  })

  it('second call with different cell sets pathEnd', () => {
    useUIStore.getState().setPathPoint('c1')
    useUIStore.getState().setPathPoint('c2')
    expect(useUIStore.getState().pathStart).toBe('c1')
    expect(useUIStore.getState().pathEnd).toBe('c2')
  })

  it('clicking pathStart again clears both start and end (toggle)', () => {
    useUIStore.getState().setPathPoint('c1')
    useUIStore.getState().setPathPoint('c1')
    expect(useUIStore.getState().pathStart).toBeNull()
    expect(useUIStore.getState().pathEnd).toBeNull()
  })
})

// ── clearPath ─────────────────────────────────────────────────────────────────

describe('clearPath', () => {
  it('sets pathStart, pathEnd, pathResult all to null', () => {
    useUIStore.setState({ pathStart: 'c1', pathEnd: 'c2', pathResult: ['c1', 'c2'] })
    useUIStore.getState().clearPath()
    const s = useUIStore.getState()
    expect(s.pathStart).toBeNull()
    expect(s.pathEnd).toBeNull()
    expect(s.pathResult).toBeNull()
  })
})

// ── selectEdge ────────────────────────────────────────────────────────────────

describe('selectEdge', () => {
  it('sets selectedEdgeId', () => {
    useUIStore.getState().selectEdge('e1')
    expect(useUIStore.getState().selectedEdgeId).toBe('e1')
  })

  it('clears selectedEdgeId when passed null', () => {
    useUIStore.getState().selectEdge('e1')
    useUIStore.getState().selectEdge(null)
    expect(useUIStore.getState().selectedEdgeId).toBeNull()
  })
})

// ── setSelectedCellId ─────────────────────────────────────────────────────────

describe('setSelectedCellId', () => {
  it('sets selectedCellId', () => {
    useUIStore.getState().setSelectedCellId('c1')
    expect(useUIStore.getState().selectedCellId).toBe('c1')
  })

  it('clears selectedCellId when passed null', () => {
    useUIStore.getState().setSelectedCellId('c1')
    useUIStore.getState().setSelectedCellId(null)
    expect(useUIStore.getState().selectedCellId).toBeNull()
  })
})

// ── setActiveNodeType ─────────────────────────────────────────────────────────

describe('setActiveNodeType', () => {
  it('sets the active node type', () => {
    useUIStore.getState().setActiveNodeType('source')
    expect(useUIStore.getState().activeNodeType).toBe('source')
  })
})

// ── setShowNewMapModal / setValidationResult / setPathResult ──────────────────

describe('setShowNewMapModal', () => {
  it('sets showNewMapModal', () => {
    useUIStore.getState().setShowNewMapModal(true)
    expect(useUIStore.getState().showNewMapModal).toBe(true)
    useUIStore.getState().setShowNewMapModal(false)
    expect(useUIStore.getState().showNewMapModal).toBe(false)
  })
})

describe('setValidationResult', () => {
  it('sets validationResult', () => {
    useUIStore.getState().setValidationResult({ unreachable: ['c1'] })
    expect(useUIStore.getState().validationResult).toEqual({ unreachable: ['c1'] })
  })

  it('clears validationResult when set to null', () => {
    useUIStore.getState().setValidationResult({ unreachable: ['c1'] })
    useUIStore.getState().setValidationResult(null)
    expect(useUIStore.getState().validationResult).toBeNull()
  })
})

describe('setPathResult', () => {
  it('sets pathResult', () => {
    useUIStore.getState().setPathResult(['a', 'b', 'c'])
    expect(useUIStore.getState().pathResult).toEqual(['a', 'b', 'c'])
  })
})

// ── setTraceRoutes / setTraceRunning / setTraceSpeed ──────────────────────────

describe('trace state setters', () => {
  it('setTraceRoutes stores routes', () => {
    const routes: TraceRoute[] = [{ pathIds: ['a', 'b'], color: '#f00', label: 'A→B' }]
    useUIStore.getState().setTraceRoutes(routes)
    expect(useUIStore.getState().traceRoutes).toEqual(routes)
  })

  it('setTraceRunning sets the flag', () => {
    useUIStore.getState().setTraceRunning(true)
    expect(useUIStore.getState().traceRunning).toBe(true)
  })

  it('setTraceSpeed sets the value', () => {
    useUIStore.getState().setTraceSpeed(7)
    expect(useUIStore.getState().traceSpeed).toBe(7)
  })
})

// ── setZoom / setPan ──────────────────────────────────────────────────────────

describe('setZoom / setPan', () => {
  it('setZoom sets zoom', () => {
    useUIStore.getState().setZoom(2.5)
    expect(useUIStore.getState().zoom).toBe(2.5)
  })

  it('setPan sets pan', () => {
    useUIStore.getState().setPan({ x: 100, y: 200 })
    expect(useUIStore.getState().pan).toEqual({ x: 100, y: 200 })
  })
})

// ── showToast / clearToast ────────────────────────────────────────────────────

describe('showToast', () => {
  it('sets toast message and type immediately', () => {
    vi.useFakeTimers()
    useUIStore.getState().showToast('Hello', 'success')
    expect(useUIStore.getState().toast).toEqual({ message: 'Hello', type: 'success' })
    vi.useRealTimers()
  })

  it('defaults toast type to success', () => {
    vi.useFakeTimers()
    useUIStore.getState().showToast('Test')
    expect(useUIStore.getState().toast?.type).toBe('success')
    vi.useRealTimers()
  })

  it('auto-dismisses toast after timeout fires', () => {
    vi.useFakeTimers()
    useUIStore.getState().showToast('Bye', 'error')
    expect(useUIStore.getState().toast).not.toBeNull()
    vi.advanceTimersByTime(3500)
    expect(useUIStore.getState().toast).toBeNull()
    vi.useRealTimers()
  })
})

describe('clearToast', () => {
  it('sets toast to null', () => {
    useUIStore.setState({ toast: { message: 'Test', type: 'success' } })
    useUIStore.getState().clearToast()
    expect(useUIStore.getState().toast).toBeNull()
  })
})

// ── toggleCellCoords ──────────────────────────────────────────────────────────

describe('toggleCellCoords', () => {
  it('toggleCellCoords: false → true', () => {
    useUIStore.getState().toggleCellCoords()
    expect(useUIStore.getState().showCellCoords).toBe(true)
  })

  it('toggleCellCoords: true → false', () => {
    useUIStore.setState({ showCellCoords: true })
    useUIStore.getState().toggleCellCoords()
    expect(useUIStore.getState().showCellCoords).toBe(false)
  })
})
