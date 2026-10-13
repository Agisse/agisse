import type { ComponentType } from 'react'
import type { GameDef, GameProps } from '../engine/types'
import { shuffle } from './SequenceReasoning'
import { AptLayout, Choices, Explain, useItemLoop } from './Aptitude'

// Numerical reasoning on a generated table or chart (SHL Verify / Capp / Sova / Saville style). Every figure is generated, so the
// answer is exact and the distractors are the results of named common mistakes (wrong base, stopping half-way, inverted rate).

type Rand = () => number
export type NumData =
  | { kind: 'table'; caption: string; head: string[]; rows: string[][]; note?: string }
  | { kind: 'bars'; caption: string; bars: { label: string; value: number }[]; note: string }
export type NumItem = { data: NumData; question: string; options: string[]; answer: number; explain: string[]; kind: string }

const int = (lo: number, hi: number, rand: Rand) => lo + Math.floor(rand() * (hi - lo + 1))
const pick = <T,>(xs: readonly T[], rand: Rand) => xs[Math.floor(rand() * xs.length)]!
export const fmt = (x: number, dp: number) => x.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })

/** Five distinct options: the answer, the mistakes in order, then near misses (±6%, ±12% …) to fill. */
export function optionsOf(ans: number, wrongs: number[], dp: number, unit: (s: string) => string, rand: Rand) {
  const right = unit(fmt(ans, dp))
  const seen = new Set([right])
  const out: string[] = []
  const add = (x: number) => {
    if (!Number.isFinite(x) || x < 0 || out.length >= 4) return
    const s = unit(fmt(x, dp))
    if (!seen.has(s)) {
      seen.add(s)
      out.push(s)
    }
  }
  wrongs.forEach(add)
  for (let k = 1; out.length < 4; k++) add(ans * (1 + (k % 2 ? 1 : -1) * 0.06 * Math.ceil(k / 2)) + (ans === 0 ? k : 0))
  const options = shuffle([right, ...out], rand)
  return { options, answer: options.indexOf(right) }
}

const COMPANIES = ['Norvik Foods', 'Aldenta Logistics', 'Brevo Energy', 'Castellan Retail', 'Duna Pharma', 'Elbrand Media', 'Ferrovia Parts']
const YEARS = [2023, 2024, 2025]

