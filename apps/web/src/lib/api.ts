import type { GridMap } from '@naxa/core'

const BASE = '/api'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

const LOCAL_KEY = 'naxa_maps'

function localGet(): GridMap[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]') } catch { return [] }
}
function localSave(maps: GridMap[]): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(maps))
}
function localUpsert(map: GridMap): void {
  const maps = localGet()
  const idx = maps.findIndex(m => m.id === map.id)
  if (idx >= 0) maps[idx] = map; else maps.push(map)
  localSave(maps)
}
function localDelete(id: string): void {
  localSave(localGet().filter(m => m.id !== id))
}

export const api = {
  maps: {
    list: async (): Promise<GridMap[]> => {
      try { return await req<GridMap[]>('/maps') } catch { return localGet() }
    },

    /** Fetch one page of maps.  Pass `nextCursor` from a previous response to advance pages. */
    listPage: async (limit = 50, cursor?: string): Promise<{ items: GridMap[]; nextCursor: string | null }> => {
      const params = new URLSearchParams({ limit: String(limit) })
      if (cursor) params.set('cursor', cursor)
      try {
        const res = await fetch(`${BASE}/maps?${params}`, { headers: { 'Content-Type': 'application/json' } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const items = await res.json() as GridMap[]
        return { items, nextCursor: res.headers.get('X-Next-Cursor') }
      } catch {
        return { items: localGet().slice(0, limit), nextCursor: null }
      }
    },
    get: async (id: string): Promise<GridMap> => {
      try { return await req<GridMap>(`/maps/${id}`) } catch {
        const m = localGet().find(m => m.id === id)
        if (!m) throw new Error('Not found')
        return m
      }
    },
    create: async (map: GridMap): Promise<GridMap> => {
      try {
        const saved = await req<GridMap>('/maps', { method: 'POST', body: JSON.stringify(map) })
        localUpsert(saved)
        return saved
      } catch {
        localUpsert(map)
        return map
      }
    },
    update: async (id: string, map: Partial<GridMap>): Promise<GridMap> => {
      try {
        const updated = await req<GridMap>(`/maps/${id}`, { method: 'PATCH', body: JSON.stringify(map) })
        localUpsert(updated)
        return updated
      } catch {
        const maps = localGet()
        const existing = maps.find(m => m.id === id)
        const merged = { ...existing, ...map } as GridMap
        localUpsert(merged)
        return merged
      }
    },
    delete: async (id: string): Promise<void> => {
      try { await req<void>(`/maps/${id}`, { method: 'DELETE' }) } catch { /* noop */ }
      localDelete(id)
    },
  },
}
