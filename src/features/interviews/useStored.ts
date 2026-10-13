import { useEffect, useState } from 'react'

/** State kept in this browser's localStorage; falls back to memory when storage is blocked. */
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`agisse:${key}`)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  const set = (next: T) => {
    setValue(next)
    try {
      localStorage.setItem(`agisse:${key}`, JSON.stringify(next))
    } catch {
      // Private window or blocked storage: keep it for this visit only.
    }
  }
  return [value, set] as const
}

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, '0')}`

/** Whole seconds since `since` (a Date.now() value), ticking; 0 while null. */
export function useElapsed(since: number | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (since === null) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [since])
  return since === null ? 0 : Math.max(0, Math.floor((now - since) / 1000))
}

/** One open section at a time, mirrored in the URL hash so it can be linked to and survives a reload. */
export function useHashSection<T extends string>(ids: readonly T[]) {
  const read = () => {
    const h = window.location.hash.slice(1)
    return (ids as readonly string[]).includes(h) ? (h as T) : null
  }
  const [open, setOpen] = useState<T | null>(read)
  useEffect(() => {
    const onHash = () => setOpen(read())
    window.addEventListener('hashchange', onHash)
    // Deep links (#case, #lbo…) scroll to their section once it renders.
    if (window.location.hash) requestAnimationFrame(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: 'start' }))
    return () => window.removeEventListener('hashchange', onHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const toggle = (s: T) => {
    const next = open === s ? null : s
    setOpen(next)
    history.replaceState(null, '', next ? `#${next}` : window.location.pathname + window.location.search)
  }
  return [open, toggle] as const
}