function revenue(level: number, rand: Rand): NumItem {
  const names = shuffle(COMPANIES, rand).slice(0, 4)
  const v = names.map(() => {
    const row = [int(120, 900, rand)]
    for (let y = 1; y < 3; y++) {
      // Never flat: a 0% change makes "by what percentage did it increase" a trick question.
      let g = 0
      while (!g) g = int(-12, 30, rand)
      row.push(Math.round(row[y - 1]! * (1 + g / 100)))
    }
    return row
  })
  const data: NumData = { kind: 'table', caption: 'Annual revenue (€ million)', head: ['Company', ...YEARS.map(String)], rows: names.map((n, i) => [n, ...v[i]!.map((x) => fmt(x, 0))]) }
  const c = int(0, 3, rand)
  const kinds = ['change', ...(level >= 3 ? ['share'] : []), ...(level >= 6 ? ['project'] : [])]
  const kind = pick(kinds.slice(-2), rand)
  const pct = (s: string) => `${s}%`
  const em = (s: string) => `€${s}m`
  const [x0, x1, x2] = v[c]!
  if (kind === 'share') {
    const y = int(0, 2, rand)
    const total = v.reduce((s, r) => s + r[y]!, 0)
    const x = v[c]![y]!
    const other = (y + 1) % 3
    const ans = (x / total) * 100
    return {
      data,
      kind,
      question: `What share of the four companies' combined ${YEARS[y]} revenue did ${names[c]} earn?`,
      ...optionsOf(ans, [(x / (total - x)) * 100, (x / v.reduce((s, r) => s + r[other]!, 0)) * 100, (v[c]![other]! / v.reduce((s, r) => s + r[other]!, 0)) * 100], 1, pct, rand),
      explain: [`Combined ${YEARS[y]} revenue: ${v.map((r) => fmt(r[y]!, 0)).join(' + ')} = €${fmt(total, 0)}m.`, `${names[c]}: ${fmt(x, 0)} ÷ ${fmt(total, 0)} × 100 = ${fmt(ans, 1)}%.`, 'Common slip: dividing by the other companies only, not the total.'],
    }
  }
  if (kind === 'project') {
    const ans = (x2 * x2) / x1
    const g = (x2 / x1 - 1) * 100
    return {
      data,
      kind,
      question: `If ${names[c]}'s revenue changes from 2025 to 2026 by the same percentage as from 2024 to 2025, what will its 2026 revenue be?`,
      ...optionsOf(ans, [x2 + (x2 - x1), x2 * (x2 / x0), x2 * (1 + (x2 - x1) / x2)], 1, em, rand),
      explain: [`2024 → 2025: ${fmt(x2, 0)} ÷ ${fmt(x1, 0)} = ${fmt(x2 / x1, 4)} (${g >= 0 ? '+' : ''}${fmt(g, 2)}%).`, `2026: ${fmt(x2, 0)} × ${fmt(x2 / x1, 4)} = €${fmt(ans, 1)}m.`, 'Common slips: adding the same euro amount again, or using 2023 as the base.'],
    }
  }
  const [i, j] = level <= 3 ? (rand() < 0.5 ? [0, 1] : [1, 2]) : pick([[0, 1], [1, 2], [0, 2]] as const, rand)
  const a = v[c]![i]!
  const b = v[c]![j]!
  const ans = ((b - a) / a) * 100
  const dir = b >= a ? 'increase' : 'decrease'
  return {
    data,
    kind,
    question: `By what percentage did ${names[c]}'s revenue ${dir} between ${YEARS[i]} and ${YEARS[j]}?`,
    ...optionsOf(Math.abs(ans), [Math.abs(((b - a) / b) * 100), (b / a) * 100, Math.abs(((v[(c + 1) % 4]![j]! - v[(c + 1) % 4]![i]!) / v[(c + 1) % 4]![i]!) * 100)], 1, pct, rand),
    explain: [`Change: ${fmt(b, 0)} − ${fmt(a, 0)} = ${fmt(b - a, 0)}.`, `Divide by the earlier year: ${fmt(Math.abs(b - a), 0)} ÷ ${fmt(a, 0)} × 100 = ${fmt(Math.abs(ans), 1)}%.`, 'Common slip: dividing by the later year.'],
  }
}

const RATES: [string, number, number][] = [
  ['USD', 1.04, 1.16],
  ['GBP', 0.82, 0.88],
  ['CHF', 0.92, 1.0],
  ['SEK', 10.9, 11.8],
  ['PLN', 4.18, 4.42],
  ['NOK', 11.2, 11.9],
]

function exchange(level: number, rand: Rand): NumItem {
  const cur = shuffle(RATES, rand).slice(0, 4).map(([code, lo, hi]) => ({ code, r: Math.round((lo + rand() * (hi - lo)) * (hi > 5 ? 100 : 1000)) / (hi > 5 ? 100 : 1000) }))
  const data: NumData = { kind: 'table', caption: 'Exchange rates: units of each currency per €1', head: ['Currency', 'Per €1'], rows: cur.map((c) => [c.code, String(c.r)]) }
  const [A, B, C] = cur
  const unit = (code: string) => (s: string) => `${s} ${code}`
  if (level <= 3) {
    const x = int(2, 100, rand) * 50
    const ans = x * A!.r
    return {
      data,
      kind: 'fx-simple',
      question: `A client pays an invoice of €${fmt(x, 0)} in ${A!.code}. How much ${A!.code} is that?`,
      ...optionsOf(ans, [x / A!.r, x * B!.r, x * C!.r], 2, unit(A!.code), rand),
      explain: [`Rates are per €1, so multiply: ${fmt(x, 0)} × ${A!.r} = ${fmt(ans, 2)} ${A!.code}.`, 'Common slip: dividing by the rate.'],
    }
  }
  const x = int(10, 500, rand) * 100
  const fee = level >= 7 ? int(2, 6, rand) / 2 : 0
  const eur = x / A!.r
  const ans = eur * (1 + fee / 100) * B!.r
  const steps = [`To euros: ${fmt(x, 0)} ÷ ${A!.r} = €${fmt(eur, 2)}.`]
  if (fee) steps.push(`Add the ${fee}% fee: €${fmt(eur, 2)} × ${fmt(1 + fee / 100, 3)} = €${fmt(eur * (1 + fee / 100), 2)}.`)
  steps.push(`To ${B!.code}: × ${B!.r} = ${fmt(ans, 2)} ${B!.code}.`, `Common slips: ${fee ? 'forgetting the fee or subtracting it, ' : ''}multiplying by the first rate instead of dividing.`)
  return {
    data,
    kind: fee ? 'fx-fee' : 'fx-cross',
    question: `A supplier's invoice of ${fmt(x, 0)} ${A!.code} is paid from a ${B!.code} account${fee ? `, and the bank charges a ${fee}% fee on top of the euro amount` : ''}. How much ${B!.code} is paid?`,
    ...optionsOf(ans, [eur * B!.r, ((x * A!.r) / B!.r) * (1 + fee / 100), eur * (1 - fee / 100) * B!.r, eur * (1 + fee / 100), x * (A!.r / B!.r)], 2, unit(B!.code), rand),
    explain: steps,
  }
}

