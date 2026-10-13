import { useSyncExternalStore } from 'react'

export type Theme = 'system' | 'light' | 'dark'
const KEY = 'agisse.theme'

function read(): Theme {
  try {
    const t = localStorage.getItem(KEY)
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

/** Saves the choice; the script in index.html applies `.dark` on this event and on system changes. */
export function setTheme(t: Theme) {
  try {
    if (t === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, t)
  } catch {
    /* private window: the class still flips for this visit */
    document.documentElement.classList.toggle('dark', t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches))
  }
  dispatchEvent(new Event('agisse:theme'))
}

export function useTheme() {
  return useSyncExternalStore(
    (cb) => {
      addEventListener('agisse:theme', cb)
      return () => removeEventListener('agisse:theme', cb)
    },
    read,
  )
}

/** Whether `.dark` is on <html> now; for colours that cannot be CSS variables (canvas). */
export function useDark() {
  return useSyncExternalStore(
    (cb) => {
      const mo = new MutationObserver(cb)
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
      return () => mo.disconnect()
    },
    () => document.documentElement.classList.contains('dark'),
  )
}
