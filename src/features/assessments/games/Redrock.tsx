import { useEffect, useRef, useState, type ComponentType, type FormEvent } from 'react'
import type { GameDef, GameProps, Trial } from '../engine/types'
import './games.css'
import './solve.css'

type Rand = () => number
export type Theme = {
  title: string
  intro: string
  unit: string
  place: string
  places: string[]
  area: { label: string; unit: string }
  decoy: { label: string; lo: number; hi: number; dp: number }
  miniRows: string[]
  miniCols: [string, string]
}
export type Region = { name: string; y1: number; y2: number; area: number; decoy: number }
export type Question = { text: string; answer: number; dp: number; unit: string; explain: string }
export type Blank = { label: string; options: string[]; answer: number }
export type ChoiceItem = { prompt: string; blanks: Blank[]; explain: string; table?: { cols: string[]; rows: (string | number)[][] } }
export type Study = {
  theme: Theme
  years: [number, number]
  horizon: number
  regions: Region[]
  /** Figure ids (`name|field`) the three analysis questions need. */
  relevant: string[]
  questions: Question[]
  report: ChoiceItem[]
  minis: ChoiceItem[]
}

export const THEMES: Theme[] = [
  {
    title: 'Elk herd survey',
    intro: 'A park authority counted elk in its valleys in two survey years and wants to know where herds are thriving.',
    unit: 'elk',
    place: 'valley',
    places: ['Ashford', 'Brenmoor', 'Calder', 'Dunvale', 'Elmstead'],
    area: { label: 'Grazing area', unit: 'km²' },
    decoy: { label: 'Annual rainfall (mm)', lo: 400, hi: 1200, dp: 0 },
    miniRows: ['Feeding stations', 'Fence repair', 'Collar tagging', 'Ranger patrols'],
    miniCols: ['Spend year 1 (k€)', 'Spend year 2 (k€)'],
  },
  {
    title: 'Reef recovery survey',
    intro: 'A marine trust counted coral colonies on its reefs in two survey years to judge which restoration sites are recovering.',
    unit: 'colonies',
    place: 'reef',
    places: ['North Bank', 'Pearl Shoal', 'Saddle Reef', 'Long Key', 'Outer Rim'],
    area: { label: 'Survey area', unit: 'ha' },
    decoy: { label: 'Mean depth (m)', lo: 3, hi: 25, dp: 0 },
    miniRows: ['Nursery frames', 'Diver hours', 'Mooring buoys', 'Water tests'],
    miniCols: ['Units year 1', 'Units year 2'],
  },
  {
    title: 'Wetland nesting count',
    intro: 'A wildlife charity counted nesting pairs across its marshes in two seasons and must decide where to focus wardens.',
    unit: 'nesting pairs',
    place: 'marsh',
    places: ['Reedmere', 'Fallow Fen', 'Heron Flats', 'Saltings', 'Kestrel Pool'],
    area: { label: 'Wetland area', unit: 'km²' },
    decoy: { label: 'Visitor days (thousands)', lo: 5, hi: 60, dp: 0 },
    miniRows: ['Hide upkeep', 'Predator fencing', 'Water control', 'Bird surveys'],
    miniCols: ['Budget year 1 (k€)', 'Budget year 2 (k€)'],
  },
  {
    title: 'River salmon returns',
    intro: 'A rivers board counted returning salmon in each tributary in two seasons to see where habitat work is paying off.',
    unit: 'salmon',
    place: 'tributary',
    places: ['Upper Tarn', 'Millrace', 'Glenbeck', 'Low Ford', 'Stonewater'],
    area: { label: 'Channel surveyed', unit: 'km' },
    decoy: { label: 'Mean water temperature (°C)', lo: 8, hi: 16, dp: 1 },
    miniRows: ['Fish ladders', 'Bank planting', 'Hatchery', 'Monitoring'],
    miniCols: ['Spend year 1 (k€)', 'Spend year 2 (k€)'],
  },
  {
    title: 'Woodland regrowth study',
    intro: 'A forestry team counted saplings in replanted woods in two years to decide where to replant next.',
    unit: 'saplings',
    place: 'wood',
    places: ['Oakhurst', 'Birchgate', 'Pine Hollow', 'Yewdale', 'Larchmont'],
    area: { label: 'Plot area', unit: 'ha' },
    decoy: { label: 'Soil pH', lo: 4, hi: 7, dp: 1 },
    miniRows: ['Planting crews', 'Deer fencing', 'Seed stock', 'Mapping'],
    miniCols: ['Hours year 1', 'Hours year 2'],
  },
]

