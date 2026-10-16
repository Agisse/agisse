// "Which test?": the one tap a seeker gives when a job moves to assessment, and how the answers show on the prep tab.
// Stored as assessment_report rows of kind 'test reported': detail is a publisher id, or null for "Not sure" or dismissed.
import { PUBLISHERS, providerName } from './assessment-catalog'

export type TestReportRow = { userId: string; detail: string | null; createdAt: Date | string; /** profile.shareOutcomes; null = never set (on). */ share: boolean | null }
export type TestCount = { provider: string; students: number }

const YEAR_MS = 365 * 86_400_000
/** A publisher shows only once this many students reported it (owner decision on #253): one report alone never shows. */
export const MIN_STUDENTS = 2
const counted = (rows: TestReportRow[], asOf: Date) =>
  rows.filter((r) => r.detail && r.share !== false && +new Date(r.createdAt) <= +asOf && +asOf - +new Date(r.createdAt) <= YEAR_MS)

const perPublisher = (rows: TestReportRow[]) => {
  const by = new Map<string, Set<string>>()
  for (const r of rows) by.set(r.detail!, (by.get(r.detail!) ?? new Set()).add(r.userId))
  return [...by].map(([provider, users]) => ({ provider, students: users.size })).filter((c) => c.students >= MIN_STUDENTS)
}

/** Students per publisher over the last 12 months, most first, from MIN_STUDENTS up. A student counts once per publisher; opted-out seekers not at all. */
export const testCounts = (rows: TestReportRow[], asOf = new Date()): TestCount[] =>
  perPublisher(counted(rows, asOf)).sort((a, b) => b.students - a.students || a.provider.localeCompare(b.provider))

/** A count, never a name: "SHL · reported by 3 students this year". */
export const testCountLine = ({ provider, students }: TestCount) => `${providerName(provider)} · reported by ${students} students this year`

/** Students who reported a different publisher than the sourced intel since it was checked, counting only publishers with MIN_STUDENTS. The intel itself is never changed. */
export function contradictions(rows: TestReportRow[], intelProvider: string | null, sourceDate: string, asOf = new Date()): number {
  if (!intelProvider || !PUBLISHERS.includes(intelProvider)) return 0
  const other = counted(rows, asOf).filter((r) => r.detail !== intelProvider && +new Date(r.createdAt) > +new Date(sourceDate))
  const shown = new Set(perPublisher(other).map((c) => c.provider))
  return new Set(other.filter((r) => shown.has(r.detail!)).map((r) => r.userId)).size
}

/** Ask once: the job is at assessment and this job has no answer or dismissal yet. */
export const askWhichTest = (status: string, answeredForJob: boolean) => status === 'assessment' && !answeredForJob

/** Why a test report is refused, or null: only on your own job, once per job, and only a listed publisher or null. */
export function testReportError(job: { userId: string } | null, userId: string, answeredForJob: boolean, detail: string | null): string | null {
  if (!job || job.userId !== userId) return 'Posting not found'
  if (answeredForJob) return 'Already answered for this job'
  if (detail !== null && !PUBLISHERS.includes(detail)) return 'Unknown test publisher'
  return null
}
