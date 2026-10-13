// Run: npx tsx src/lib/week.check.ts
import { weekCounts, weekStart } from './week.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString()

// Wednesday 14 Oct 2026; its ISO week runs Mon 12 to Sun 18.
const now = new Date(2026, 9, 14, 9)
eq(weekStart(now).getDate(), 12, 'Wednesday → Monday')
eq(weekStart(new Date(2026, 9, 18, 23)).getDate(), 12, 'Sunday stays in the week that began Monday')
eq(weekStart(new Date(2026, 9, 12, 0)).getDate(), 12, 'Monday midnight is its own start')

const jobs = [
  { appliedAt: at(2026, 10, 12, 0), history: [] }, // Monday: in
  { appliedAt: at(2026, 10, 18, 23), history: [{ status: 'interview' as const, at: at(2026, 10, 15) }] }, // Sunday: in, interview in
  { appliedAt: at(2026, 10, 11, 23), history: [{ status: 'interview' as const, at: at(2026, 10, 9) }] }, // last Sunday: out
  { appliedAt: null, history: [{ status: 'applied' as const, at: at(2026, 10, 13) }, { status: 'interview' as const, at: at(2026, 10, 13) }, { status: 'interview' as const, at: at(2026, 10, 14) }] }, // one job, counted once
  { appliedAt: at(2026, 10, 19, 0), history: [] }, // next Monday: out
]
eq(weekCounts(jobs, now), { applied: 2, interviews: 2 }, 'counts')
eq(weekCounts([], now), { applied: 0, interviews: 0 }, 'empty')

console.log('week ok')