const int = (lo: number, hi: number, rand: Rand) => lo + Math.floor(rand() * (hi - lo + 1))
const shuffle = <T,>(xs: readonly T[], rand: Rand) => {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}
export const pctChange = (a: number, b: number) => ((b - a) / a) * 100
export const fmt = (n: number, dp = 1) => Number(n.toFixed(dp)).toLocaleString('en-GB', { maximumFractionDigits: dp })

/** Four distinct options for a numeric answer; distractors sit 5–30% away (closer at higher levels), on either side. */
export function numOptions(ans: number, dp: number, level: number, rand: Rand, unit = ''): Blank {
  const f = (x: number) => `${fmt(x, dp)}${unit}`
  const d = Math.max(0.05, 0.3 - level * 0.025)
  const right = f(ans)
  const out = [right]
  for (const k of [...shuffle([-3, -2, -1, 1, 2, 3], rand), 4, -4, 5, -5, 6, -6]) {
    const c = f(ans * (1 + k * d) + k * 10 ** -dp * (Math.sign(ans) || 1))
    if (out.length < 4 && !out.includes(c)) out.push(c)
  }
  const options = shuffle(out, rand)
  return { label: '', options, answer: options.indexOf(right) }
}

/** Tolerance: half a unit in the asked decimal place, or 0.5% of the answer, whichever is larger. */
export const isClose = (ans: number, x: number, dp: number) => Number.isFinite(x) && Math.abs(x - ans) <= Math.max(0.51 * 10 ** -dp, Math.abs(ans) * 0.005)

