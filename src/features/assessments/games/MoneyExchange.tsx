import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import './games.css'
import './pymetrics.css'

type Rand = () => number
export type Exchange = 'send' | 'give' | 'take'
/** Shares of the tripled amount the simulated partner sends back. */
export const RETURN_SHARES = [0, 0.2, 1 / 3, 0.5, 0.6] as const
export const MULTIPLIER = 3

// ponytail: no difficulty axis and no right answer; level is recorded but changes nothing.
/** trust: always 'send'. dictator: alternates give (your $10) and take (the stranger's $10). */
export const exchangeOf = (variant: string | undefined, round: number): Exchange => (variant !== 'dictator' ? 'send' : round % 2 ? 'take' : 'give')
export const returned = (sent: number, rand: Rand = Math.random) => Math.round(sent * MULTIPLIER * RETURN_SHARES[Math.floor(rand() * RETURN_SHARES.length)]!)
/** What another stranger gives you out of $10, for the dictator fairness rating. */
export const strangerGift = (rand: Rand = Math.random) => Math.floor(rand() * 6)
/** Preference only: every answer counts as correct. kind = '<send|give|take>:<your amount>:<their amount>:<fairness 0–10>'. */
export const exchangeTrial = (ex: Exchange, mine: number, theirs: number, fair: number, rt: number, level: number): Trial => ({ correct: true, rt, level, kind: `${ex}:${mine}:${theirs}:${fair}` })

export function moneyExchangeDetails(trials: Trial[]) {
  const rs = trials.map((t) => t.kind?.match(/^(send|give|take):(\d+):(\d+):(\d+)$/)).filter((m) => m !== null && m !== undefined)
  const avg = (ms: RegExpMatchArray[], i: number) => Math.round((ms.reduce((s, m) => s + Number(m[i]), 0) / ms.length) * 100) / 100
  const out: Record<string, number> = {}
  for (const [ex, key] of [['send', 'avgSent'], ['give', 'avgGiven'], ['take', 'avgTaken']] as const) {
    const ms = rs.filter((m) => m[1] === ex)
    if (ms.length) out[key] = avg(ms, 2)
  }
  if (rs.length) out.avgFairness = avg(rs, 4)
  return out
}

type Step = { name: 'decide' } | { name: 'rate'; mine: number; theirs: number; decideMs: number } | { name: 'next' }

function MoneyExchangeGame({ level, onTrial, variant, rounds, onDone }: GameProps) {
  const [round, setRound] = useState(0)
  const [step, setStep] = useState<Step>({ name: 'decide' })
  const [value, setValue] = useState(5)
  const shownAt = useRef(performance.now())
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })
  const ex = exchangeOf(variant, round)

  function confirm() {
    if (step.name === 'decide') {
      const theirs = ex === 'send' ? returned(value) : strangerGift()
      setStep({ name: 'rate', mine: value, theirs, decideMs: performance.now() - shownAt.current })
      setValue(5)
    } else if (step.name === 'rate') {
      onTrial(exchangeTrial(ex, step.mine, step.theirs, value, step.decideMs, level))
      setStep({ name: 'next' })
    }
  }

  useEffect(() => {
    if (step.name !== 'next') return
    const t = setTimeout(() => {
      if (rounds && round + 1 >= rounds) return doneRef.current?.()
      setRound((r) => r + 1)
      setValue(5)
      setStep({ name: 'decide' })
      shownAt.current = performance.now()
    }, 600)
    return () => clearTimeout(t)
  }, [step, round, rounds])

  const question =
    step.name === 'rate'
      ? ex === 'send'
        ? `You sent $${step.mine}; it tripled to $${step.mine * MULTIPLIER}. Your partner sent back $${step.theirs}. How fair was that?`
        : `Another stranger split $10 and gave you $${step.theirs}. How fair was that?`
      : ex === 'send'
        ? 'You have $10. Whatever you send your partner is tripled; they then choose how much to send back. How much do you send?'
        : ex === 'give'
          ? 'You have $10 and a stranger has nothing. How much do you give them?'
          : 'A stranger has $10 and you have nothing. How much do you take?'
  const rating = step.name === 'rate'
  return (
    <div className="game">
      <div className="pym-note">There is no better answer here: this game reads your preferences, not a skill.</div>
      <div className="game__prompt" aria-live="polite">
        Round {round + 1}: {step.name === 'next' ? 'Saved' : question}
      </div>
      {step.name !== 'next' && (
        <form
          className="pym-money"
          // A held Enter would confirm this step and then the next one, a rating never chosen.
          onKeyDown={(e) => e.key === 'Enter' && e.repeat && e.preventDefault()}
          onSubmit={(e) => {
            e.preventDefault()
            confirm()
          }}
        >
          <label className="pym-money__value">
            <span className="sr-only">{rating ? 'Fairness from 0 to 10' : 'Dollars'}</span>
            <input type="range" min={0} max={10} step={1} value={value} onChange={(e) => setValue(Number(e.target.value))} autoFocus />
            <output className="game__stimulus">{rating ? `${value} / 10` : `$${value}`}</output>
          </label>
          {rating && (
            <div className="pym-money__scale game__sub">
              <span>0 very unfair</span>
              <span>10 very fair</span>
            </div>
          )}
          <button type="submit" className="btn btn--primary">
            Confirm
          </button>
        </form>
      )}
      <div className="game__keys">← → to adjust · Enter to confirm</div>
    </div>
  )
}

export const moneyExchange: GameDef = {
  id: 'money-exchange',
  name: 'Money exchange',
  skills: ['probabilistic-reasoning'],
  howTo: 'Decide how much money to share with a partner and rate how fair their choices feel. There are no right answers.',
  duration: 120,
  targetRt: 8000,
  Component: MoneyExchangeGame satisfies ComponentType<GameProps>,
  details: moneyExchangeDetails,
}
