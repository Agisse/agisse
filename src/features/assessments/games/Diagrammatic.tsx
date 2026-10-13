import type { ComponentType, ReactNode } from 'react'
import type { GameDef, GameProps } from '../engine/types'
import { shuffle } from './SequenceReasoning'
import { AptLayout, Choices, Explain, useItemLoop } from './Aptitude'

// Diagrammatic reasoning (Saville Swift, SHL, Talent Q logical): a row of shapes passes through operator boxes. Each box's rule is
// shown once by example; work out the rules, then apply the chain. Generated, so the answer is exact.

type Rand = () => number
export type Glyph = { s: 'tri' | 'circ' | 'sq' | 'dia'; f: boolean; r: number }
export type Fig = Glyph[]
export const OPS = ['rotate', 'invert', 'reverse', 'shift', 'drop', 'add'] as const
export type Op = (typeof OPS)[number]
const SYMS = ['star', 'cross', 'ring', 'bars', 'wave', 'hex'] as const
type Sym = (typeof SYMS)[number]
const SHAPES: Glyph['s'][] = ['tri', 'circ', 'sq', 'dia']

export const OP_TEXT: Record<Op, string> = {
  rotate: 'turns every shape 90° clockwise',
  invert: 'swaps black and white',
  reverse: 'reverses the order',
  shift: 'moves the first shape to the end',
  drop: 'removes the last shape',
  add: 'adds a copy of the first shape at the end',
}

export function apply(op: Op, fig: Fig): Fig {
  switch (op) {
    case 'rotate':
      return fig.map((g) => ({ ...g, r: (g.r + 90) % 360 }))
    case 'invert':
      return fig.map((g) => ({ ...g, f: !g.f }))
    case 'reverse':
      return [...fig].reverse()
    case 'shift':
      return [...fig.slice(1), fig[0]!]
    case 'drop':
      return fig.slice(0, -1)
    case 'add':
      return [...fig, { ...fig[0]! }]
  }
}
export const run = (chain: Op[], fig: Fig) => chain.reduce((f, op) => apply(op, f), fig)
/** What the eye sees: only a triangle shows its rotation. */
export const figKey = (f: Fig) => f.map((g) => `${g.s}${g.f ? 1 : 0}${g.s === 'tri' ? g.r : 0}`).join(' ')

const int = (lo: number, hi: number, rand: Rand) => lo + Math.floor(rand() * (hi - lo + 1))
/** A random row with at least one triangle, so rotation always shows. */
function randomFig(len: number, rand: Rand): Fig {
  const f: Fig = Array.from({ length: len }, () => ({ s: SHAPES[int(0, 3, rand)]!, f: rand() < 0.5, r: int(0, 3, rand) * 90 }))
  if (!f.some((g) => g.s === 'tri')) f[int(0, len - 1, rand)]!.s = 'tri'
  return f
}

export type DiagItem = { input: Fig; chain: Op[]; sym: Partial<Record<Op, Sym>>; examples: { op: Op; from: Fig; to: Fig }[]; options: Fig[]; answer: number; explain: string[] }

/** One box at levels 1–3, two at 4–7, three from 8; rows of 3 shapes, 4 from level 6. */
export function makeDiagItem(level: number, rand: Rand = Math.random): DiagItem {
  const chain = shuffle([...OPS], rand).slice(0, level >= 8 ? 3 : level >= 4 ? 2 : 1)
  const syms = shuffle([...SYMS], rand)
  const sym = Object.fromEntries(chain.map((op, i) => [op, syms[i]!])) as Partial<Record<Op, Sym>>
  const input = randomFig(level >= 6 ? 4 : 3, rand)
  const ans = run(chain, input)
  const examples = chain.map((op) => {
    let from = randomFig(3, rand)
    // One example must pin the rule down: it changes the row, and no other box would turn it into the same row.
    const ambiguous = (f: Fig) => figKey(apply(op, f)) === figKey(f) || OPS.some((o) => o !== op && figKey(apply(o, f)) === figKey(apply(op, f)))
    for (let k = 0; k < 200 && ambiguous(from); k++) from = randomFig(3, rand)
    return { op, from, to: apply(op, from) }
  })
  // Distractors: the chain with a box skipped or the order swapped, then the answer with one extra rule or one shape changed.
  const near: Fig[] = [run(chain.slice(0, -1), input), run(chain.slice(1), input), run([...chain].reverse(), input), ...OPS.map((op) => apply(op, ans))]
  const seen = new Set([figKey(ans)])
  const wrong: Fig[] = []
  const add = (f: Fig) => {
    if (!f.length || wrong.length >= 4 || seen.has(figKey(f))) return
    seen.add(figKey(f))
    wrong.push(f)
  }
  near.forEach(add)
  for (let k = 0; wrong.length < 4; k++) add(ans.map((g, i) => (i === k % ans.length ? { ...g, s: SHAPES[(SHAPES.indexOf(g.s) + 1 + Math.floor(k / ans.length)) % 4]! } : g)))
  const options = shuffle([ans, ...wrong.slice(0, 3 + Number(level >= 4))], rand)
  const name = (op: Op) => `The ${sym[op]} box`
  return {
    input,
    chain,
    sym,
    examples,
    options,
    answer: options.indexOf(ans),
    explain: [...chain.map((op) => `${name(op)} ${OP_TEXT[op]}.`), chain.length > 1 ? 'Apply them left to right, in the order the boxes appear.' : 'Apply it to the row.'],
  }
}

