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

// ── api.maps.listPage ─────────────────────────────────────────────────────────

describe('api.maps.listPage', () => {
  it('returns items and nextCursor from X-Next-Cursor header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([SAMPLE_MAP]),
      headers: { get: (h: string) => h === 'X-Next-Cursor' ? 'abc123' : null },
    }))
    const result = await api.maps.listPage(1)
    expect(result.items).toEqual([SAMPLE_MAP])
    expect(result.nextCursor).toBe('abc123')
  })

  it('returns nextCursor null when header is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([SAMPLE_MAP]),
      headers: { get: () => null },
    }))
    const result = await api.maps.listPage(50)
    expect(result.nextCursor).toBeNull()
  })

  it('falls back to localStorage slice on network failure', async () => {
    localStorage.setItem('naxa_maps', JSON.stringify([SAMPLE_MAP]))
    stubFetchFail()
    const result = await api.maps.listPage(50)
    expect(result.items).toEqual([SAMPLE_MAP])
    expect(result.nextCursor).toBeNull()
  })

  it('respects limit when falling back to localStorage', async () => {
    const maps = [SAMPLE_MAP, { ...SAMPLE_MAP, id: 'map-2' }]
    localStorage.setItem('naxa_maps', JSON.stringify(maps))
    stubFetchFail()
    const result = await api.maps.listPage(1)
    expect(result.items).toHaveLength(1)
  })

  it('includes cursor param in request URL when cursor is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve([SAMPLE_MAP]),
      headers: { get: () => null },
    })
    vi.stubGlobal('fetch', fetchMock)
    await api.maps.listPage(50, 'tok123')
    const url: string = fetchMock.mock.calls[0][0]
    expect(url).toContain('cursor=tok123')
  })

  it('falls back to localStorage when response is not ok', async () => {
    localStorage.setItem('naxa_maps', JSON.stringify([SAMPLE_MAP]))
    stubFetchNotOk(500)
    const result = await api.maps.listPage(50)
    expect(result.items).toEqual([SAMPLE_MAP])
    expect(result.nextCursor).toBeNull()
  })

  it('uses default limit of 50 when called with no arguments', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve([SAMPLE_MAP]),
      headers: { get: () => null },
    }))
    const result = await api.maps.listPage()
    expect(result.items).toEqual([SAMPLE_MAP])
    expect(result.nextCursor).toBeNull()
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
