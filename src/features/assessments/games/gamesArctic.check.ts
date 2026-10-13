// Run: npx tsx src/features/assessments/games/gamesArctic.check.ts
// The game modules import CSS; Node can't load it, so stub .css before importing them dynamically.
const nodeModule: string = 'node:module'
const { register } = await import(nodeModule)
register('data:text/javascript,export async function load(u,c,n){return u.endsWith(".css")?{format:"module",source:"",shortCircuit:true}:n(u,c)}')

const sd = await import('./SecurityDial')
const pr = await import('./Predict')
const tsl = await import('./TeamSales')
const bl = await import('./Balance')
const od = await import('./Order')
const tk = await import('./TokenSearch')
import type { Trial } from '../engine/types'

const ok = (cond: unknown, what: string) => {
  if (!cond) throw new Error(what)
}
function seeded(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
}
const rand = seeded(7)
const t = (correct: boolean, kind: string, rt = 500): Trial => ({ correct, rt, level: 3, kind })
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9

// Security: faster and narrower each stage, stage 10 near-impossible; angle error and judging.
for (let s = 2; s <= 10; s++) ok(sd.dialSpec(s).speed > sd.dialSpec(s - 1).speed && sd.dialSpec(s).halfWindow < sd.dialSpec(s - 1).halfWindow, `stage ${s}`)
ok((sd.dialSpec(10).halfWindow * 2) / sd.dialSpec(10).speed < 0.006, 'stage 10 window under 6 ms')
ok(near(sd.angleAt(350, 90, 1, 500), 35) && near(sd.angleAt(10, 90, -1, 1000), 280), 'angleAt wraps')
ok(near(sd.dialError(359, 0), -1) && near(sd.dialError(40, 1), 4) && near(sd.dialError(180, 0), -180), 'dialError')
ok(sd.judgeDial(110, 3, 3).correct && !sd.judgeDial(100, 3, 3).correct && sd.judgeDial(100, 3, 3).kind === 'miss:8', 'judgeDial')
for (let i = 0; i < 200; i++) ok(sd.newTarget(4, rand) !== 4, 'newTarget differs')
const dd = sd.dialDetails([t(true, 'hit:2'), t(false, 'miss:10'), t(true, 'hit:0'), t(false, 'skip')])
ok(near(dd.hitRate, 0.667) && dd.skips === 1 && dd.meanErrorDeg === 4, `dial details ${JSON.stringify(dd)}`)

// Predict: cues weaken with level, posterior math, no tied patterns, best forecast, late-half rate.
for (let level = 1; level <= 10; level++) {
  const cues = pr.makeCues(level, rand)
  ok(cues.length === 4 && cues.every((p) => p > 0 && p < 1), `cues L${level}`)
  ok(near(Math.max(...cues) - 0.5, 0.36 - (level - 1) * 0.03), `cue spread L${level}`)
  for (let i = 0; i < 200; i++) {
    const s = pr.makePattern(cues, rand)
    ok(s.length >= 1 && s.length <= 4 && new Set(s).size === s.length, 'pattern size')
    ok(Math.abs(pr.posterior(cues, s) - 0.5) > 0.01, 'pattern not tied')
  }
}
ok(near(pr.posterior([0.8, 0.5], [0]), 0.8) && near(pr.posterior([0.8, 0.8], [0, 1]), 16 / 17), 'posterior')
ok(pr.bestForecast([0.8, 0.3], [0, 1]) === 'sun' && pr.bestForecast([0.3], [0]) === 'rain', 'bestForecast')
const cues = [0.8, 0.6, 0.4, 0.2]
let suns = 0
for (let i = 0; i < 4000; i++) if (pr.drawWeather(cues, [0], rand) === 'sun') suns++
ok(suns / 4000 > 0.77 && suns / 4000 < 0.83, `weather draw ${suns}`)
const pd = pr.predictDetails([t(false, 'forecast'), t(false, 'forecast'), t(true, 'forecast'), t(true, 'forecast')])
ok(pd.optimalRate === 0.5 && pd.lateOptimalRate === 1, `predict details ${JSON.stringify(pd)}`)

