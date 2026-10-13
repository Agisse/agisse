import type { Budget } from '../../shared/types'

const eur = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' })

/** Monthly spend against the allowance the admin set. */
export function BudgetMeter({ budget, label = 'Budget this month' }: { budget: Budget; label?: string }) {
  const spent = budget.used >= budget.limit
  const resets = new Date(budget.resetsOn).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return (
    <div className={`meter${spent ? ' meter--spent' : ''}`} title={`${budget.tokens.toLocaleString()} tokens · resets ${resets}`}>
      <span className="meter__label">
        <span>{spent ? 'Budget used up' : label}</span>
        <span className="tnum">
          {eur.format(budget.used)} / {eur.format(budget.limit)}
        </span>
      </span>
      <progress max={Math.max(0.01, budget.limit)} value={Math.min(budget.used, budget.limit)} aria-label={label} />
    </div>
  )
}
