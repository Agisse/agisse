// Run: npx tsx worker/lib/helper.check.ts
import { parsePage, parseProposals } from './helper.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

eq(parsePage('/jobs/abc-1'), { kind: 'job', id: 'abc-1', tab: 'overview' }, 'job')
eq(parsePage('/jobs/abc/apply?x=1'), { kind: 'job', id: 'abc', tab: 'apply' }, 'job tab')
eq(parsePage('/s/s1'), { kind: 'search', id: 's1' }, 'search')
eq(parsePage('/scout/k9'), { kind: 'scout', id: 'k9' }, 'scout')
eq(parsePage('/scout/map'), { kind: 'other', path: '/scout/map' }, 'scout map')
eq(parsePage('/prepare/cv/linkedin'), { kind: 'cvReview' }, 'cv review')
eq(parsePage('/contacts'), { kind: 'other', path: '/contacts' }, 'other')

const raw = { kind: null, text: null, jobId: null, personId: null, status: null, nextAt: null, note: null }
const known = {
  jobs: new Map([['j1', { label: 'Analyst at Bain', notes: 'old' }]]),
  people: new Map([['p1', { label: 'Ann, Bain', notes: null }]]),
  memories: [{ text: 'You want to stay in Amsterdam.' }],
}
const out = parseProposals([
  { ...raw, type: 'remember', kind: 'preference', text: 'you want to stay in amsterdam' }, // duplicate
  { ...raw, type: 'remember', kind: 'nonsense', text: 'x' }, // bad kind
  { ...raw, type: 'remember', kind: 'goal', text: 'You aim for strategy consulting.' },
  { ...raw, type: 'job_update', jobId: 'j2', status: 'applied' }, // not the seeker's
  { ...raw, type: 'job_update', jobId: 'j1', status: 'interview', nextAt: '2026-10-12', note: 'First round booked' },
  { ...raw, type: 'person_update', personId: 'p1', status: 'maybe' }, // bad status, no note
], known)
eq(out, [
  { type: 'remember', kind: 'goal', text: 'You aim for strategy consulting.' },
  { type: 'job_update', jobId: 'j1', label: 'Analyst at Bain', status: 'interview', nextAt: '2026-10-12T09:00:00.000Z', note: 'First round booked', notes: 'old\nFirst round booked' },
], 'parseProposals')
console.log('helper ok')