const SHAPE_SVG = (g: Glyph) => {
  const p = { fill: g.f ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinejoin: 'round' as const }
  if (g.s === 'circ') return <circle cx="12" cy="12" r="8" {...p} />
  if (g.s === 'sq') return <rect x="5" y="5" width="14" height="14" {...p} />
  if (g.s === 'dia') return <polygon points="12,3 21,12 12,21 3,12" {...p} />
  return <polygon points="12,3 20,19 4,19" transform={`rotate(${g.r} 12 12)`} {...p} />
}
const describe = (f: Fig) => f.map((g) => `${g.f ? 'black' : 'white'} ${{ tri: `triangle pointing ${['up', 'right', 'down', 'left'][g.r / 90]}`, circ: 'circle', sq: 'square', dia: 'diamond' }[g.s]}`).join(', ')

export function FigView({ fig }: { fig: Fig }) {
  return (
    <span className="apt__fig" role="img" aria-label={describe(fig)}>
      {fig.map((g, i) => (
        <svg key={i} viewBox="0 0 24 24" aria-hidden="true">
          {SHAPE_SVG(g)}
        </svg>
      ))}
    </span>
  )
}

// Functions, not elements: module-level JSX would need React in scope when Node imports this for the checks.
const SYM_SVG: Record<Sym, () => ReactNode> = {
  star: () => <polygon points="10,2 12.4,7.6 18.5,8.1 13.8,12 15.3,18 10,14.8 4.7,18 6.2,12 1.5,8.1 7.6,7.6" />,
  cross: () => <path d="M3 3 17 17M17 3 3 17" />,
  ring: () => <circle cx="10" cy="10" r="6" />,
  bars: () => <path d="M3 5h14M3 10h14M3 15h14" />,
  wave: () => <path d="M2 10c2-5 4-5 6 0s4 5 6 0 3-4 4-2" />,
  hex: () => <polygon points="10,2 17,6 17,14 10,18 3,14 3,6" />,
}
function Box({ s }: { s: Sym }) {
  return (
    <span className="apt__box" role="img" aria-label={`${s} box`}>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        {SYM_SVG[s]()}
      </svg>
    </span>
  )
}
const Arrow = () => (
  <span className="apt__arrow" aria-hidden="true">
    →
  </span>
)

function DiagrammaticGame(props: GameProps) {
  const { item, result, submit, next, seq } = useItemLoop(makeDiagItem, props)
  return (
    <AptLayout
      stimulus={
        <>
          <div className="apt__label">What each box does, by example</div>
          {item.examples.map((e) => (
            <div key={e.op} className="apt__flow">
              <FigView fig={e.from} />
              <Arrow />
              <Box s={item.sym[e.op]!} />
              <Arrow />
              <FigView fig={e.to} />
            </div>
          ))}
        </>
      }
      question={
        <>
          <span className="apt__flow">
            <FigView fig={item.input} />
            {item.chain.map((op) => (
              <span key={op} className="apt__flow">
                <Arrow />
                <Box s={item.sym[op]!} />
              </span>
            ))}
            <Arrow /> ?
          </span>
          <span className="apt__rule">Which row comes out?</span>
        </>
      }
    >
      <Choices key={seq} options={item.options.map((f, i) => <FigView key={i} fig={f} />)} answer={item.answer} result={result} onPick={(_, ok) => submit(ok, `ops:${item.chain.length}`)} />
      {result !== null && <Explain ok={result} text={item.explain.map((l) => <p key={l}>{l}</p>)} onNext={next} />}
    </AptLayout>
  )
}

export const diagrammatic: GameDef = {
  id: 'diagrammatic',
  name: 'Diagrammatic reasoning',
  skills: ['logical-reasoning'],
  howTo: 'Each box changes the row of shapes in one way, shown by example. Pass the row through the boxes in order and pick the result.',
  duration: 480,
  targetRt: 30000,
  Component: DiagrammaticGame satisfies ComponentType<GameProps>,
}
