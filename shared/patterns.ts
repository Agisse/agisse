// What the seeker's own applications say: reply and interview rates by score band and by where they applied,
// and how long replies take. Pure, over the tracker's status history; no model call. From career-ops `patterns`.
import type { JobStatus, StatusChange } from './types'

export type PatternJob = { url: string | null; score: number | null; status: JobStatus; appliedAt: string | null; history: StatusChange[] }
export type Rate = { key: string; applied: number; replied: number; interviews: number; offers: number }
export type Patterns = { applied: number; byScore: Rate[]; bySource: Rate[]; medianReplyDays: number | null; lowScoreGap: string | null }

const REPLY: JobStatus[] = ['responded', 'assessment', 'interview', 'offer', 'rejected']
const INTERVIEW: JobStatus[] = ['interview', 'offer']

export const MIN_APPLIED = 5

const BANDS: Array<[string, (s: number | null) => boolean]> = [
  ['4.5 and up', (s) => s != null && s >= 4.5],
  ['4.0–4.4', (s) => s != null && s >= 4 && s < 4.5],
  ['Below 4.0', (s) => s != null && s < 4],
  ['Not evaluated', (s) => s == null],
]

// ponytail: a handful of known hosts; everything else is "Company site".
const SOURCES: Array<[string, RegExp]> = [
  ['LinkedIn', /linkedin\./], ['Indeed', /indeed\./], ['Greenhouse', /greenhouse\.io/], ['Lever', /lever\.co/], ['Ashby', /ashbyhq\.com/],
  ['Workday', /myworkdayjobs\.com|workday\.com/], ['Personio', /personio\./], ['Recruitee', /recruitee\.com/], ['Workable', /workable\.com/],
  ['SmartRecruiters', /smartrecruiters\.com/], ['StepStone', /stepstone\./],
]
export function sourceOf(url: string | null) {
  if (!url) return 'Pasted'
  try {
    const host = new URL(url).hostname
    return SOURCES.find(([, re]) => re.test(host))?.[0] ?? 'Company site'
  } catch {
    return 'Pasted'
  }
}

/** When the seeker applied (the first 'applied' in the history, else appliedAt), or null if never. */
function appliedAt(j: PatternJob) {
  const at = j.history.find((h) => h.status === 'applied')?.at ?? j.appliedAt
  return at ? Date.parse(at) : null
}

function rate(key: string, jobs: PatternJob[]): Rate {
  const reached = (j: PatternJob, set: JobStatus[]) => set.includes(j.status) || j.history.some((h) => set.includes(h.status))
  return {
    key,
    applied: jobs.length,
    replied: jobs.filter((j) => reached(j, REPLY)).length,
    interviews: jobs.filter((j) => reached(j, INTERVIEW)).length,
    offers: jobs.filter((j) => reached(j, ['offer'])).length,
  }
}

export const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0)

export function patterns(all: PatternJob[]): Patterns {
  const applied = all.filter((j) => appliedAt(j) != null)
  const byScore = BANDS.map(([k, test]) => rate(k, applied.filter((j) => test(j.score)))).filter((r) => r.applied)
  const sources = [...new Set(applied.map((j) => sourceOf(j.url)))]
  const bySource = sources.map((k) => rate(k, applied.filter((j) => sourceOf(j.url) === k))).sort((a, b) => b.applied - a.applied)

  const days = applied
    .map((j) => {
      const from = appliedAt(j)!
      const reply = j.history.find((h) => REPLY.includes(h.status) && Date.parse(h.at) >= from)
      return reply ? (Date.parse(reply.at) - from) / 86_400_000 : null
    })
    .filter((d): d is number => d != null)
    .sort((a, b) => a - b)
  const medianReplyDays = days.length ? Math.round(days[Math.floor((days.length - 1) / 2)]) : null

  // Does the "below 4.0, don't apply" line hold for this seeker? Only said with at least 3 on each side.
  const low = rate('low', applied.filter((j) => j.score != null && j.score < 4))
  const high = rate('high', applied.filter((j) => j.score != null && j.score >= 4))
  let lowScoreGap: string | null = null
  if (low.applied >= 3 && high.applied >= 3) {
    const [l, h] = [pct(low.replied, low.applied), pct(high.replied, high.applied)]
    lowScoreGap =
      h > l
        ? `Postings scored 4.0 or more got a reply ${h}% of the time, against ${l}% below 4.0. The score is worth following.`
        : `Postings scored below 4.0 got replies as often as higher ones (${l}% against ${h}%). Your applications land better than the score expects.`
  }
  return { applied: applied.length, byScore, bySource, medianReplyDays, lowScoreGap }
}
