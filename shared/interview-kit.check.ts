// Run: npx tsx shared/interview-kit.check.ts
import { FIELDS, FIELD_QUESTIONS, deliveryNotes, fieldFor, formatFor, keywordsUsed, repeatedPhrases, timeShare, type FieldId } from './interview-kit.ts'

const fail = (m: string): never => {
  throw new Error(m)
}
const assert = {
  ok: (c: unknown, m = 'not ok') => void (c || fail(m)),
  equal: (a: unknown, b: unknown, m = '') => void (a === b || fail(`${m}: ${String(a)} !== ${String(b)}`)),
  deepEqual: (a: unknown, b: unknown, m = '') => void (JSON.stringify(a) === JSON.stringify(b) || fail(`${m}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`)),
}

for (const f of Object.keys(FIELDS) as FieldId[]) {
  assert.ok(FIELD_QUESTIONS[f].length >= 8, f)
  assert.equal(FIELD_QUESTIONS[f][0]!.theme, 'motivation', `${f} opens with motivation`)
}
assert.equal(fieldFor('Investment banking, Finance'), 'business')
assert.equal(fieldFor('Strategy consulting'), 'consulting')
assert.equal(fieldFor('Master in Law (LLM)'), 'law')
assert.equal(fieldFor('Software engineering'), 'engineering')
assert.equal(fieldFor('MSc Business Engineering (Finance)'), 'business')
assert.equal(fieldFor(''), 'business')

assert.deepEqual(repeatedPhrases('At the end of the day we won. At the end of the day, it mattered.'), [
  { phrase: 'at the end', count: 2 },
  { phrase: 'the end of', count: 2 },
  { phrase: 'end of the', count: 2 },
])
assert.deepEqual(repeatedPhrases('No repeats in this short answer.'), [])
assert.deepEqual(keywordsUsed('I built a financial model in Excel for stakeholder reviews', ['Excel', 'financial modelling', 'stakeholder', 'SQL']), { used: ['Excel', 'stakeholder'], missing: ['financial modelling', 'SQL'] })
assert.equal(timeShare(60, 120), 0.5)
assert.equal(timeShare(200, 120), 1)

const notes = deliveryNotes({ transcript: 'um um um um I led a team', durationSec: 115, allowedSec: 120, wpm: 190, fillers: 4, keywords: ['team'] })
assert.deepEqual(notes.map((n) => [n.metric, n.ok]), [['Pace', false], ['Fillers', false], ['Repeated phrases', true], ['Time used', false], ['Posting keywords', true]])
assert.equal(deliveryNotes({ transcript: '', durationSec: 0, allowedSec: 60, wpm: 0, fillers: 0, keywords: [] }).length, 4, 'no keyword row without a posting')

assert.deepEqual(formatFor('live'), { prepSec: 0, answerSec: 120, retakes: 0, questions: 5 })
assert.equal(formatFor('one-way', { prepSec: 45, answerSec: 180, retakes: 2, questions: 6 }).prepSec, 45, 'one-way keeps the company format')
assert.equal(formatFor('presentation').prepSec, 1200)
console.log('interview kit ok')
