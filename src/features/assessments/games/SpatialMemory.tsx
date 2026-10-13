import { useEffect, useRef, useState, type ComponentType } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import { useRounds } from './rounds'
import './games.css'
import './reasoning.css'
import './variants.css'

type Rand = () => number
export type SpatialItem = { size: number; cells: number[]; showMs: number }

/** Grid grows 3×3 → 6×6, cells 3 → 9, display time 2.1 s → 0.9 s. */
export function makeSpatialItem(level: number, rand: Rand = Math.random): SpatialItem {
  const size = level <= 2 ? 3 : level <= 4 ? 4 : level <= 7 ? 5 : 6
  const k = Math.min(Math.floor((size * size) / 2), 2 + Math.ceil(level * 0.7))
  const cells = new Set<number>()
  while (cells.size < k) cells.add(Math.floor(rand() * size * size))
  return { size, cells: [...cells].sort((a, b) => a - b), showMs: Math.max(900, 2200 - 130 * level) }
}

export const countHits = (cells: number[], picked: number[]) => picked.filter((c) => cells.includes(c)).length
export const isRecalled = (cells: number[], picked: number[]) => picked.length === cells.length && countHits(cells, picked) === cells.length

// Tiles (Arctic Shores): a Corsi sequence on a 4×4 board with distractor flashes in another colour.
export const TILE_SIZE = 4
export const START_TILES = 3
export const MAX_TILES = 12
/** A simulation ends after this many wrong sequences in a row. */
export const TILES_MAX_MISSES = 2
export type TileStep = { cell: number; distractor: boolean }
export type TilesItem = { seq: number[]; stream: TileStep[] }

/** One distractor flash per three targets, at least one. */
export const distractorCount = (len: number) => Math.max(1, Math.floor(len / 3))
/** Flash time per tile: 750 ms at level 1 down to 450 ms at 10. */
export const tileMs = (level: number) => Math.max(450, 780 - level * 33)
export const nextTilesLen = (len: number, ok: boolean) => (ok ? Math.min(MAX_TILES, len + 1) : Math.max(2, len - 1))

/** Distinct target tiles in order; distractors go anywhere after the first target, never on a neighbouring flash's tile. */
export function makeTiles(len: number, rand: Rand = Math.random): TilesItem {
  const cells = TILE_SIZE * TILE_SIZE
  const seq: number[] = []
  while (seq.length < len) {
    const c = Math.floor(rand() * cells)
    if (!seq.includes(c)) seq.push(c)
  }
  const stream: TileStep[] = seq.map((cell) => ({ cell, distractor: false }))
  for (let d = 0; d < distractorCount(len); d++) {
    const at = 1 + Math.floor(rand() * stream.length)
    let c: number
    do c = Math.floor(rand() * cells)
    while (c === stream[at - 1]!.cell || c === stream[at]?.cell)
    stream.splice(at, 0, { cell: c, distractor: true })
  }
  return { seq, stream }
}
export const isTilesCorrect = (seq: number[], picked: number[]) => picked.length === seq.length && picked.every((c, i) => c === seq[i])

/** Tiles trials are tagged 'tiles:<len>'; the pattern game has no tags and no details. */
export function tilesDetails(trials: Trial[]): Record<string, number> {
  const ts = trials.filter((t) => t.kind?.startsWith('tiles:'))
  if (!ts.length) return {}
  return { maxSpan: Math.max(0, ...ts.filter((t) => t.correct).map((t) => Number(t.kind!.slice(6)))) }
}

type TilesPhase = { name: 'show'; i: number; blank: boolean } | { name: 'recall' } | { name: 'fb'; ok: boolean }

