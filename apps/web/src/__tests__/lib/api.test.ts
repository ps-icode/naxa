import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { GridMap } from '@naxa/core'
import { api } from '../../lib/api'

const SAMPLE_MAP: GridMap = {
  id: 'map-1',
  name: 'Test Map',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  config: { rows: 3, cols: 3, cellShape: 'square', cellSizeMeters: 1 },
  cells: [],
  edges: [],
  layers: [],
}

function stubFetchOk(data: unknown, status = 200): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  }))
}

function stubFetchFail(): void {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
}

function stubFetchNotOk(status: number): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ detail: 'Not found' }),
  }))
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── api.maps.list ─────────────────────────────────────────────────────────────

describe('api.maps.list', () => {
  it('returns server data on success', async () => {
    stubFetchOk([SAMPLE_MAP])
    expect(await api.maps.list()).toEqual([SAMPLE_MAP])
  })

  it('falls back to localStorage when fetch fails', async () => {
    localStorage.setItem('naxa_maps', JSON.stringify([SAMPLE_MAP]))
    stubFetchFail()
    expect(await api.maps.list()).toEqual([SAMPLE_MAP])
  })

  it('returns empty array when fetch fails and localStorage is empty', async () => {
    stubFetchFail()
    expect(await api.maps.list()).toEqual([])
  })

  it('returns empty array when localStorage contains invalid JSON', async () => {
    localStorage.setItem('naxa_maps', 'not-valid-json')
    stubFetchFail()
    expect(await api.maps.list()).toEqual([])
  })
})

// ── api.maps.get ──────────────────────────────────────────────────────────────

describe('api.maps.get', () => {
  it('returns map on success', async () => {
    stubFetchOk(SAMPLE_MAP)
    expect(await api.maps.get('map-1')).toEqual(SAMPLE_MAP)
  })

  it('throws when not found (404 + not in localStorage)', async () => {
    stubFetchNotOk(404)
    await expect(api.maps.get('missing')).rejects.toThrow('Not found')
  })

  it('falls back to localStorage when fetch fails', async () => {
    localStorage.setItem('naxa_maps', JSON.stringify([SAMPLE_MAP]))
    stubFetchFail()
    expect(await api.maps.get('map-1')).toEqual(SAMPLE_MAP)
  })
})

// ── api.maps.create ───────────────────────────────────────────────────────────

describe('api.maps.create', () => {
  it('returns server response and upserts to localStorage on success', async () => {
    stubFetchOk(SAMPLE_MAP, 201)
    const result = await api.maps.create(SAMPLE_MAP)
    expect(result).toEqual(SAMPLE_MAP)
    const stored: GridMap[] = JSON.parse(localStorage.getItem('naxa_maps') ?? '[]')
    expect(stored).toContainEqual(SAMPLE_MAP)
  })

  it('falls back to localStorage upsert on network failure', async () => {
    stubFetchFail()
    const result = await api.maps.create(SAMPLE_MAP)
    expect(result).toEqual(SAMPLE_MAP)
    const stored: GridMap[] = JSON.parse(localStorage.getItem('naxa_maps') ?? '[]')
    expect(stored).toContainEqual(SAMPLE_MAP)
  })
})

// ── api.maps.update ───────────────────────────────────────────────────────────

describe('api.maps.update', () => {
  it('returns updated map and upserts to localStorage on success', async () => {
    const updated = { ...SAMPLE_MAP, name: 'Updated' }
    stubFetchOk(updated)
    const result = await api.maps.update('map-1', { name: 'Updated' })
    expect(result.name).toBe('Updated')
    const stored: GridMap[] = JSON.parse(localStorage.getItem('naxa_maps') ?? '[]')
    expect(stored.find(m => m.id === 'map-1')?.name).toBe('Updated')
  })

  it('merges with localStorage entry on network failure', async () => {
    localStorage.setItem('naxa_maps', JSON.stringify([SAMPLE_MAP]))
    stubFetchFail()
    const result = await api.maps.update('map-1', { name: 'Offline' })
    expect(result.name).toBe('Offline')
    expect(result.id).toBe('map-1')
  })
})

// ── api.maps.delete ───────────────────────────────────────────────────────────

describe('api.maps.delete', () => {
  it('removes map from localStorage on success', async () => {
    localStorage.setItem('naxa_maps', JSON.stringify([SAMPLE_MAP]))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204, json: () => Promise.resolve(undefined) }))
    await api.maps.delete('map-1')
    const stored: GridMap[] = JSON.parse(localStorage.getItem('naxa_maps') ?? '[]')
    expect(stored).toHaveLength(0)
  })

  it('still removes from localStorage even when fetch fails', async () => {
    localStorage.setItem('naxa_maps', JSON.stringify([SAMPLE_MAP]))
    stubFetchFail()
    await api.maps.delete('map-1')
    const stored: GridMap[] = JSON.parse(localStorage.getItem('naxa_maps') ?? '[]')
    expect(stored).toHaveLength(0)
  })
})