// Team sales: payoffs form a prisoner's dilemma, rival rules, best move, rates.
const P = tsl.PAYOFF
ok(P.LH[0] > P.HH[0] && P.HH[0] > P.LL[0] && P.LL[0] > P.HL[0] && 2 * P.HH[0] > P.LH[0] + P.HL[0], 'PD ordering')
ok(tsl.rivalMove('grim', ['H', 'H'], 0) === 'H' && tsl.rivalMove('grim', ['L', 'H', 'H'], 0) === 'L', 'grim')
ok(tsl.rivalMove('tft', [], 0) === 'H' && tsl.rivalMove('tft', ['H', 'L'], 0) === 'L' && tsl.rivalMove('tft', ['L'], 1) === 'H', 'tft and noise')
ok(tsl.noiseFor(1) < tsl.noiseFor(10), 'noise rises')
ok(tsl.bestMove([]) === 'H' && tsl.bestMove(['L']) === 'H' && tsl.bestMove(['L', 'H']) === 'H' && tsl.bestMove(['H', 'L', 'L']) === 'L' && tsl.bestMove(['H', 'H'], true) === 'L', 'bestMove')
ok(tsl.salesKind('L', ['H', 'H', 'L']) === 'L:HL' && tsl.salesKind('H', []) === 'H:', 'salesKind')
const td = tsl.teamSalesDetails([t(true, 'H:'), t(true, 'H:H'), t(true, 'H:HL'), t(false, 'L:HL'), t(true, 'H:LH'), t(false, 'L:LH')])
ok(near(td.cooperationRate, 0.667) && td.retaliationRate === 0.5 && td.forgivenessRate === 0.5, `sales details ${JSON.stringify(td)}`)

// Balance: integer weights, every reference balances, ratios fixed by a spanning chain, target solvable within limits.
for (let level = 1; level <= 10; level++) {
  for (let i = 0; i < 300; i++) {
    const it = bl.makeBalanceItem(level, rand)
    const k = it.weights.length
    ok(k === (level <= 3 ? 3 : level <= 7 ? 4 : 5), `shape count L${level}`)
    ok(it.weights.every((w) => Number.isInteger(w) && w > 0) && new Set(it.weights).size === k, `weights ${it.weights}`)
    ok(it.refs.length === k - 1, 'k-1 references')
    for (const r of it.refs) ok(bl.panWeight(it.weights, r.left) === bl.panWeight(it.weights, r.right), 'reference balances')
    // Every shape is tied to shape 0 through the references, so the ratios are determined.
    const known = new Set([0])
    for (let grew = true; grew; ) {
      grew = false
      for (const r of it.refs) {
        const ids = [...r.left, ...r.right].map(([s]) => s)
        const unknown = ids.filter((s) => !known.has(s))
        if (unknown.length === 1) known.add(unknown[0]!), (grew = true)
      }
    }
    ok(known.size === k, 'references determine all ratios')
    ok(it.allowed.every((s) => !it.target.some(([x]) => x === s)) && it.allowed.length + it.target.length === k, 'allowed = the other shapes')
    ok(bl.balances(it, it.solution), 'solution balances')
    ok(it.solution.reduce((a, b) => a + b, 0) <= 8 && it.solution.every((c) => c <= bl.MAX_PER_SHAPE), 'solution small')
    ok(!bl.balances(it, it.solution.map((c, j) => (j === it.allowed[0] ? c + 1 : c))), 'one more piece unbalances')
    const cheat = new Array<number>(k).fill(0)
    for (const [s, n] of it.target) cheat[s] = n
    ok(!bl.balances(it, cheat), 'target shapes are not allowed on the right')
    ok(!bl.balances(it, new Array<number>(k).fill(0)), 'empty pan is wrong')
  }
}
ok(bl.balanceDetails([t(true, 'balance'), t(false, 'balance')]).accuracy === 0.5, 'balance details')

