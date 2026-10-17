import type { ReactNode } from 'react'
import { Link, useLocation } from 'wouter'
import { ProgressPanel } from '../components/ProgressPanel'

const TABS = [
  ['/prepare', 'Tests'],
  ['/prepare/interviews', 'Interviews'],
  ['/prepare/cv', 'CV'],
] as const

/** Prepare: online tests, interviews and the CV in one place, with progress across all three folded under the tab's content.
 *  The Tests tab is the landing page and leads with the one practice to do next (TrainingHub). */
export function PrepareHub({ children }: { children: ReactNode }) {
  const [loc] = useLocation()
  const current = loc.startsWith('/prepare/interviews') ? '/prepare/interviews' : loc.startsWith('/prepare/cv') ? '/prepare/cv' : '/prepare'
  return (
    <>
      <div className="map prepare-hub intake">
        <h1 className="display intake__title">Prepare</h1>
        <nav className="posting-tabs" aria-label="Prepare">
          {TABS.map(([href, label]) => (
            <Link key={href} href={href} aria-current={current === href ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
      <div className="map prepare-hub">
        <details className="index-card__options">
          <summary>
            <span>Your progress</span>
            <span className="index-card__options-hint">Games, interview answers and CV</span>
          </summary>
          <div className="index-card__options-fields">
            <ProgressPanel />
          </div>
        </details>
      </div>
    </>
  )
}
