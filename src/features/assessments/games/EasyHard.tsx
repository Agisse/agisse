import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import './games.css'
import './reasoning.css'
import './pymetrics.css'

type Rand = () => number
export type Task = 'easy' | 'hard'
export type EffortItem = { p: number; reward: number }
export const TASKS = { easy: { presses: 5, ms: 3000 }, hard: { presses: 60, ms: 12000 } } as const
export const EASY_REWARD = 1
export const PROBS = [12, 50, 88] as const
export const CHOICE_MS = 5000
/** Seconds a round costs beyond the pressing itself (choosing, the result). */
const OVERHEAD_S = 2
/** Hard pays more per second of play above this reward; the win chance scales both tasks alike, so it drops out. */
export const BREAK_EVEN = (EASY_REWARD * (TASKS.hard.ms / 1000 + OVERHEAD_S)) / (TASKS.easy.ms / 1000 + OVERHEAD_S)
export const betterTask = (item: EffortItem): Task => (item.reward > BREAK_EVEN ? 'hard' : 'easy')

/** Hard reward 1.24–4.30; low levels keep it clear of the break-even (±0.81 at level 1, anywhere from level 10). */
export function makeEffortItem(level: number, rand: Rand = Math.random): EffortItem {
  const p = PROBS[Math.floor(rand() * PROBS.length)]!
  const margin = Math.max(0, 0.9 - level * 0.09)
  for (;;) {
    const reward = Math.round((1.24 + rand() * 3.06) * 100) / 100
    if (Math.abs(reward - BREAK_EVEN) >= margin && reward !== BREAK_EVEN) return { p, reward }
  }
}

/** kind = '<easy|hard|none>:<p>:<1 if the presses were finished>'. */
export function easyHardDetails(trials: Trial[]) {
  const picks = trials.map((t) => t.kind?.match(/^(easy|hard):(\d+):([01])$/)).filter((m) => m !== null && m !== undefined)
  const rate = (ms: RegExpMatchArray[]) => (ms.length ? Math.round((ms.filter((m) => m[1] === 'hard').length / ms.length) * 1000) / 1000 : 0)
  const hard = picks.filter((m) => m[1] === 'hard')
  const out: Record<string, number> = { hardRate: rate(picks) }
  for (const p of PROBS) out[`hardRate${p}`] = rate(picks.filter((m) => Number(m[2]) === p))
  out.hardCompletionRate = hard.length ? Math.round((hard.filter((m) => m[3] === '1').length / hard.length) * 1000) / 1000 : 0
  return out
}

type Phase =
  | { name: 'choose'; item: EffortItem }
  | { name: 'press'; item: EffortItem; task: Task; until: number; correct: boolean; choiceRt: number }
  | { name: 'result'; text: string; ok: boolean }

