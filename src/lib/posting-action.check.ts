// Run: npx tsx src/lib/posting-action.check.ts
import { JOB_STATUSES } from '../../shared/types.ts'
import { primaryAction } from './posting-action.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}
const path = (s: (typeof JOB_STATUSES)[number], ev = true) => {
  const a = primaryAction(s, ev)
  return a && typeof a === 'object' ? a.path : a
}

eq(path('saved', false), 'check', 'unscored saved posting: check fit first')
eq(path('saved'), 'apply', 'scored: prepare the application')
eq(path('evaluated'), 'apply', 'evaluated')
eq(path('applied'), 'prepare', 'applied')
eq(path('assessment'), 'prepare#online-test', 'test')
eq(path('assessment', false), 'prepare#online-test', 'Prepare works without a score, so status wins over Check fit')
eq(path('interview'), 'prepare', 'interview')
eq(path('offer'), 'offer', 'offer')
eq(path('offer', false), 'check', 'the offer tab needs a score')
eq([path('rejected'), path('discarded')], [null, null], 'closed: nothing to push')
for (const s of JOB_STATUSES) primaryAction(s, true) // every status is covered without throwing

console.log('posting-action ok')
