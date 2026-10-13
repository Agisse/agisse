import type { ReactNode } from 'react'
import { Plus, X } from 'lucide-react'

/** Page header whose form folds away once there is a list to work through, so it never sits below a long list. */
export function Intake({ id, title, lede, action, open, compact, sub, onToggle, children }: { id: string; /** Sits under a page that has its own h1. */ sub?: boolean; title: string; lede: string; action: string; open: boolean; /** An item is open below: keep the header to one short line. */ compact?: boolean; onToggle: (open: boolean) => void; children: ReactNode }) {
  return (
    <section className={`intake${open ? ' is-open' : compact ? ' is-compact' : ''}`} aria-labelledby={`${id}-title`}>
      <header className="intake__head">
        <div>
          {sub ? (
            <h2 id={`${id}-title`} className="display intake__title">
              {title}
            </h2>
          ) : (
            <h1 id={`${id}-title`} className="display intake__title">
              {title}
            </h1>
          )}
          {open && <p className="intake__lede">{lede}</p>}
        </div>
        <button type="button" className={`btn ${open ? 'btn--quiet' : compact ? 'btn--sm' : ''}`} aria-expanded={open} aria-controls={`${id}-body`} onClick={() => onToggle(!open)}>
          {open ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />} {open ? 'Close' : action}
        </button>
      </header>
      <div id={`${id}-body`} className="intake__body" hidden={!open}>
        {children}
      </div>
    </section>
  )
}