// Order: changing attributes grow with level, frames follow the rules, 5 distinct choices with one answer.
ok(od.changingCount(1) === 1 && od.changingCount(4) === 2 && od.changingCount(10) === 5, 'changing count')
for (let level = 1; level <= 10; level++) {
  for (let i = 0; i < 300; i++) {
    const it = od.makeOrderItem(level, rand)
    const seq = [...it.frames, it.answer]
    ok(it.changing.length === od.changingCount(level), 'changing length')
    for (const a of od.ATTRS) {
      const v = seq.map((f) => f[a])
      ok(v.every((x) => Number.isInteger(x) && x >= 0 && x < od.OPTIONS[a]), `${a} in range`)
      if (!it.changing.includes(a)) ok(v.every((x) => x === v[0]), `${a} constant`)
      else if (a === 'shape' || a === 'colour') ok(v[0] === v[2] && v[1] === v[3] && v[0] !== v[1], `${a} alternates`)
      else if (a === 'size') ok(Math.abs(v[1]! - v[0]!) === 1 && v[1]! - v[0]! === v[3]! - v[2]!, 'size steps')
      else if (a === 'rot') ok((v[1]! - v[0]! + 8) % 8 === (v[3]! - v[2]! + 8) % 8 && v[1] !== v[0], 'rot steps')
      else ok(v.every((x) => x !== 4) && new Set(v).size === 4, 'pos moves round the ring')
    }
    ok(it.choices.length === 5 && od.sameFrame(it.choices[it.answerIdx]!, it.answer), 'answer among choices')
    ok(it.choices.filter((c) => od.sameFrame(c, it.answer)).length === 1, 'one right choice')
    ok(new Set(it.choices.map((c) => JSON.stringify(c))).size === 5, 'choices distinct')
  }
}
const odd = od.orderDetails([t(true, 'order:1'), t(false, 'order:3'), t(true, 'order:4')])
ok(near(odd.accuracy, 0.667) && odd.multiRuleAccuracy === 0.5, `order details ${JSON.stringify(odd)}`)

// Token search: box counts, layout, hiding only in fresh boxes, error classes, details.
ok(tk.boxCount(1) === 4 && tk.boxCount(10) === 9, 'box counts')
for (let level = 1; level <= 10; level++) {
  const n = tk.boxCount(level)
  const cells = tk.layout(n, rand)
  ok(cells.length === n && new Set(cells).size === n && cells.every((c) => c >= 0 && c < 16), 'layout')
  const held: number[] = []
  for (let k = 0; k < n; k++) {
    const h = tk.hideToken(n, held, rand)
    ok(h >= 0 && h < n && !held.includes(h), 'hides in a fresh box')
    held.push(h)
  }
}
ok(tk.openBox(2, 1, [2], []) === 'between' && tk.openBox(3, 1, [2], [3]) === 'within', 'error classes')
ok(tk.openBox(1, 1, [2], [3]) === 'token' && tk.openBox(0, 1, [2], [3]) === 'empty', 'token / empty')
ok(tk.openBox(2, 1, [2], [2]) === 'between', 'between wins over within')
const tkd = tk.tokenSearchDetails([t(true, 'search:0:0'), t(false, 'search:2:1'), t(false, 'search:0:1')])
ok(tkd.withinErrors === 2 && tkd.betweenErrors === 2 && near(tkd.perfectSearchRate, 0.333), `token details ${JSON.stringify(tkd)}`)

// Registry shapes.
for (const g of [sd.securityDial, pr.predict, tsl.teamSales, bl.balance, od.order, tk.tokenSearch]) ok(g.duration > 0 && g.targetRt > 0 && g.skills.length && g.details, g.id)

// Order: a moving shape turns a corner within the three frames, so "round the ring" is the only reading.
for (let i = 0; i < 2000; i++) {
  const it = od.makeOrderItem(10, rand)
  const [a, b, c] = it.frames.map((f) => [f.pos % 3, Math.floor(f.pos / 3)])
  ok(!(a![0] === b![0] && b![0] === c![0]) && !(a![1] === b![1] && b![1] === c![1]), `position frames not in a straight line ${it.frames.map((f) => f.pos)}`)
}

console.log('gamesArctic checks passed')
