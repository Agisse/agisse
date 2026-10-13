// Run: npx tsx shared/case-library.check.ts
import assert from 'node:assert/strict'
import { CASES, checkCaseMaths, daysThisWeek, mathsScore, readiness, weakest, type CaseLog, type Scores } from './case-library.ts'

assert.equal(new Set(CASES.map((c) => c.id)).size, CASES.length, 'unique ids')
for (const c of CASES) assert.ok(checkCaseMaths(c.maths.answer, String(c.maths.answer)), `${c.id} accepts its own answer`)

// Each reference answer, recomputed from its exhibit.
const close = (a: number, b: number) => Math.abs(a - b) <= b * 0.03
assert.ok(close(((40 * 130 - 3000) - (42 * 105 - 3100)) / (40 * 130 - 3000) * 100, 40.5), 'brewery')
assert.ok(close(1.5e6 * 0.32 * 0.02 * 17 * 12 - 1.5e6, 458_400), 'velobox')
assert.ok(close(150e6 / (60 * 2500 * 35 * 12 * 0.2), 11.9), 'forma')
assert.ok(close(2 * 320 * 0.03 * 60, 1152), 'dentique')
assert.equal((Math.floor(900 / 110) - Math.floor(900 / 120)) * 30, 30, 'fjord')

assert.ok(checkCaseMaths(40.5, '40%') && checkCaseMaths(40.5, '-41'), 'percent sign and sign ignored')
assert.ok(checkCaseMaths(90e6, '90') && checkCaseMaths(90e6, '€90m') && !checkCaseMaths(90e6, '120m'), 'millions shorthand')
assert.ok(checkCaseMaths(458_400, '0.46m') && !checkCaseMaths(458_400, '1.96m'))
assert.ok(!checkCaseMaths(30, 'thirty'))
assert.deepEqual([mathsScore(true, 40, true), mathsScore(true, 90, true), mathsScore(false, 10, true), mathsScore(false, 10, false)], [5, 4, 2, 1])

const s = (structure: number, insight: number, maths: number, creativity: number, synthesis: number): Scores => ({ structure, insight, maths, creativity, synthesis })
assert.equal(weakest(s(4, 4, 2, 4, 3)), 'maths')
const log = (scores: Scores, source: CaseLog['source'] = 'solo'): CaseLog => ({ id: 'x', at: new Date().toISOString(), title: 'x', source, scores, fix: '' })
assert.equal(readiness([]).line, 'Run your first case to see where you stand.')
const five = Array.from({ length: 5 }, () => log(s(4, 4, 5, 3, 2)))
assert.equal(readiness(five).line, 'Structure, exhibits and maths are consistent; recommendation is not there yet.')
assert.equal(readiness(Array.from({ length: 5 }, () => log(s(2, 3, 3, 3, 3)))).line, 'Structure is not there yet.')
assert.match(readiness(Array.from({ length: 30 }, (_, i) => log(s(4, 4, 4, 4, 4), i % 2 ? 'live' : 'solo'))).line, /^Consistent/)
assert.match(readiness(Array.from({ length: 5 }, () => log(s(4, 4, 4, 4, 4)))).line, /^Strong recent/)

const wed = new Date('2026-10-14T12:00:00')
assert.equal(daysThisWeek(['2026-10-12T09:00:00', '2026-10-12T18:00:00', '2026-10-13T09:00:00', '2026-10-11T09:00:00'], wed), 2, 'Monday-start week, one per day')
console.log('case library ok')
