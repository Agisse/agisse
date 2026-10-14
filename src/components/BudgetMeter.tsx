import type { Budget } from '../../shared/types'

const eur = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' })

/** A daily pause (shared.ts `pauseFor`) fills the meter but isn't the monthly allowance, so it says so instead. */
const PAUSED = { cap: 'AI paused for today', free: 'Free AI used up for today', you: 'Free limit reached for today' } as const

/** Monthly spend against the allowance the admin set, or until when a daily limit pauses it. */
export function BudgetMeter({ budget, label = 'Budget this month' }: { budget: Budget; label?: string }) {
  const spent = budget.used >= budget.limit
  const back = new Date()
  back.setUTCHours(24, 0, 0, 0)
  const resets = new Date(budget.resetsOn).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return (
    <div className={`meter${spent ? ' meter--spent' : ''}`} title={`${budget.tokens.toLocaleString()} tokens · resets ${resets}`}>
      <span className="meter__label">
        <span>{budget.paused ? PAUSED[budget.paused] : spent ? 'Budget used up' : label}</span>
        <span className="tnum">
          {budget.paused ? `back at ${back.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : `${eur.format(budget.used)} / ${eur.format(budget.limit)}`}
        </span>
      </span>
      <progress max={Math.max(0.01, budget.limit)} value={Math.min(budget.used, budget.limit)} aria-label={label} />
    </div>
  )
}