function EasyHardGame({ level, feedback, onTrial, rounds, onDone }: GameProps) {
  const [phase, setPhase] = useState<Phase>(() => ({ name: 'choose', item: makeEffortItem(level) }))
  const [count, setCount] = useState(0)
  const [total, setTotal] = useState(0)
  const shownAt = useRef(performance.now())
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  const played = useRef(0)
  const doneRef = useRef(onDone)
  useEffect(() => {
    levelRef.current = level
    doneRef.current = onDone
  })

  const why = (item: EffortItem) => `per second, hard pays more above $${BREAK_EVEN.toFixed(2)}; this one paid $${item.reward.toFixed(2)}`

  function choose(task: Task) {
    if (phase.name !== 'choose') return
    setCount(0)
    setPhase({ name: 'press', item: phase.item, task, until: performance.now() + TASKS[task].ms, correct: task === betterTask(phase.item), choiceRt: performance.now() - shownAt.current })
  }
  function finishPress(completed: boolean) {
    if (phase.name !== 'press') return
    const { item, task } = phase
    onTrial({ correct: phase.correct, rt: phase.choiceRt, level: itemLevel.current, kind: `${task}:${item.p}:${completed ? 1 : 0}` })
    const reward = task === 'easy' ? EASY_REWARD : item.reward
    const won = completed && Math.random() * 100 < item.p
    if (won) setTotal((t) => t + reward)
    const text = !completed ? 'Not finished in time: no reward' : won ? `Won $${reward.toFixed(2)}` : `Finished, but this round did not pay (${item.p}% chance)`
    setPhase({ name: 'result', ok: phase.correct, text: feedback ? `${text} · ${phase.correct ? 'better pick' : 'weaker pick'}: ${why(item)}` : text })
  }
  function press() {
    if (phase.name !== 'press') return
    const n = count + 1
    setCount(n)
    if (n >= TASKS[phase.task].presses) finishPress(true)
  }

  useEffect(() => {
    if (phase.name === 'choose') {
      shownAt.current = performance.now()
      itemLevel.current = levelRef.current
      const t = setTimeout(() => {
        onTrial({ correct: false, rt: CHOICE_MS, level: itemLevel.current, kind: `none:${phase.item.p}` })
        setPhase({ name: 'result', ok: false, text: 'No choice in 5 seconds: no reward this round' })
      }, CHOICE_MS)
      return () => clearTimeout(t)
    }
    const t = setTimeout(
      () => {
        if (phase.name === 'press') return finishPress(false)
        if (rounds && ++played.current >= rounds) return doneRef.current?.()
        setPhase({ name: 'choose', item: makeEffortItem(levelRef.current) })
      },
      phase.name === 'press' ? phase.until - performance.now() : feedback ? 2200 : 1200,
    )
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase.name === 'choose' && (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'e')) choose('easy')
      else if (phase.name === 'choose' && (e.key === 'ArrowRight' || e.key.toLowerCase() === 'h')) choose('hard')
      else if (e.key === ' ' && !e.repeat) {
        e.preventDefault()
        press()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="game">
      {phase.name === 'choose' && (
        <>
          <div className="game__prompt" aria-live="polite">
            {phase.item.p}% chance this round pays. Choose within 5 seconds.
          </div>
          <div className="pym-timer" style={{ '--timer-ms': `${CHOICE_MS}ms` } as CSSProperties} aria-hidden="true" />
          <div className="game__choices">
            <button type="button" className="btn rsn-option pym-effort" onClick={() => choose('easy')}>
              <span className="rsn-option__label">Easy</span>
              <span>5 presses in 3 s</span>
              <span className="pym-effort__pay">${EASY_REWARD.toFixed(2)}</span>
              <span className="pym-key">← or E</span>
            </button>
            <button type="button" className="btn rsn-option pym-effort" onClick={() => choose('hard')}>
              <span className="rsn-option__label">Hard</span>
              <span>60 presses in 12 s</span>
              <span className="pym-effort__pay">${phase.item.reward.toFixed(2)}</span>
              <span className="pym-key">→ or H</span>
            </button>
          </div>
        </>
      )}
      {phase.name === 'press' && (
        <>
          <div className="game__prompt" aria-live="polite">
            Press Space {TASKS[phase.task].presses} times
          </div>
          <div className="pym-meter" role="progressbar" aria-valuemin={0} aria-valuemax={TASKS[phase.task].presses} aria-valuenow={count}>
            <span style={{ width: `${(100 * count) / TASKS[phase.task].presses}%` }} />
          </div>
          <div key={phase.until} className="pym-timer" style={{ '--timer-ms': `${TASKS[phase.task].ms}ms` } as CSSProperties} aria-hidden="true" />
          <button
            type="button"
            className="btn btn--ink pym-mash"
            onPointerDown={(e) => {
              e.preventDefault()
              press()
            }}
        onClick={(e) => {
          if (e.detail === 0) press() // Enter on the focused button; Space is handled globally
        }}
        // A held Enter repeats clicks; one press is one response.
        onKeyDown={(e) => e.key === 'Enter' && e.repeat && e.preventDefault()}
          >
            Press ({count}/{TASKS[phase.task].presses})
          </button>
        </>
      )}
      <div className="game__prompt pym-tally">Won ${total.toFixed(2)}</div>
      <div className={`game__feedback ${phase.name === 'result' && feedback ? (phase.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {phase.name === 'result' && phase.text}
      </div>
      <div className="game__keys">← easy · → hard · then Space or tap to press</div>
    </div>
  )
}

export const easyHard: GameDef = {
  id: 'easy-hard',
  name: 'Easy or hard',
  skills: ['probabilistic-reasoning'],
  howTo: 'Each round, pick an easy task for $1 or a hard one for more, then press fast enough to finish it. The shown chance says how likely the round pays.',
  duration: 120,
  targetRt: 2500,
  Component: EasyHardGame satisfies ComponentType<GameProps>,
  details: easyHardDetails,
}
