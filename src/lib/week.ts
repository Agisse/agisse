import type { JobSummary } from '../../shared/types'

/** Monday 00:00 local time of the ISO week that holds `now`. */
export function weekStart(now: Date) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

/** This ISO week: applications sent (by appliedAt) and postings that moved to Interview (by their history). */
export function weekCounts(jobs: Pick<JobSummary, 'appliedAt' | 'history'>[], now = new Date()) {
  const from = weekStart(now).getTime()
  const to = from + 7 * 86_400_000
  const inWeek = (iso: string | null | undefined) => {
    const t = iso ? Date.parse(iso) : NaN
    return t >= from && t < to
  }
  return {
    applied: jobs.filter((j) => inWeek(j.appliedAt)).length,
    interviews: jobs.filter((j) => (j.history ?? []).some((h) => h.status === 'interview' && inWeek(h.at))).length,
  }
}