function TilesGame({ level, feedback, onTrial, ...props }: GameProps) {
  const rr = useRounds(props)
  const [item, setItem] = useState(() => makeTiles(START_TILES))
  const [phase, setPhase] = useState<TilesPhase>({ name: 'show', i: 0, blank: true })
  const [picked, setPicked] = useState<number[]>([])
  const misses = useRef(0)
  const nextLen = useRef(START_TILES)
  const gridRef = useRef<HTMLDivElement>(null)
  const recallAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })

  useEffect(() => {
    if (phase.name === 'recall') {
      recallAt.current = performance.now()
      return
    }
    const t = setTimeout(
      () => {
        if (phase.name === 'fb') {
          itemLevel.current = levelRef.current
          setItem(makeTiles(nextLen.current))
          setPicked([])
          setPhase({ name: 'show', i: 0, blank: true })
        } else if (phase.blank) setPhase({ ...phase, blank: false })
        else if (phase.i + 1 < item.stream.length) setPhase({ name: 'show', i: phase.i + 1, blank: true })
        else setPhase({ name: 'recall' })
      },
      phase.name === 'fb' ? (feedback ? 1400 : 400) : phase.blank ? (phase.i === 0 ? 700 : 250) : tileMs(itemLevel.current),
    )
    return () => clearTimeout(t)
  }, [phase, item])

  function pick(c: number) {
    if (phase.name !== 'recall') return
    const next = [...picked, c]
    setPicked(next)
    if (next.length < item.seq.length) return
    const ok = isTilesCorrect(item.seq, next)
    onTrial({ correct: ok, rt: performance.now() - recallAt.current, level: itemLevel.current, kind: `tiles:${item.seq.length}` })
    if (rr.count()) return
    misses.current = ok ? 0 : misses.current + 1
    if (misses.current >= TILES_MAX_MISSES) rr.endRule()
    if (rr.done()) return
    nextLen.current = nextTilesLen(item.seq.length, ok)
    setPhase({ name: 'fb', ok })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -TILE_SIZE, ArrowDown: TILE_SIZE }[e.key]
      if (!d) return
      e.preventDefault()
      const cells = [...(gridRef.current?.querySelectorAll<HTMLButtonElement>('.game__cell') ?? [])]
      const i = cells.indexOf(document.activeElement as HTMLButtonElement)
      cells[i < 0 ? 0 : Math.min(cells.length - 1, Math.max(0, i + d))]?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const flash = phase.name === 'show' && !phase.blank ? item.stream[phase.i] : undefined
  const len = item.seq.length
  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        {phase.name === 'show' ? `Watch the blue tiles, ignore the orange ones · ${len} tiles` : phase.name === 'recall' ? `Tap the ${len} blue tiles in order (${picked.length}/${len})` : ''}
      </div>
      <div ref={gridRef} className="game__grid rsn-grid" style={{ gridTemplateColumns: `repeat(${TILE_SIZE}, auto)` }}>
        {Array.from({ length: TILE_SIZE * TILE_SIZE }, (_, c) => {
          const lit = flash?.cell === c ? (flash.distractor ? 'distractor' : 'target') : phase.name === 'fb' && feedback && item.seq.includes(c) ? 'target' : undefined
          const n = phase.name === 'fb' && feedback ? item.seq.indexOf(c) : picked.lastIndexOf(c)
          return (
            <button
              key={c}
              type="button"
              className="game__cell var-tile"
              data-lit={lit}
              aria-label={`Row ${Math.floor(c / TILE_SIZE) + 1}, column ${(c % TILE_SIZE) + 1}`}
              disabled={phase.name !== 'recall'}
              onClick={() => pick(c)}
            >
              {n >= 0 && (phase.name !== 'show' ? n + 1 : '')}
            </button>
          )
        })}
      </div>
      <div className={`game__feedback ${phase.name === 'fb' && feedback ? (phase.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {phase.name === 'fb' && feedback && (phase.ok ? `Right: all ${len} in order; next one is longer` : 'Not quite: the right order is numbered')}
      </div>
      <div className="game__keys">Arrows to move · Space or Enter to tap a tile · the orange flashes are distractors</div>
    </div>
  )
}

function SpatialMemoryGame({ level, feedback, onTrial, ...props }: GameProps) {
  const rr = useRounds(props)
  const [item, setItem] = useState(() => makeSpatialItem(level))
  const [phase, setPhase] = useState<'show' | 'recall' | 'fb'>('show')
  const [picked, setPicked] = useState<number[]>([])
  const gridRef = useRef<HTMLDivElement>(null)
  const recallAt = useRef(0)
  const itemLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })
  useEffect(() => {
    itemLevel.current = levelRef.current
    const t = setTimeout(() => {
      setPhase('recall')
      recallAt.current = performance.now()
    }, item.showMs)
    return () => clearTimeout(t)
  }, [item])
  useEffect(() => {
    if (phase !== 'fb') return
    const t = setTimeout(
      () => {
        setPicked([])
        setPhase('show')
        setItem(makeSpatialItem(levelRef.current))
      },
      feedback ? 1200 : 300,
    )
    return () => clearTimeout(t)
  }, [phase, feedback])

  const k = item.cells.length
  function toggle(c: number) {
    if (phase !== 'recall') return
    setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : p.length < k ? [...p, c] : p))
  }
  function submit() {
    if (phase !== 'recall' || picked.length !== k) return
    onTrial({ correct: isRecalled(item.cells, picked), rt: performance.now() - recallAt.current, level: itemLevel.current })
    if (rr.count()) return
    setPhase('fb')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === 'Enter' && picked.length === k) {
        e.preventDefault()
        submit()
        return
      }
      const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -item.size, ArrowDown: item.size }[e.key]
      if (!d) return
      e.preventDefault()
      const cells = [...(gridRef.current?.querySelectorAll<HTMLButtonElement>('.game__cell') ?? [])]
      const i = cells.indexOf(document.activeElement as HTMLButtonElement)
      cells[i < 0 ? 0 : Math.min(cells.length - 1, Math.max(0, i + d))]?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const hits = countHits(item.cells, picked)
  return (
    <div className="game">
      <div aria-live="polite" className="game__prompt">
        {phase === 'show' ? `Remember these ${k} squares` : phase === 'recall' ? `Select the ${k} squares (${picked.length}/${k})` : 'Next pattern…'}
      </div>
      <div ref={gridRef} className="game__grid rsn-grid" style={{ gridTemplateColumns: `repeat(${item.size}, auto)` }}>
        {Array.from({ length: item.size * item.size }, (_, c) => {
          const target = item.cells.includes(c)
          const on = phase === 'show' ? target : picked.includes(c)
          const reveal = phase === 'fb' && feedback
          return (
            <button
              key={c}
              type="button"
              className="game__cell"
              data-on={reveal ? target : on}
              data-wrong={reveal && picked.includes(c) && !target ? 'true' : undefined}
              aria-pressed={phase === 'recall' ? picked.includes(c) : undefined}
              aria-label={`Row ${Math.floor(c / item.size) + 1}, column ${(c % item.size) + 1}`}
              disabled={phase !== 'recall'}
              onClick={() => toggle(c)}
            />
          )
        })}
      </div>
      <button type="button" className="btn btn--ink" disabled={phase !== 'recall' || picked.length !== k} onClick={submit}>
        Done
      </button>
      <div className={`game__feedback ${phase === 'fb' && feedback ? (hits === k ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {phase === 'fb' && feedback && (hits === k ? `Right: all ${k} squares` : `Not quite: ${hits} of ${k} right; the pattern is shown`)}
      </div>
      <div className="game__keys">Arrows to move · Space to select · Enter when all {k} are selected</div>
    </div>
  )
}

export const spatialMemory: GameDef = {
  id: 'spatial-memory',
  name: 'Spatial memory',
  skills: ['spatial-memory', 'working-memory'],
  howTo: 'A few squares light up briefly; select the same squares once they disappear.',
  duration: 150,
  targetRt: 5000,
  Component: ((p: GameProps) => (p.variant === 'tiles' ? <TilesGame {...p} /> : <SpatialMemoryGame {...p} />)) satisfies ComponentType<GameProps>,
  details: tilesDetails,
}
