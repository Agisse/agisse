// "Which test?": the one tap a seeker gives when a job moves to assessment, and how the answers show on the prep tab.
// Stored as assessment_report rows of kind 'test reported': detail is a publisher id, or null for "Not sure" or dismissed.
import { PUBLISHERS, providerName } from './assessment-catalog'

export type TestReportRow = { userId: string; detail: string | null; createdAt: Date | string; /** profile.shareOutcomes; null = never set (on). */ share: boolean | null }
export type TestCount = { provider: string; students: number }

const YEAR_MS = 365 * 86_400_000
const counted = (rows: TestReportRow[], asOf: Date) =>
  rows.filter((r) => r.detail && r.share !== false && +new Date(r.createdAt) <= +asOf && +asOf - +new Date(r.createdAt) <= YEAR_MS)

/** Students per publisher over the last 12 months, most first. A student counts once per publisher; opted-out seekers not at all. */
export function testCounts(rows: TestReportRow[], asOf = new Date()): TestCount[] {
  const by = new Map<string, Set<string>>()
  for (const r of counted(rows, asOf)) by.set(r.detail!, (by.get(r.detail!) ?? new Set()).add(r.userId))
  return [...by].map(([provider, users]) => ({ provider, students: users.size })).sort((a, b) => b.students - a.students || a.provider.localeCompare(b.provider))
}

/** A count, never a name: "SHL · reported by 3 students this year", or "1 student reported SHL". */
export const testCountLine = ({ provider, students }: TestCount) => (students > 1 ? `${providerName(provider)} · reported by ${students} students this year` : `1 student reported ${providerName(provider)}`)

/** Students who reported a different publisher than the sourced intel since it was checked. The intel itself is never changed. */
export function contradictions(rows: TestReportRow[], intelProvider: string | null, sourceDate: string, asOf = new Date()): number {
  if (!intelProvider || !PUBLISHERS.includes(intelProvider)) return 0
  return new Set(counted(rows, asOf).filter((r) => r.detail !== intelProvider && +new Date(r.createdAt) > +new Date(sourceDate)).map((r) => r.userId)).size
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
