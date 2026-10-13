// Run: npx tsx src/features/assessments/games/gamesA.check.ts
// The game modules import CSS; Node can't load it, so stub .css before importing them dynamically.
const nodeModule: string = 'node:module'
const { register } = await import(nodeModule)
register('data:text/javascript,export async function load(u,c,n){return u.endsWith(".css")?{format:"module",source:"",shortCircuit:true}:n(u,c)}')

const ns = await import('./NumericalSpeed')
const wm = await import('./WorkingMemory')
const nb = await import('./NBack')
const gn = await import('./GoNoGo')
const ts = await import('./TaskSwitching')
import type { Trial } from '../engine/types'

const ok = (cond: unknown, what: string) => {
  if (!cond) throw new Error(what)
}
// Deterministic PRNG so failures reproduce.
function seeded(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
}
const rand = seeded(42)
const t = (correct: boolean, kind: string, rt = 500): Trial => ({ correct, rt, level: 3, kind })

// Numerical: every generated item is whole, positive and self-consistent at every level.
for (let level = 1; level <= 10; level++) {
  for (let i = 0; i < 400; i++) {
    const p = ns.makeProblem(level, rand)
    if (p.kind === 'calc') {
      ok(Number.isInteger(p.answer) && p.answer > 0, `L${level} ${p.text} = ${p.answer}`)
      ok(ns.isCorrect(p, p.answer) && !ns.isCorrect(p, p.answer + 1), `isCorrect ${p.text}`)
      ok(p.explain.endsWith(`= ${p.answer}`), `explain ${p.explain}`)
      const expr = p.text.replace(/×/g, '*').replace(/÷/g, '/').replace(/(\d+)% of (\d+)/, '($1*$2/100)')
      ok(Function(`return ${expr}`)() === p.answer, `eval ${p.text}`)
      if (level < 3) ok(!p.text.includes('%'), 'no percentages below level 3')
    } else {
      ok(level >= 4, 'comparisons from level 4')
      ok(p.left !== p.right, `cmp tie ${p.left} vs ${p.right}`)
      const val = (s: string) => {
        const m = s.match(/^(\d+)% (more|less) than (\d+)$/)
        return m ? Number(m[3]) * (1 + ((m[2] === 'more' ? 1 : -1) * Number(m[1])) / 100) : Number(s)
      }
      const [l, r] = [val(p.left), val(p.right)]
      ok(Math.abs(l - r) >= 0.999, `cmp distinct ${p.left} vs ${p.right}`)
      ok(p.answer === (l > r ? 0 : 1), `cmp answer ${p.left} vs ${p.right}`)
    }
  }
}

// Working memory: length grows with level, no immediate repeats, exact-order check.
ok(wm.seqLength(1) === 3 && wm.seqLength(10) === 8, 'sequence lengths')
ok(wm.stepMs(10) < wm.stepMs(1) && wm.stepMs(10) >= 450, 'pacing')
for (let level = 1; level <= 10; level++) {
  const s = wm.makeSequence(level, rand)
  ok(s.items.length === wm.seqLength(level) && s.mode === wm.modeFor(level), `seq L${level}`)
  ok(s.items.every((x, i) => x >= 0 && x < 9 && x !== s.items[i - 1]), `seq items L${level}`)
  ok(wm.isCorrect(s, [...s.items]) && !wm.isCorrect(s, s.items.slice(0, -1)) && !wm.isCorrect(s, [...s.items].reverse()), 'seq isCorrect')
}

// N-back: N bands, ~30% matches, match detection, details.
ok(nb.nFor(3) === 1 && nb.nFor(4) === 2 && nb.nFor(7) === 2 && nb.nFor(8) === 3, 'n bands')
for (const n of [1, 2, 3]) {
  const h: number[] = []
  let matches = 0
  for (let i = 0; i < 3000; i++) {
    h.push(nb.nextItem(h, n, rand))
    if (nb.isMatch(h, n)) matches++
  }
  const share = matches / (3000 - n)
  ok(share > 0.25 && share < 0.35, `n=${n} match share ${share}`)
}
ok(nb.isMatch([1, 2, 1], 2) && !nb.isMatch([1, 2, 3], 2) && !nb.isMatch([1], 1), 'isMatch')
const nd = nb.nBackDetails([t(true, 'match'), t(false, 'match'), t(false, 'nonmatch'), t(true, 'nonmatch')])
ok(nd.hits === 1 && nd.falseAlarms === 1, 'n-back details')

// Go / hold: window 1100 → 500, ~25% no-go, correctness, details.
ok(gn.windowMs(1) === 1100 && gn.windowMs(10) === 500, 'go window')
const kinds = Array.from({ length: 4000 }, () => gn.makeStimulus(rand))
const nogo = kinds.filter((k) => k === 'nogo').length / kinds.length
ok(nogo > 0.22 && nogo < 0.28, `nogo share ${nogo}`)
ok(gn.isCorrect('go', true) && !gn.isCorrect('go', false) && gn.isCorrect('nogo', false) && !gn.isCorrect('nogo', true), 'go isCorrect')
const gd = gn.goNoGoDetails([t(true, 'go', 300), t(true, 'go', 500), t(false, 'go', 1100), t(false, 'nogo', 200), t(true, 'nogo', 1100)])
ok(gd.falsePositives === 1 && gd.misses === 1 && gd.meanGoRt === 400, `go details ${JSON.stringify(gd)}`)

// Rule switching: switch rate rises with level, answer mapping, switch cost.
let prev: 'parity' | 'magnitude' | null = null
const tally = { 1: [0, 0], 10: [0, 0] } as Record<number, [number, number]>
for (const level of [1, 10]) {
  for (let i = 0; i < 3000; i++) {
    const it = ts.makeItem(prev, level, rand)
    ok(it.digit !== 5 && it.digit >= 1 && it.digit <= 9, 'digit range')
    if (it.kind !== 'start') tally[level]![it.kind === 'switch' ? 0 : 1]++
    prev = it.rule
  }
}
ok(tally[1]![0] / 3000 < 0.3 && tally[10]![0] / 3000 > 0.5, `switch rates ${JSON.stringify(tally)}`)
ok(ts.correctSide({ digit: 3, rule: 'parity', kind: 'repeat', level: 1 }) === 'F', 'odd → F')
ok(ts.correctSide({ digit: 8, rule: 'parity', kind: 'repeat', level: 1 }) === 'J', 'even → J')
ok(ts.correctSide({ digit: 3, rule: 'magnitude', kind: 'repeat', level: 1 }) === 'F', 'low → F')
ok(ts.correctSide({ digit: 7, rule: 'magnitude', kind: 'repeat', level: 1 }) === 'J', 'high → J')
ok(!ts.isCorrect({ digit: 7, rule: 'magnitude', kind: 'repeat', level: 1 }, null), 'timeout is wrong')
const sd = ts.taskSwitchingDetails([t(true, 'switch', 900), t(true, 'switch', 1100), t(false, 'switch'), t(true, 'repeat', 700), t(true, 'start', 5000)])
ok(sd.switchCostMs === 300 && Math.abs(sd.switchAccuracy - 0.667) < 1e-9 && sd.repeatAccuracy === 1, `switch details ${JSON.stringify(sd)}`)
ok(ts.taskSwitchingDetails([t(true, 'switch')]).switchCostMs === 0, 'no repeats → 0 cost')

// Registry shapes.
for (const g of [ns.numericalSpeed, wm.workingMemory, nb.nBack, gn.goNoGo, ts.taskSwitching]) ok(g.duration > 0 && g.targetRt > 0 && g.skills.length, g.id)

console.log('gamesA checks passed')
