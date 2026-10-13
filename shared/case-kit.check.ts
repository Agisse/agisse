// Run: npx tsx shared/case-kit.check.ts
import { MATH_KINDS, SIZING, checkMath, fmt, mathDrill, mathQuestion, parseNumber, rng, scoreSizing, type MathKind } from './case-kit.ts'

const fail = (m: string): never => {
  throw new Error(m)
}
const assert = {
  ok: (c: unknown, m = 'not ok') => void (c || fail(m)),
  equal: (a: unknown, b: unknown, m = '') => void (a === b || fail(`${m}: ${String(a)} !== ${String(b)}`)),
  deepEqual: (a: unknown, b: unknown, m = '') => void (JSON.stringify(a) === JSON.stringify(b) || fail(`${m}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`)),
}

// Numbers as people type them.
assert.equal(parseNumber('1,200'), 1200)
assert.equal(parseNumber('1.2k'), 1200)
assert.equal(parseNumber('4.8bn'), 4.8e9)
assert.equal(parseNumber('3 million'), 3e6)
assert.equal(parseNumber('€3 200'), 3200)
assert.equal(parseNumber('12,5'), 12.5)
assert.equal(parseNumber('15%'), 15)
assert.equal(parseNumber('abc'), null)
assert.equal(fmt(4_800_000_000), '4.8bn')
assert.equal(fmt(350_000), '350k')

// Every generated question is answerable from its own prompt and accepts its own answer.
const r = rng(42)
for (const kind of Object.keys(MATH_KINDS) as MathKind[])
  for (let i = 0; i < 200; i++) {
    const q = mathQuestion(kind, r)
    assert.ok(Number.isFinite(q.answer) && q.tolerance >= 0, `${kind}: ${q.prompt}`)
    assert.ok(checkMath(q, String(q.answer)), `${kind} accepts its answer: ${q.prompt} = ${q.answer}`)
    assert.ok(!checkMath(q, String(q.answer * 2 + 1)), `${kind} rejects a wrong answer`)
    if (kind === 'breakeven') assert.ok(Number.isInteger(q.answer) && q.answer > 0)
  }
assert.deepEqual(mathDrill(['percent'], 3, rng(1)), mathDrill(['percent'], 3, rng(1)), 'seeded drills replay')
assert.deepEqual(mathDrill(['percent', 'growth'], 4, rng(7)).map((q) => q.kind), ['percent', 'growth', 'percent', 'growth'])
const g = mathQuestion('growth', rng(3))
assert.ok(checkMath(g, `${g.answer}%`), 'percent sign accepted')

// Market sizing.
assert.ok(SIZING.length >= 20)
assert.equal(new Set(SIZING.map((p) => p.id)).size, SIZING.length, 'unique ids')
const coffee = SIZING.find((p) => p.id === 'coffee-brussels')!
const close = scoreSizing(coffee, 300_000, 'Population of Brussels times share who drink coffee')
assert.equal(close.verdict, 'close')
assert.deepEqual(close.missed.map((d) => d.driver), ['Cups per buyer per day'])
assert.equal(scoreSizing(coffee, 600_000, '').verdict, 'ballpark')
assert.equal(scoreSizing(coffee, 2_000_000, '').verdict, 'off')
assert.equal(scoreSizing(coffee, 50_000, '').verdict, 'off')
assert.equal(scoreSizing(coffee, 240_000, '').missed.length, coffee.tree.length, 'empty tree misses every driver')
console.log('case kit ok')
