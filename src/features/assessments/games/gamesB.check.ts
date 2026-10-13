// Run: npx tsx src/features/assessments/games/gamesB.check.ts
// No @types/node in the app tsconfig, so node's module API is reached untyped.
type Next = (spec: string, ctx: unknown) => unknown
const nodeModule = (globalThis as unknown as { process: { getBuiltinModule: (m: string) => { registerHooks: (h: { resolve: (spec: string, ctx: unknown, next: Next) => unknown }) => void } } }).process.getBuiltinModule('node:module')
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const assert = {
  ok: (c: unknown, msg = 'assertion failed') => {
    if (!c) throw new Error(msg)
  },
  equal: (a: unknown, b: unknown, msg = '') => assert.ok(same(a, b), `${msg} ${JSON.stringify(a)} !== ${JSON.stringify(b)}`),
  notEqual: (a: unknown, b: unknown, msg = '') => assert.ok(!same(a, b), `${msg} ${JSON.stringify(a)} === ${JSON.stringify(b)}`),
}

// The game modules import their CSS; stub it so the pure generators load under tsx.
nodeModule.registerHooks({
  resolve: (spec, ctx, next) => (spec.endsWith('.css') ? { url: 'data:text/javascript,', shortCircuit: true } : next(spec, ctx)),
})
const { makeNumberItem, makeShapeItem, makeSeqItem } = await import('./SequenceReasoning')
const { makeSpatialItem, isRecalled, countHits } = await import('./SpatialMemory')
const { makeRiskItem, judgeRisk, ev, variance, riskDetails, draw } = await import('./RiskReward')
const { makeRound, step, apart, hitsOf, trackingDetails, W, H, R } = await import('./AttentionTracking')
const { makeDotsItem, makeBarsItem } = await import('./Estimation')

// Seeded PRNG so failures reproduce.
let seed = 42
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)

for (let level = 1; level <= 10; level++) {
  for (let n = 0; n < 200; n++) {
    const s = makeSeqItem(level, rand)
    assert.equal(s.choices.length, 4)
    assert.equal(new Set(s.choices.map((c) => JSON.stringify(c))).size, 4, 'distinct choices')
    assert.ok(s.answer >= 0 && s.answer < 4)

    const sp = makeSpatialItem(level, rand)
    assert.equal(new Set(sp.cells).size, sp.cells.length)
    assert.ok(sp.cells.every((c) => c >= 0 && c < sp.size * sp.size) && sp.showMs >= 900)
    assert.ok(isRecalled(sp.cells, [...sp.cells].reverse()))
    assert.ok(!isRecalled(sp.cells, sp.cells.slice(1)))

    const r = makeRiskItem(level, rand)
    const [a, b] = r.options.map(ev) as [number, number]
    assert.ok(Math.abs(a - b) / Math.max(a, b) >= Math.max(0.04, 0.3 - level * 0.028) - 1e-9, 'EV gap')
    assert.notEqual(variance(r.options[0]), variance(r.options[1]))
    assert.ok(r.options.every((o) => o.outcomes.reduce((s, x) => s + x.p, 0) <= 100))
    const j0 = judgeRisk(r, 0)
    const j1 = judgeRisk(r, 1)
    assert.notEqual(j0.correct, j1.correct)
    assert.notEqual(j0.kind, j1.kind)

    const d = makeDotsItem(level, rand)
    if (d.type !== 'dots') throw new Error('dots')
    const counts = d.groups.map((g) => g.length)
    assert.equal(counts[d.answer], d.target)
    assert.equal(new Set(counts).size, counts.length, 'distinct dot counts')

    const bars = makeBarsItem(level, rand)
    if (bars.type !== 'bars') throw new Error('bars')
    const dist = bars.bars.map((v) => Math.abs(v - bars.target))
    assert.ok(dist.every((x, i) => i === bars.answer || x >= dist[bars.answer]! + 3), 'answer bar clearly closest')
    assert.ok(bars.bars.every((v) => v >= 3 && v <= 97))
  }
  const round = makeRound(level, rand)
  assert.ok(round.balls.length >= 6 && round.balls.length <= 12)
  assert.ok(round.targets.length >= 2 && round.targets.length <= 5 && new Set(round.targets).size === round.targets.length)
  let balls = round.balls
  for (let i = 0; i < 500; i++) balls = step(balls, 0.05)
  assert.ok(balls.every((p) => p.x >= R - 1e-9 && p.x <= W - R + 1e-9 && p.y >= R - 1e-9 && p.y <= H - R + 1e-9), 'stays inside')
}

// Known sequences.
const growing = makeNumberItem(2, () => 0.3)
if (growing.type === 'number') {
  const t = growing.terms
  const diffs = t.slice(1).map((x, i) => x - t[i]!)
  assert.ok(diffs.every((dd, i) => i === 0 || dd - diffs[i - 1]! === diffs[1]! - diffs[0]!), 'constant second difference')
}
const shape = makeShapeItem(8, rand)
assert.equal(shape.type, 'shape')

assert.equal(countHits([1, 2, 3], [3, 4]), 1)
assert.equal(hitsOf([0, 5], [5, 1]), 1)
assert.equal(trackingDetails([{ correct: false, rt: 1, level: 1, kind: '1/2' }, { correct: true, rt: 1, level: 1, kind: '3/3' }]), { meanHitRate: 0.75 })
assert.equal(
  riskDetails([
    { correct: true, rt: 1, level: 1, kind: 'safe' },
    { correct: false, rt: 1, level: 1, kind: 'risky' },
    { correct: false, rt: 1, level: 1, kind: 'timeout' },
    { correct: true, rt: 1, level: 1, kind: 'risky' },
  ]),
  { evRate: 0.667, lowVarianceRate: 0.333 },
)
assert.equal(draw({ outcomes: [{ p: 80, v: 50 }] }, () => 0.5), 50)
assert.equal(draw({ outcomes: [{ p: 80, v: 50 }] }, () => 0.9), 0)
// Tracking: balls bounce off each other, so when motion stops no target hides under another ball.
for (const level of [1, 5, 10])
  for (let k = 0; k < 200; k++) {
    const r = makeRound(level, rand)
    let b = r.balls
    for (let ms = 0; ms < r.moveMs; ms += 1000 / 60) b = step(b, 1 / 60)
    for (let ms = 0; ms < 3000 && !apart(b); ms += 1000 / 60) b = step(b, 1 / 60)
    assert.ok(apart(b), `balls apart at the stop L${level}`)
  }
console.log('gamesB checks passed')
