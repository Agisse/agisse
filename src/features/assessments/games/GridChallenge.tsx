import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import { useRounds } from './rounds'
import { mirror, normalize, PieceArt, shapeKey, turn, type Cell } from './GridLock'
import './games.css'
import './reasoning.css'
import './aon.css'

type Rand = () => number
export const SYM = 6
export type Distractor =
  | { type: 'symmetry'; cells: boolean[]; symmetric: boolean }
  | { type: 'rotation'; a: Cell[]; b: Cell[]; mirrored: boolean }
export type GridTask = { dots: number[]; distractors: Distractor[] }

/** Dots to remember: 2 at level 1 up to 7 at level 10. */
export const spanFor = (level: number) => 2 + Math.round(((Math.min(10, Math.max(1, level)) - 1) * 5) / 9)

export const isSymmetric = (cells: boolean[]) => cells.every((on, i) => on === cells[Math.floor(i / SYM) * SYM + (SYM - 1 - (i % SYM))])

/** A random polyomino with no mirror symmetry, so "rotated" and "mirrored" never coincide. */
export function chiralPiece(n: number, rand: Rand): Cell[] {
  for (;;) {
    const cells: Cell[] = [[0, 0]]
    while (cells.length < n) {
      const [r, c] = cells[Math.floor(rand() * cells.length)]!
      const nb: Cell = [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]][Math.floor(rand() * 4)] as Cell
      if (!cells.some((x) => x[0] === nb[0] && x[1] === nb[1])) cells.push(nb)
    }
    const m = mirror(cells)
    if (![0, 1, 2, 3].some((k) => shapeKey(turn(m, k)) === shapeKey(cells))) return normalize(cells)
  }
}

/** Symmetry checks lose asymmetric cells (3 → 1) and rotation shapes grow (4 → 6 blocks) with level. */
export function makeDistractor(level: number, rand: Rand = Math.random): Distractor {
  if (rand() < 0.5) {
    const cells = Array<boolean>(SYM * SYM).fill(false)
    for (let r = 0; r < SYM; r++)
      for (let c = 0; c < SYM / 2; c++) if (rand() < 0.45) cells[r * SYM + c] = cells[r * SYM + SYM - 1 - c] = true
    const symmetric = rand() < 0.5
    if (!symmetric) {
      // Flipping cells on the left half only always breaks the mirror.
      const flips = level <= 3 ? 3 : level <= 6 ? 2 : 1
      const left = [...Array(SYM * SYM).keys()].filter((i) => i % SYM < SYM / 2)
      for (let k = 0; k < flips; k++) {
        const i = left.splice(Math.floor(rand() * left.length), 1)[0]!
        cells[i] = !cells[i]
      }
    }
    return { type: 'symmetry', cells, symmetric }
  }
  const a = chiralPiece(level <= 3 ? 4 : level <= 7 ? 5 : 6, rand)
  const mirrored = rand() < 0.5
  const b = turn(mirrored ? mirror(a) : a, mirrored ? Math.floor(rand() * 4) : 1 + Math.floor(rand() * 3))
  return { type: 'rotation', a, b, mirrored }
}

export function makeGridTask(level: number, rand: Rand = Math.random): GridTask {
  const span = spanFor(level)
  const dots: number[] = []
  while (dots.length < span) {
    const d = Math.floor(rand() * 16)
    if (!dots.includes(d)) dots.push(d)
  }
  return { dots, distractors: dots.map(() => makeDistractor(level, rand)) }
}

/** Answer 0 = symmetric / same shape turned; 1 = not symmetric / mirrored. */
export const distractorAnswer = (d: Distractor) => (d.type === 'symmetry' ? (d.symmetric ? 0 : 1) : d.mirrored ? 1 : 0)
/** Dots recalled in the right slot. */
export const recallHits = (dots: number[], picks: number[]) => dots.filter((d, i) => picks[i] === d).length

