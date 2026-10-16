// The quality report: how generated outputs fare, per task, prompt version and model, and whether scores predict outcomes.
// Built by worker/lib/quality.ts; shown on /admin and printed by `npm run quality` for the weekly improvement agent (IMPROVE.md).
import type { StatusChange } from './types'

export type PromptRow = {
  task: string
  prompt: string
  model: string
  n: number
  /** Share of calls where an earlier model in the chain failed first. */
  failover: number
  /** Share the code verifiers had to correct, and the summed counts per flag. */
  flagged: number
  flags: Record<string, number>
  up: number
  down: number
  /** Outreach and cover letter only: share the seeker edited, and (outreach) share sent. */
  edited: number | null
  contacted: number | null
}

export type Bucket = { bucket: string; n: number; hits: number; rate: number | null }

export type QualityReport = {
  since: string
  prompts: PromptRow[]
  /** Evaluation score → reached responded/assessment/interview/offer, among applications with an outcome or 30+ days of silence, from seekers who count their tracker. */
  scoreCalibration: Bucket[]
  /** Person rank → replied/call booked/referred, among people contacted over a week ago. */
  rankCalibration: Bucket[]
  /** Latest thumbs-down notes, truncated; the seekers' own words about what was off. */
  complaints: { task: string; prompt: string | null; model: string | null; note: string; at: string }[]
}

/** Below this many samples a rate is noise; the report says so instead of showing it. */
export const MIN_N = 30

export const SCORE_BUCKETS = [
  { bucket: '< 3.0', test: (s: number) => s < 3 },
  { bucket: '3.0–3.9', test: (s: number) => s >= 3 && s < 4 },
  { bucket: '4.0–4.4', test: (s: number) => s >= 4 && s < 4.5 },
  { bucket: '≥ 4.5', test: (s: number) => s >= 4.5 },
]

export const RANK_BUCKETS = [
  { bucket: '1–3', test: (r: number) => r <= 3 },
  { bucket: '4–10', test: (r: number) => r > 3 && r <= 10 },
  { bucket: '11+', test: (r: number) => r > 10 },
]

const HITS = new Set(['responded', 'assessment', 'interview', 'offer'])
const SILENT_DAYS = 30

/** Did an application progress? true if it ever reached responded or further, false if rejected before that or silent 30+ days after applying, null while pending.
 * Empty history (postings from before it was kept) is null: its path is unknown. */
export function progressed(history: StatusChange[], appliedAt: Date | string | null, now: Date): boolean | null {
  if (!history.length) return null
  if (history.some((h) => HITS.has(h.status))) return true
  if (history.some((h) => h.status === 'rejected')) return false
  if (appliedAt && now.getTime() - new Date(appliedAt).getTime() >= SILENT_DAYS * 86_400_000) return false
  return null
}

/** Score calibration rows: seekers who turned off "Count my tracker anonymously" (shareOutcomes false) are left out, and so are pending applications. */
export function scoreRows(jobs: { score: number; history: StatusChange[]; appliedAt: Date | string | null; share: boolean | null }[], now: Date) {
  return jobs.flatMap((j) => {
    const hit = j.share === false ? null : progressed(j.history, j.appliedAt, now)
    return hit === null ? [] : [{ value: j.score, hit }]
  })
}

/** Hit rate per bucket; rate is null below MIN_N. */
export function calibrate(rows: { value: number; hit: boolean }[], buckets: { bucket: string; test: (v: number) => boolean }[]): Bucket[] {
  return buckets.map(({ bucket, test }) => {
    const inside = rows.filter((r) => test(r.value))
    const hits = inside.filter((r) => r.hit).length
    return { bucket, n: inside.length, hits, rate: inside.length >= MIN_N ? hits / inside.length : null }
  })
}

const pct = (x: number | null) => (x === null ? '–' : `${Math.round(x * 100)}%`)

/** Markdown for the terminal and for the improvement agent's PR bodies. */
export function reportMarkdown(r: QualityReport) {
  const out = [`# Agisse quality since ${r.since.slice(0, 10)}`, '', '## Per task, prompt version and model', '']
  out.push('| task | prompt | model | n | failover | flagged | 👍 | 👎 | edited | sent | top flags |', '|---|---|---|---|---|---|---|---|---|---|---|')
  for (const p of r.prompts) {
    const top = Object.entries(p.flags).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ')
    out.push(`| ${p.task.replace(/^agisse_/, '')} | ${p.prompt} | ${p.model} | ${p.n} | ${pct(p.failover)} | ${pct(p.flagged)} | ${p.up} | ${p.down} | ${pct(p.edited)} | ${pct(p.contacted)} | ${top} |`)
  }
  for (const [title, rows] of [['Evaluation score → progressed (responded or further)', r.scoreCalibration], ['Person rank → replied', r.rankCalibration]] as const) {
    out.push('', `## ${title}`, '', '| bucket | n | hits | rate |', '|---|---|---|---|')
    for (const b of rows) out.push(`| ${b.bucket} | ${b.n} | ${b.hits} | ${b.rate === null ? `n < ${MIN_N}` : pct(b.rate)} |`)
  }
  out.push('', '## Latest thumbs-down notes', '')
  for (const c of r.complaints) out.push(`- ${c.at.slice(0, 10)} ${c.task.replace(/^agisse_/, '')} (${c.prompt ?? '?'}, ${c.model ?? '?'}): ${c.note}`)
  if (!r.complaints.length) out.push('None yet.')
  return out.join('\n')
}