const SURVEYS: [string, string[]][] = [
  ['Main way staff commute', ['Car', 'Train', 'Bus or tram', 'Bicycle', 'On foot']],
  ['Most valued employee benefit', ['Flexible hours', 'Remote days', 'Training budget', 'Pension top-up', 'Gym pass']],
  ['Preferred payment at checkout', ['Debit card', 'Credit card', 'Mobile wallet', 'Cash', 'Buy now, pay later']],
  ['Reason graduates chose their employer', ['Salary', 'Training', 'Location', 'Reputation', 'Culture']],
]

function survey(level: number, rand: Rand): NumItem {
  const [caption, labels] = pick(SURVEYS, rand)
  // Five shares, each at least 6%, summing to 100.
  const cuts = shuffle(Array.from({ length: 69 }, (_, i) => i + 1), rand).slice(0, 4).sort((a, b) => a - b)
  const shares = [0, ...cuts, 70].slice(1).map((c, i, xs) => c - (i ? xs[i - 1]! : 0) + 6)
  const n = int(6, 24, rand) * 100
  const data: NumData = { kind: 'bars', caption: `${caption} (% of respondents)`, bars: labels.map((label, i) => ({ label, value: shares[i]! })), note: `Survey of ${fmt(n, 0)} people; each chose one answer.` }
  const [i, k] = shuffle([0, 1, 2, 3, 4], rand)
  // Two different shares, so "how many more chose H than L" never has the answer 0.
  const j = shares[k] !== shares[i] ? k! : [0, 1, 2, 3, 4].find((x) => shares[x] !== shares[i])!
  const [p, q] = [shares[i!]!, shares[j]!]
  const kinds = ['count', ...(level >= 3 ? ['diff'] : []), ...(level >= 5 ? ['part'] : []), ...(level >= 7 ? ['project'] : [])]
  const kind = pick(kinds.slice(-2), rand)
  const people = (s: string) => `${s} people`
  if (kind === 'diff') {
    const hi = Math.max(p, q)
    const lo = Math.min(p, q)
    const [H, L] = p >= q ? [labels[i]!, labels[j]!] : [labels[j]!, labels[i]!]
    const ans = (n * (hi - lo)) / 100
    return {
      data,
      kind,
      question: `How many more respondents chose “${H}” than “${L}”?`,
      ...optionsOf(ans, [hi - lo, (n * hi) / 100, (n * (hi + lo)) / 100, (n * (hi - lo + 1)) / 100], 0, people, rand),
      explain: [`${hi}% − ${lo}% = ${hi - lo} percentage points.`, `${hi - lo}% of ${fmt(n, 0)} = ${fmt(ans, 0)} people.`],
    }
  }
  if (kind === 'part') {
    const ans = (p / (p + q)) * 100
    return {
      data,
      kind,
      question: `Of the respondents who chose either “${labels[i]}” or “${labels[j]}”, what percentage chose “${labels[i]}”?`,
      ...optionsOf(ans, [p, (q / (p + q)) * 100, (p / (100 - q)) * 100], 1, (s) => `${s}%`, rand),
      explain: [`Only those two groups count: ${p}% + ${q}% = ${p + q}%.`, `${p} ÷ ${p + q} × 100 = ${fmt(ans, 1)}%. The survey size cancels out.`],
    }
  }
  if (kind === 'project' && p > 6) {
    const k = int(2, Math.min(5, p - 3), rand)
    const grow = pick([10, 15, 20, 25], rand)
    const ans = (n * (1 + grow / 100) * (p - k)) / 100
    return {
      data,
      kind,
      question: `Next year ${grow}% more people take part and the share choosing “${labels[i]}” falls by ${k} percentage points. How many choose it? Round to the nearest person.`,
      ...optionsOf(ans, [(n * (p - k)) / 100, (n * (1 + grow / 100) * p) / 100, (n * (1 + grow / 100) * p * (1 - k / 100)) / 100], 0, people, rand),
      explain: [`Respondents: ${fmt(n, 0)} × ${fmt(1 + grow / 100, 2)} = ${fmt(n * (1 + grow / 100), 0)}.`, `Share: ${p}% − ${k} points = ${p - k}%.`, `${fmt(n * (1 + grow / 100), 0)} × ${p - k}% = ${fmt(ans, 0)} people.`, 'Common slip: reading “points” as a percent of the share.'],
    }
  }
  const ans = (n * p) / 100
  return {
    data,
    kind: 'count',
    question: `How many respondents chose “${labels[i]}”?`,
    ...optionsOf(ans, [(n * q) / 100, (n * (100 - p)) / 100, p * 10], 0, people, rand),
    explain: [`${p}% of ${fmt(n, 0)} = ${fmt(n, 0)} × ${p} ÷ 100 = ${fmt(ans, 0)} people.`],
  }
}

