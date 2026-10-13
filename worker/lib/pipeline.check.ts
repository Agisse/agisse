// Run: npx tsx worker/lib/pipeline.check.ts
import { buildQueries, cleanLocation, cleanTitle, groundBonus, interleave, overlapsWith, prerank, verifySharedGround } from './pipeline.ts'
import type { Profile } from '../../shared/types.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}
const p = (url: string, text = 'Engineer at Google') => ({ url, title: url, text })

// Round-robin, deduped across batches and against the board.
const mixed = interleave([[p('a'), p('b'), p('c')], [p('b'), p('d')], [p('e')]], ['c'])
eq(mixed.map((x) => x.url), ['a', 'b', 'e', 'd'], 'interleave')

const profile = { university: 'KU Leuven', employers: ['Deloitte'], internships: [], organizations: [], interests: [], targetIndustries: [], skills: ['Python'] } as unknown as Profile
eq(overlapsWith(profile, 'Brussels', 'Analyst at Google. KU Leuven. Python, SQL. AFC Leuven.'), [{ kind: 'university', detail: 'Both: KU Leuven' }, { kind: 'skill', detail: 'Both: Python' }], 'overlap')
eq(overlapsWith(profile, null, 'Leuven address'), [], 'no partial overlap')

// Fewer than 8 at the company: keep everyone; most overlap first, ties keep order.
const few = [p('x', 'Meta'), p('y', 'Google KU Leuven'), p('z', 'Google')]
eq(prerank(few, 'Google', (c) => overlapsWith(profile, null, c.text)).map((r) => r.c.url), ['y', 'x', 'z'], 'prerank soft')
// Enough at the company: drop the rest.
const many = [p('meta', 'Meta'), ...Array.from({ length: 8 }, (_, i) => p(`g${i}`))]
eq(prerank(many, 'Google', () => []).map((r) => r.c.url), many.slice(1).map((c) => c.url), 'prerank filter')

// Shared ground needs the whole phrase in the person's own text, not scattered words or a company blurb.
const fin = { ...profile, targetIndustries: ['Corporate Finance', 'Transaction Services'] } as Profile
const claims = [{ kind: 'industry' as const, detail: 'industry: Corporate Finance' }, { kind: 'industry' as const, detail: 'Transaction Services' }, { kind: 'university' as const, detail: 'university: KU Leuven' }]
eq(verifySharedGround(claims, fin, null, 'Finance Intern – EF Corporate Learning\nEY is a Professional Services company. EY provides audit and transaction services.\nKU Leuven - Faculty of Economics'), { kept: [{ kind: 'university', detail: 'Both: KU Leuven' }], dropped: 2 }, 'verify phrase')

// "Find more" with three chosen types must not repeat round 1's queries.
const narrowed = { company: 'Bain', role: 'Associate Consultant', contactTypes: ['advice', 'peer', 'recruiter'] } as const
const q1 = buildQueries({ ...narrowed, contactTypes: [...narrowed.contactTypes] }, profile, 1)
const q2 = buildQueries({ ...narrowed, contactTypes: [...narrowed.contactTypes] }, profile, 2)
if (q2.every((q) => q1.includes(q))) throw new Error(`round 2 repeats round 1: ${q2}`)

eq([cleanTitle('Associate Consultant at Bain & Company', 'Bain & Company'), cleanTitle('Head of Sales - EMEA', 'Bain'), cleanLocation('Brussels Metropolitan Area (BE)')], ['Associate Consultant', 'Head of Sales - EMEA', 'Brussels'], 'clean')
eq(prerank([{ title: 'Associate Consultant', text: 'Bain and Company, Brussels' }], 'Bain & Company', () => []).length, 1, 'ampersand matches and')
console.log('pipeline ok')

// A shared school outranks two shared interests; the bonus stays capped.
if (groundBonus([{ kind: 'university' }]) <= groundBonus([{ kind: 'interest' }, { kind: 'interest' }])) throw new Error('school should beat interests')
eq(groundBonus([{ kind: 'university' }, { kind: 'employer' }, { kind: 'organization' }]), 30, 'bonus capped')
