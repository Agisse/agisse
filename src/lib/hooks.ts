import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import { noteLimit } from '../../shared/types'

/** The signed-in seeker's connection-note limit, provided once in App so every badge counts against it. */
export const NoteLimit = createContext(noteLimit(null))

const CHANGED = 'agisse:changed'
/** Something changed outside the open page (e.g. the assistant applied an edit): every useResource reloads. */
export const notifyChanged = () => window.dispatchEvent(new Event(CHANGED))

export type Resource<T> = { data: T | null; error: string | null; loading: boolean; reload: () => Promise<void>; setData: (d: T | null | ((prev: T | null) => T | null)) => void }

/** Minimal fetch-once resource with manual reload; enough for this app's few screens. */
export function useResource<T>(fetcher: () => Promise<T>, deps: unknown[] = []): Resource<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const alive = useRef(true)
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await fetcher()
      if (alive.current) setData(d)
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      if (alive.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => {
    alive.current = true
    void load()
    const onChanged = () => void load()
    window.addEventListener(CHANGED, onChanged)
    return () => {
      alive.current = false
      window.removeEventListener(CHANGED, onChanged)
    }
  }, [load])
  return { data, error, loading, reload: load, setData }
}

/** Cancel button support: `start()` hands the next request its signal, `cancel()` aborts it; the caller's catch sees an AbortError (see `isAbort`). */
export function useAbortable() {
  const ref = useRef<AbortController | null>(null)
  const start = useCallback(() => {
    ref.current?.abort()
    ref.current = new AbortController()
    return ref.current.signal
  }, [])
  const cancel = useCallback(() => ref.current?.abort(), [])
  return { start, cancel }
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function useCopy() {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }, [])
  return { copied, copy }
}

/** Items at the same company, in first-seen order: several roles at one company read as one entry. */
export function groupByCompany<T extends { company: string }>(items: T[]) {
  const groups = new Map<string, T[]>()
  for (const x of items) {
    const k = x.company.trim().toLowerCase()
    groups.set(k, [...(groups.get(k) ?? []), x])
  }
  return [...groups.values()]
}

/** Company names compared loosely: case and spacing do not matter. */
export const companyNameKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ')

/** A view preference (List, Board, Map…) kept in this browser per user. Storage can be blocked, so reads fall back. */
export function remembered<T extends string>(key: string, allowed: readonly T[], fallback: T, value?: T): T {
  try {
    if (value) localStorage.setItem(`agisse.${key}`, value)
    const v = localStorage.getItem(`agisse.${key}`) as T | null
    return v && allowed.includes(v) ? v : fallback
  } catch {
    return value ?? fallback
  }
}

/** The map's search form, filled in with this company. */
export const boothHref = (p: { name: string; domain: string | null }) => `/contacts?${new URLSearchParams({ company: p.name, ...(p.domain ? { domain: p.domain } : {}) })}`