export function makeNumericalItem(level: number, rand: Rand = Math.random): NumItem {
  return pick([revenue, exchange, survey], rand)(level, rand)
}

export function DataView({ data }: { data: NumData }) {
  if (data.kind === 'table')
    return (
      <>
        <div className="apt__caption">{data.caption}</div>
        <table className="apt__table">
          <thead>
            <tr>
              {data.head.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r[0]}>
                {r.map((c, i) => (i ? <td key={i}>{c}</td> : <th key={i} scope="row">{c}</th>))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.note && <p className="apt__note">{data.note}</p>}
      </>
    )
  const max = Math.max(...data.bars.map((b) => b.value))
  const W = 360
  const H = data.bars.length * 30
  return (
    <>
      <div className="apt__caption">{data.caption}</div>
      <svg className="apt__chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={data.bars.map((b) => `${b.label} ${b.value}%`).join(', ')}>
        {data.bars.map((b, i) => (
          <g key={b.label} transform={`translate(0 ${i * 30})`}>
            <text x={0} y={19}>
              {b.label}
            </text>
            <rect x={130} y={6} width={((W - 175) * b.value) / max} height={18} />
            <text x={136 + ((W - 175) * b.value) / max} y={19}>
              {b.value}%
            </text>
          </g>
        ))}
      </svg>
      <p className="apt__note">{data.note}</p>
    </>
  )
}

function NumericalDataGame(props: GameProps) {
  const { item, result, submit, next, seq } = useItemLoop(makeNumericalItem, props)
  return (
    <AptLayout stimulus={<DataView data={item.data} />} question={item.question}>
      <Choices key={seq} options={item.options} answer={item.answer} result={result} onPick={(_, ok) => submit(ok, item.kind)} />
      {result !== null && <Explain ok={result} text={item.explain.map((l) => <p key={l}>{l}</p>)} onNext={next} />}
    </AptLayout>
  )
}

export const numericalData: GameDef = {
  id: 'numerical-data',
  name: 'Numerical reasoning',
  skills: ['numerical-accuracy'],
  howTo: 'Read the table or chart and pick the right answer from five. A calculator is allowed, as in the real tests.',
  duration: 600,
  targetRt: 60000,
  Component: NumericalDataGame satisfies ComponentType<GameProps>,
}