/** Built-in calculator: digits, + − × ÷, brackets and decimals only; null when it doesn't parse. */
export function evalExpr(s: string): number | null {
  const e = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '')
  if (!/^[\d.+\-*/()\s]+$/.test(e)) return null
  try {
    const v = Function(`"use strict";return (${e})`)() as unknown
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

const CHARTS = ['Bar chart', 'Line chart', 'Pie chart', 'Scatter plot']
const MINI_KINDS = ['share', 'change', 'average', 'range', 'ratio', 'project'] as const

/** One standalone mini-case on fresh data from the theme's operations table. */
export function makeMini(kind: (typeof MINI_KINDS)[number], theme: Theme, level: number, rand: Rand): ChoiceItem {
  const rows = shuffle(theme.miniRows, rand).slice(0, level <= 4 ? 3 : 4)
  const data = rows.map((r) => {
    const a = int(20, 400, rand)
    return { r, a, b: Math.max(5, Math.round(a * (0.7 + rand() * 0.7))) }
  })
  data.forEach((x, i) => {
    if (x.a === x.b) x.b += 3
    while (data.slice(0, i).some((y) => y.b === x.b)) x.b++
  })
  const [c1, c2] = theme.miniCols
  const table = { cols: ['Item', c1, c2], rows: data.map((x) => [x.r, x.a, x.b]) }
  const x = data[0]!
  const sumB = data.reduce((s, y) => s + y.b, 0)
  let prompt: string, ans: number, dp: number, unit: string, explain: string
  if (kind === 'share') {
    ;[ans, dp, unit] = [(x.b / sumB) * 100, 1, '%']
    prompt = `What share of the ${c2} total does ${x.r} account for?`
    explain = `${x.b} / ${sumB} × 100 = ${fmt(ans)}%`
  } else if (kind === 'change') {
    ;[ans, dp, unit] = [pctChange(x.a, x.b), 1, '%']
    prompt = `By what percentage did ${x.r} change from year 1 to year 2?`
    explain = `(${x.b} − ${x.a}) / ${x.a} × 100 = ${fmt(ans)}%`
  } else if (kind === 'average') {
    ;[ans, dp, unit] = [data.reduce((s, y) => s + y.a, 0) / data.length, 1, '']
    prompt = `What is the average of the ${c1} column?`
    explain = `${data.map((y) => y.a).join(' + ')} = ${data.reduce((s, y) => s + y.a, 0)}, / ${data.length} = ${fmt(ans)}`
  } else if (kind === 'range') {
    const bs = data.map((y) => y.b)
    ;[ans, dp, unit] = [Math.max(...bs) - Math.min(...bs), 0, '']
    prompt = `What is the gap between the highest and lowest values in ${c2}?`
    explain = `${Math.max(...bs)} − ${Math.min(...bs)} = ${ans}`
  } else if (kind === 'ratio') {
    const [hi, lo] = [...data].sort((p, q) => q.b - p.b) as [typeof x, typeof x]
    ;[ans, dp, unit] = [hi.b / lo.b, 2, '×']
    prompt = `How many times larger is ${hi.r} than ${lo.r} in ${c2}?`
    explain = `${hi.b} / ${lo.b} = ${fmt(ans, 2)}`
  } else {
    ;[ans, dp, unit] = [x.b * (x.b / x.a), 0, '']
    prompt = `If ${x.r} changes by the same percentage again, what will it be in year 3?`
    explain = `${x.b} × (${x.b} / ${x.a}) = ${fmt(ans, 0)}`
  }
  return { prompt, table, blanks: [{ ...numOptions(ans, dp, level, rand, unit), label: 'Answer' }], explain }
}

/** A full study: 3 regions (levels 1–3) to 5 (8+); the projection runs 1 year ahead at levels 1–3, 2 at 4–7, 3 from 8. */
export function makeStudy(level: number, rand: Rand = Math.random): Study {
  const n = level <= 3 ? 3 : level <= 7 ? 4 : 5
  const horizon = level <= 3 ? 1 : level <= 7 ? 2 : 3
  // ponytail: rejection loop for clear-cut answers (no near-zero changes, a unique top gain); passes within a few tries.
  for (;;) {
    const theme = THEMES[int(0, THEMES.length - 1, rand)]!
    const y0 = int(2016, 2022, rand)
    const years: [number, number] = [y0, y0 + 1]
    const regions = shuffle(theme.places, rand)
      .slice(0, n)
      .map((name) => {
        const y1 = int(300, 3000, rand)
        const { lo, hi, dp } = theme.decoy
        return { name, y1, y2: Math.round(y1 * (0.75 + rand() * 0.6)), area: int(20, 400, rand), decoy: Number((lo + rand() * (hi - lo)).toFixed(dp)) }
      })
    const pcts = regions.map((r) => pctChange(r.y1, r.y2))
    const sorted = [...pcts].sort((a, b) => b - a)
    const tot1 = regions.reduce((s, r) => s + r.y1, 0)
    const tot2 = regions.reduce((s, r) => s + r.y2, 0)
    const total = pctChange(tot1, tot2)
    if (pcts.some((p) => Math.abs(p) < 2) || sorted[0]! <= 0 || sorted[0]! - sorted[1]! < 1 || Math.abs(total) < 1) continue

    const [A, B, C] = shuffle(regions, rand) as [Region, Region, Region]
    const [Y1, Y2] = years
    const { unit, area } = theme
    const q1 = pctChange(A.y1, A.y2)
    const q2 = B.y2 / B.area
    const q3 = C.y2 * (C.y2 / C.y1) ** horizon
    const questions: Question[] = [
      { text: `By what percentage did the ${unit} count in ${A.name} change from ${Y1} to ${Y2}? (one decimal, negative for a fall)`, answer: q1, dp: 1, unit: '%', explain: `(${A.y2} − ${A.y1}) / ${A.y1} × 100 = ${fmt(q1)}%` },
      { text: `How many ${unit} per ${area.unit} did ${B.name} have in ${Y2}? (one decimal)`, answer: q2, dp: 1, unit: ` per ${area.unit}`, explain: `${B.y2} / ${B.area} = ${fmt(q2)}` },
      {
        text: `If ${C.name} keeps changing at its ${Y1}–${Y2} rate each year, how many ${unit} will it have in ${Y2 + horizon}? (whole number)`,
        answer: q3,
        dp: 0,
        unit: '',
        explain: `${C.y2} × (${C.y2} / ${C.y1})${horizon > 1 ? `^${horizon}` : ''} = ${fmt(q3, 0)}`,
      },
    ]
    const purposes = [
      `compare the ${Y2} ${unit} counts across ${theme.place}s`,
      `show the trend in the total count over the survey years`,
      `show each ${theme.place}'s share of the ${Y2} total`,
      `check whether a larger ${area.label.toLowerCase()} goes with more ${unit}`,
    ]
    const chart = int(0, 3, rand)
    const top = regions[pcts.indexOf(sorted[0]!)]!
    const placeOpts = shuffle([top.name, ...shuffle(regions.filter((r) => r !== top).map((r) => r.name), rand).slice(0, 3)], rand)
    const report: ChoiceItem[] = [
      { prompt: `Which chart best helps the reader ${purposes[chart]}?`, blanks: [{ label: 'Chart type', options: CHARTS, answer: chart }], explain: `${CHARTS[chart]}: it suits that comparison.` },
      {
        prompt: 'Complete the summary table with the values from your analysis.',
        blanks: [
          { ...numOptions(q1, 1, level, rand, '%'), label: `${A.name}, change ${Y1}–${Y2}` },
          { ...numOptions(q2, 1, level, rand), label: `${B.name}, ${unit} per ${area.unit} in ${Y2}` },
        ],
        explain: `${A.name} ${fmt(q1)}%, ${B.name} ${fmt(q2)} per ${area.unit}.`,
      },
      {
        prompt: `Complete the conclusion: "___ recorded the largest percentage gain, and the total ${unit} count ___ by about ___."`,
        blanks: [
          { label: `${theme.place[0]!.toUpperCase()}${theme.place.slice(1)}`, options: placeOpts, answer: placeOpts.indexOf(top.name) },
          { label: 'Direction', options: ['rose', 'fell'], answer: total > 0 ? 0 : 1 },
          { ...numOptions(Math.abs(total), 0, level, rand, '%'), label: 'Size' },
        ],
        explain: `${top.name} gained ${fmt(sorted[0]!)}%; the total went from ${tot1} to ${tot2} (${fmt(total, 0)}%).`,
      },
    ]
    const minis = shuffle(MINI_KINDS, rand).map((k) => makeMini(k, theme, level, rand))
    const relevant = [`${A.name}|y1`, `${A.name}|y2`, `${B.name}|y2`, `${B.name}|area`, `${C.name}|y1`, `${C.name}|y2`]
    return { theme, years, horizon, regions, relevant, questions, report, minis }
  }
}

/** Every figure the investigation panels show, keyed `name|field`. */
export function figures(s: Study) {
  const out = new Map<string, { label: string; value: string }>()
  for (const r of s.regions) {
    out.set(`${r.name}|y1`, { label: `${r.name}, ${s.years[0]}`, value: `${r.y1} ${s.theme.unit}` })
    out.set(`${r.name}|y2`, { label: `${r.name}, ${s.years[1]}`, value: `${r.y2} ${s.theme.unit}` })
    out.set(`${r.name}|area`, { label: `${r.name}, ${s.theme.area.label.toLowerCase()}`, value: `${r.area} ${s.theme.area.unit}` })
    out.set(`${r.name}|decoy`, { label: `${r.name}, ${s.theme.decoy.label}`, value: `${r.decoy}` })
  }
  return out
}

/** Recall and precision (0–100) of the journal against the figures the analysis needs. */
export function judgeJournal(relevant: string[], journal: string[]) {
  const hits = journal.filter((id) => relevant.includes(id)).length
  const recall = Math.round((hits / relevant.length) * 100)
  const precision = journal.length ? Math.round((hits / journal.length) * 100) : 0
  return { correct: recall === 100, recall, precision, kind: `journal:${recall}:${precision}` }
}

export const judgeChoice = (item: ChoiceItem, picks: number[]) => item.blanks.every((b, i) => picks[i] === b.answer)

/** journalRecall, journalPrecision (0–1), and accuracy per section. */
export function redrockDetails(trials: Trial[]) {
  const r3 = (n: number) => Math.round(n * 1000) / 1000
  const acc = (k: string) => {
    const xs = trials.filter((t) => t.kind === k)
    return xs.length ? r3(xs.filter((t) => t.correct).length / xs.length) : 0
  }
  const js = trials.flatMap((t) => (t.kind?.startsWith('journal:') ? [t.kind.split(':').map(Number)] : []))
  const mean = (i: number) => (js.length ? r3(js.reduce((s, x) => s + x[i]!, 0) / js.length / 100) : 0)
  return { journalRecall: mean(1), journalPrecision: mean(2), analysisAcc: acc('analysis'), reportAcc: acc('report'), miniCaseAcc: acc('mini') }
}

type Phase = 'investigate' | 'analyse' | 'report' | 'mini'
const PHASES: Record<Phase, string> = { investigate: 'Investigation', analyse: 'Analysis', report: 'Report', mini: 'Mini-cases' }
const COUNT: Record<Phase, number> = { investigate: 1, analyse: 3, report: 3, mini: 6 }
const ORDER: Phase[] = ['investigate', 'analyse', 'report', 'mini']

function Bars({ rows, unit }: { rows: { label: string; value: number }[]; unit: string }) {
  const max = Math.max(...rows.map((r) => r.value))
  const h = 26
  return (
    <svg className="solve-chart" viewBox={`0 0 320 ${rows.length * h + 4}`} role="img" aria-label={rows.map((r) => `${r.label} ${r.value} ${unit}`).join(', ')}>
      {rows.map((r, i) => (
        <g key={r.label} transform={`translate(0 ${i * h + 2})`}>
          <text x="96" y="16" textAnchor="end" className="solve-chart__label">
            {r.label}
          </text>
          <rect x="104" y="4" height="16" width={(r.value / max) * 170} className="solve-chart__bar" />
          <text x={110 + (r.value / max) * 170} y="16" className="solve-chart__label">
            {r.value}
          </text>
        </g>
      ))}
    </svg>
  )
}

function Chip({ id, label, value, on, onToggle }: { id: string; label: string; value: string; on: boolean; onToggle: (id: string) => void }) {
  return (
    <button type="button" className="solve-chip" draggable aria-pressed={on} onDragStart={(e) => e.dataTransfer.setData('text/plain', id)} onClick={() => onToggle(id)} title={label}>
      {value}
    </button>
  )
}

function Calculator({ onUse }: { onUse: (v: number) => void }) {
  const [expr, setExpr] = useState('')
  const result = evalExpr(expr)
  return (
    <section className="solve-panel" aria-label="Calculator">
      <h3 className="solve-panel__head">Calculator</h3>
      <input className="field__input solve-calc" value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="e.g. (1890 - 1620) / 1620 * 100" aria-label="Calculation" />
      <div className="solve-calc__out" aria-live="polite">
        = {result === null ? '–' : fmt(result, 4)}
        <button type="button" className="btn btn--sm" disabled={result === null} onClick={() => result !== null && onUse(result)}>
          Use result
        </button>
      </div>
    </section>
  )
}

function Choice({ item, disabled, onSubmit }: { item: ChoiceItem; disabled: boolean; onSubmit: (picks: number[]) => void }) {
  const [picks, setPicks] = useState<number[]>(() => item.blanks.map(() => -1))
  return (
    <form
      className="solve-panel solve-wide"
      onSubmit={(e) => {
        e.preventDefault()
        if (!disabled && picks.every((p) => p >= 0)) onSubmit(picks)
      }}
    >
      <p className="solve-q">{item.prompt}</p>
      {item.table && (
        <table className="solve-table">
          <thead>
            <tr>
              {item.table.cols.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {item.table.rows.map((r) => (
              <tr key={String(r[0])}>
                {r.map((v, i) => (
                  <td key={i}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="solve-blanks">
        {item.blanks.map((b, i) => (
          <label key={b.label} className="field">
            <span className="field__label">{b.label}</span>
            <select className="field__input" value={picks[i]} disabled={disabled} onChange={(e) => setPicks(picks.map((p, j) => (j === i ? Number(e.target.value) : p)))}>
              <option value={-1}>Choose…</option>
              {b.options.map((o, j) => (
                <option key={o} value={j}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <button type="submit" className="btn btn--ink" disabled={disabled || picks.some((p) => p < 0)}>
        Submit
      </button>
    </form>
  )
}

function RedrockGame({ level, feedback, onTrial, rounds, onDone }: GameProps) {
  const [study, setStudy] = useState(() => makeStudy(level))
  const [phase, setPhase] = useState<Phase>('investigate')
  const [step, setStep] = useState(0)
  const [journal, setJournal] = useState<string[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [fb, setFb] = useState<{ ok: boolean; text: string } | null>(null)
  const [played, setPlayed] = useState(0)
  const shownAt = useRef(0)
  const studyLevel = useRef(level)
  const levelRef = useRef(level)
  useEffect(() => {
    levelRef.current = level
  })
  useEffect(() => {
    studyLevel.current = levelRef.current
  }, [study])
  useEffect(() => {
    shownAt.current = performance.now()
  }, [study, phase, step])

  const figs = figures(study)
  const { theme, years, regions } = study

  function advance() {
    setFb(null)
    setInput('')
    if (step + 1 < COUNT[phase]) return setStep(step + 1)
    setStep(0)
    const nextPhase = ORDER[ORDER.indexOf(phase) + 1]
    if (nextPhase) return setPhase(nextPhase)
    const done = played + 1
    setPlayed(done)
    if (rounds && done >= rounds) return onDone?.()
    setPhase('investigate')
    setJournal([])
    setAnswers([])
    setStudy(makeStudy(levelRef.current))
  }
  function record(correct: boolean, kind: string, text: string) {
    onTrial({ correct, rt: performance.now() - shownAt.current, level: studyLevel.current, kind })
    if (feedback) setFb({ ok: correct, text })
    else advance()
  }
  // Judged figures stay as judged: practice feedback must not let the journal be fixed before the analysis uses it.
  const toggle = (id: string) => phase === 'investigate' && !fb && setJournal((j) => (j.includes(id) ? j.filter((x) => x !== id) : [...j, id]))

  function finishInvestigation() {
    const r = judgeJournal(study.relevant, journal)
    record(r.correct, r.kind, `${r.recall}% of the needed figures collected; ${r.precision}% of your journal was relevant.`)
  }
  function submitAnswer(e: FormEvent) {
    e.preventDefault()
    if (fb || input.trim() === '') return
    const q = study.questions[step]!
    const x = Number(input.replace(/[,\s]/g, ''))
    setAnswers([...answers, `${fmt(x, q.dp)}${q.unit}`])
    record(isClose(q.answer, x, q.dp), 'analysis', q.explain)
  }

  const journalPanel = (
    <section
      className="solve-panel solve-journal"
      aria-label="Research journal"
      onDragOver={(e) => phase === 'investigate' && !fb && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const id = e.dataTransfer.getData('text/plain')
        if (figs.has(id) && !journal.includes(id)) setJournal([...journal, id])
      }}
    >
      <h3 className="solve-panel__head">Research journal</h3>
      {journal.length === 0 && <p className="solve-note">{phase === 'investigate' ? 'Drag figures here, or click them.' : 'Empty.'}</p>}
      <ul className="solve-list">
        {journal.map((id) => (
          <li key={id}>
            <span>{figs.get(id)!.label}</span>
            <strong>{figs.get(id)!.value}</strong>
            {phase === 'investigate' && (
              <button type="button" className="btn btn--quiet btn--sm" aria-label={`Remove ${figs.get(id)!.label}`} onClick={() => toggle(id)}>
                ×
              </button>
            )}
          </li>
        ))}
        {answers.map((a, i) => (
          <li key={`a${i}`}>
            <span>Answer {i + 1}</span>
            <strong>{a}</strong>
          </li>
        ))}
      </ul>
    </section>
  )

  return (
    <div className="game solve">
      <div className="game__prompt">
        {theme.title}
        {rounds ? ` · study ${played + 1} of ${rounds}` : ''} · {PHASES[phase]}
        {COUNT[phase] > 1 ? ` ${step + 1} of ${COUNT[phase]}` : ''}
      </div>

      {phase === 'investigate' && (
        <>
          <section className="solve-panel solve-wide" aria-label="Brief">
            <h3 className="solve-panel__head">Brief</h3>
            <p className="solve-q">{theme.intro} The research lead will ask:</p>
            <ol className="solve-brief">
              {study.questions.map((q) => (
                <li key={q.text}>{q.text.replace(/ \(.*\)$/, '')}</li>
              ))}
            </ol>
            <p className="solve-note">Collect only the figures those questions need: the journal is all you keep for the analysis.</p>
          </section>
          <div className="solve-cols">
            <section className="solve-panel" aria-label="Survey counts">
              <h3 className="solve-panel__head">Survey counts ({theme.unit})</h3>
              <table className="solve-table">
                <thead>
                  <tr>
                    <th>{theme.place}</th>
                    <th>{years[0]}</th>
                    <th>{years[1]}</th>
                  </tr>
                </thead>
                <tbody>
                  {regions.map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      {(['y1', 'y2'] as const).map((f) => (
                        <td key={f}>
                          <Chip id={`${r.name}|${f}`} {...figs.get(`${r.name}|${f}`)!} value={String(r[f])} on={journal.includes(`${r.name}|${f}`)} onToggle={toggle} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="solve-panel" aria-label={theme.area.label}>
              <h3 className="solve-panel__head">
                {theme.area.label} ({theme.area.unit})
              </h3>
              <Bars rows={regions.map((r) => ({ label: r.name, value: r.area }))} unit={theme.area.unit} />
              <div className="solve-chips">
                {regions.map((r) => (
                  <Chip key={r.name} id={`${r.name}|area`} label={figs.get(`${r.name}|area`)!.label} value={`${r.name}: ${r.area}`} on={journal.includes(`${r.name}|area`)} onToggle={toggle} />
                ))}
              </div>
            </section>
            <section className="solve-panel" aria-label={theme.decoy.label}>
              <h3 className="solve-panel__head">{theme.decoy.label}</h3>
              <div className="solve-chips">
                {regions.map((r) => (
                  <Chip key={r.name} id={`${r.name}|decoy`} label={figs.get(`${r.name}|decoy`)!.label} value={`${r.name}: ${r.decoy}`} on={journal.includes(`${r.name}|decoy`)} onToggle={toggle} />
                ))}
              </div>
            </section>
            {journalPanel}
          </div>
          <button type="button" className="btn btn--ink" disabled={!!fb} onClick={finishInvestigation}>
            Finish investigation
          </button>
        </>
      )}

      {phase === 'analyse' && (
        <div className="solve-cols">
          <form className="solve-panel" onSubmit={submitAnswer}>
            <h3 className="solve-panel__head">Question {step + 1}</h3>
            <p className="solve-q">{study.questions[step]!.text}</p>
            <input className="field__input" inputMode="decimal" value={input} disabled={!!fb} onChange={(e) => setInput(e.target.value)} aria-label="Your answer" autoFocus />
            <button type="submit" className="btn btn--ink" disabled={!!fb || input.trim() === '' || !Number.isFinite(Number(input.replace(/[,\s]/g, '')))}>
              Submit
            </button>
          </form>
          <Calculator key={step} onUse={(v) => setInput(String(Number(v.toFixed(4))))} />
          {journalPanel}
        </div>
      )}

      {phase === 'report' && (
        <>
          <Choice key={`r${step}`} item={study.report[step]!} disabled={!!fb} onSubmit={(p) => record(judgeChoice(study.report[step]!, p), 'report', study.report[step]!.explain)} />
          {journalPanel}
        </>
      )}

      {phase === 'mini' && <Choice key={`m${step}`} item={study.minis[step]!} disabled={!!fb} onSubmit={(p) => record(judgeChoice(study.minis[step]!, p), 'mini', study.minis[step]!.explain)} />}

      <div className={`game__feedback ${fb ? (fb.ok ? 'game__feedback--ok' : 'game__feedback--bad') : ''}`} aria-live="polite">
        {fb && `${fb.ok ? 'Correct' : 'Not quite'}: ${fb.text}`}
      </div>
      {fb && (
        <button type="button" className="btn" autoFocus onClick={advance}>
          Next
        </button>
      )}
      <div className="game__keys">Tab to move · Enter to submit or continue</div>
    </div>
  )
}

export const redrock: GameDef = {
  id: 'redrock',
  name: 'Redrock',
  skills: ['numerical-accuracy'],
  howTo: 'Collect the figures a brief needs into your journal, calculate the answers, complete a short report, then solve six quick mini-cases.',
  duration: 2100,
  targetRt: 60000,
  Component: RedrockGame satisfies ComponentType<GameProps>,
  details: redrockDetails,
}