/** kind 'recall:<hits>/<span>' per task, 'distractor' per side judgement. */
export function gridChallengeDetails(trials: Trial[]) {
  const rec = trials.filter((t) => t.kind?.startsWith('recall:'))
  const dis = trials.filter((t) => t.kind === 'distractor')
  const share = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 1000 : 0)
  const parts = rec.map((t) => t.kind!.slice(7).split('/').map(Number))
  return {
    recallAccuracy: share(rec.filter((t) => t.correct).length, rec.length),
    recallPositionRate: share(
      parts.reduce((s, [h]) => s + h!, 0),
      parts.reduce((s, [, n]) => s + n!, 0),
    ),
    distractorAccuracy: share(dis.filter((t) => t.correct).length, dis.length),
  }
}

const DOT_MS = 1000
type Phase = { name: 'dot'; i: number } | { name: 'judge'; i: number; fb: boolean | null } | { name: 'recall' } | { name: 'done'; hits: number }

function GridChallengeGame({ level, mode, feedback, onTrial, rounds, onDone }: GameProps) {
  const r = useRounds({ rounds, onDone, mode })
  const [task, setTask] = useState(() => makeGridTask(level))
  const [phase, setPhase] = useState<Phase>({ name: 'dot', i: 0 })
  const [picks, setPicks] = useState<number[]>([])
  const gridRef = useRef<HTMLDivElement>(null)
  const shownAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })
  const span = task.dots.length

  useEffect(() => {
    shownAt.current = performance.now()
    if (phase.name === 'dot') {
      const t = setTimeout(() => setPhase({ name: 'judge', i: phase.i, fb: null }), DOT_MS)
      return () => clearTimeout(t)
    }
    if (phase.name === 'judge' && phase.fb !== null) {
      const t = setTimeout(() => setPhase(phase.i + 1 < span ? { name: 'dot', i: phase.i + 1 } : { name: 'recall' }), feedback ? 700 : 150)
      return () => clearTimeout(t)
    }
    if (phase.name === 'done') {
      const t = setTimeout(
        () => {
          itemLevel.current = levelRef.current
          setTask(makeGridTask(levelRef.current))
          setPicks([])
          setPhase({ name: 'dot', i: 0 })
        },
        feedback ? 1600 : 400,
      )
      return () => clearTimeout(t)
    }
  }, [phase, span, feedback])

  function judge(ans: 0 | 1) {
    if (phase.name !== 'judge' || phase.fb !== null) return
    const ok = distractorAnswer(task.distractors[phase.i]!) === ans
    onTrial({ correct: ok, rt: performance.now() - shownAt.current, level: itemLevel.current, kind: 'distractor' })
    setPhase({ ...phase, fb: ok })
  }
  function tap(c: number) {
    if (phase.name !== 'recall' || picks.includes(c)) return
    const p = [...picks, c]
    setPicks(p)
    if (p.length < span) return
    const hits = recallHits(task.dots, p)
    onTrial({ correct: hits === span, rt: performance.now() - shownAt.current, level: itemLevel.current, kind: `recall:${hits}/${span}` })
    if (!r.count()) setPhase({ name: 'done', hits })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (phase.name === 'judge') {
        if (e.key === 'f' || e.key === 'F' || e.key === 'ArrowLeft') judge(0)
        else if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowRight') judge(1)
        return
      }
      if (phase.name !== 'recall') return
      if (e.key === 'Backspace') return setPicks((p) => p.slice(0, -1))
      const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 }[e.key]
      if (!d) return
      e.preventDefault()
      const cells = [...(gridRef.current?.querySelectorAll<HTMLButtonElement>('.game__cell') ?? [])]
      const i = cells.indexOf(document.activeElement as HTMLButtonElement)
      cells[i < 0 ? 0 : Math.min(15, Math.max(0, i + d))]?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const d = phase.name === 'judge' ? task.distractors[phase.i]! : null
  const labels = d?.type === 'symmetry' ? ['Symmetric', 'Not symmetric'] : ['Same shape', 'Mirrored']
  const prompt =
    phase.name === 'dot'
      ? `Remember the dot (${phase.i + 1} of ${span})`
      : phase.name === 'judge'
        ? d!.type === 'symmetry'
          ? 'Is the pattern symmetric left to right?'
          : 'Is the right shape the left one turned, or a mirror image?'
        : phase.name === 'recall'
          ? `Tap the ${span} dots in order (${picks.length}/${span})`
          : 'Next task…'
  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        {prompt}
      </div>
      {d ? (
        <>
          {d.type === 'symmetry' ? (
            <svg className="aon-sym" viewBox={`0 0 ${SYM * 10} ${SYM * 10}`} aria-hidden="true">
              <line x1={SYM * 5} y1={0} x2={SYM * 5} y2={SYM * 10} className="aon-sym__axis" />
              {d.cells.map((on, i) => on && <rect key={i} x={(i % SYM) * 10 + 1} y={Math.floor(i / SYM) * 10 + 1} width={8} height={8} />)}
            </svg>
          ) : (
            <div className="aon-pair">
              <PieceArt cells={d.a} unit={22} />
              <PieceArt cells={d.b} unit={22} />
            </div>
          )}
          <div className="game__choices">
            {labels.map((l, i) => (
              <button key={l} type="button" className="btn game__choice" disabled={phase.name === 'judge' && phase.fb !== null} onClick={() => judge(i as 0 | 1)}>
                <span className="rsn-key">{i ? 'J' : 'F'}</span> {l}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div ref={gridRef} className="game__grid rsn-grid" style={{ gridTemplateColumns: 'repeat(4, auto)' }}>
          {Array.from({ length: 16 }, (_, c) => {
            const order = picks.indexOf(c)
            const reveal = phase.name === 'done' && feedback ? task.dots.indexOf(c) : -1
            return (
              <button
                key={c}
                type="button"
                className="game__cell aon-dotcell"
                data-on={phase.name === 'dot' ? task.dots[phase.i] === c : reveal >= 0}
                data-wrong={phase.name === 'done' && feedback && order >= 0 && task.dots[order] !== c ? 'true' : undefined}
                aria-label={`Row ${Math.floor(c / 4) + 1}, column ${(c % 4) + 1}${order >= 0 ? `, picked ${order + 1}` : ''}`}
                disabled={phase.name !== 'recall'}
                onClick={() => tap(c)}
              >
                {reveal >= 0 ? reveal + 1 : order >= 0 && phase.name === 'recall' ? order + 1 : ''}
              </button>
            )
          })}
        </div>
      )}
      <div className={`game__feedback ${feedback && ((phase.name === 'judge' && phase.fb !== null) || phase.name === 'done') ? ((phase.name === 'judge' ? phase.fb : phase.name === 'done' && phase.hits === span) ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {feedback && phase.name === 'judge' && phase.fb !== null && (phase.fb ? 'Right' : `Not quite: it was ${labels[distractorAnswer(d!)]!.toLowerCase()}`)}
        {feedback && phase.name === 'done' && (phase.hits === span ? `Right: all ${span} in order` : `${phase.hits} of ${span} in the right place; the order is shown`)}
      </div>
      <div className="game__keys">{phase.name === 'recall' ? 'Arrows to move · Space to tap · Backspace to undo' : 'F or ← for the left answer · J or → for the right'}</div>
    </div>
  )
}

export const gridChallenge: GameDef = {
  id: 'grid-challenge',
  name: 'Grid challenge',
  skills: ['working-memory', 'spatial-memory'],
  howTo: 'Remember where each dot appears while answering a quick shape question between dots; then tap the dots in order.',
  duration: 540,
  targetRt: 6000,
  Component: GridChallengeGame satisfies ComponentType<GameProps>,
  details: gridChallengeDetails,
}
