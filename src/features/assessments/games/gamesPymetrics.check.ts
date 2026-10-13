// Run: npx tsx src/features/assessments/games/gamesPymetrics.check.ts
// The game modules import CSS; Node can't load it, so stub .css before importing them dynamically.
const nodeModule: string = 'node:module'
const { register } = await import(nodeModule)
register('data:text/javascript,export async function load(u,c,n){return u.endsWith(".css")?{format:"module",source:"",shortCircuit:true}:n(u,c)}')

const bl = await import('./Balloons')
const cd = await import('./Cards')
const eh = await import('./EasyHard')
const kp = await import('./Keypresses')
const fl = await import('./Flanker')
const ln = await import('./Lengths')
const tw = await import('./Towers')
const me = await import('./MoneyExchange')
import type { Trial } from '../engine/types'

const ok = (cond: unknown, what: string) => {
  if (!cond) throw new Error(what)
}
function seeded(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
}
const rand = seeded(7)
const t = (correct: boolean, kind: string, rt = 500): Trial => ({ correct, rt, level: 3, kind })
const near = (a: number, b: number, eps: number) => Math.abs(a - b) < eps

// Balloons: pop points within 1…max, all colours drawn, optimum max/2, details.
const seen = new Set<number>()
for (let i = 0; i < 3000; i++) {
  const b = bl.makeBalloon(rand)
  seen.add(b.max)
  ok(b.popAt >= 1 && b.popAt <= b.max && Number.isInteger(b.popAt), `popAt ${b.popAt}/${b.max}`)
  ok(!bl.pops(b, b.popAt - 1) && bl.pops(b, b.popAt), 'pops')
}
ok(seen.size === 3 && bl.optimumPumps(32) === 16, 'balloon colours / optimum')
const bd = bl.balloonDetails([t(true, 'collect:8:8'), t(false, 'pop:8:5'), t(true, 'collect:8:4'), t(true, 'collect:8:4'), t(true, 'collect:32:10')])
ok(bd.popRate === 0.2 && bd.avgPumpsUnpopped === 6.5 && bd.avgPumpsMax8 === 5.33 && bd.avgPumpsMax32 === 10, `balloon details ${JSON.stringify(bd)}`)
// Max 8 in order [8,5,4,4]: first half off |6.5−4|/4 = 0.625, second half off 0; max 32 has one balloon, so it is skipped.
ok(bd.adaptation === 0.63, `adaptation ${bd.adaptation}`)

// Cards: each deck nets ±25 a card on average; good = C/D; details.
for (const d of cd.DECKS) {
  let net = 0
  for (let i = 0; i < 40000; i++) {
    const c = cd.drawCard(d, rand)
    ok(c.win % cd.ENERGY_DIV === 0 && c.loss % cd.ENERGY_DIV === 0, 'energy values whole')
    net += c.win - c.loss
  }
  ok(near(net / 40000, cd.isGood(d) ? 25 : -25, 6), `deck ${d} net ${net / 40000}`)
}
ok(cd.shuffleEvery(1) === 14 && cd.shuffleEvery(5) === 10 && cd.shuffleEvery(10) === 5, 'shuffleEvery')
const cdd = cd.cardsDetails([t(false, 'deck:A'), t(false, 'deck:B'), t(true, 'deck:C'), t(true, 'deck:D')])
ok(cdd.goodDeckRate === 0.5 && cdd.lateGoodDeckRate === 1, 'cards details')

// Easy or hard: rewards in range, kept clear of break-even at low levels, better task by reward.
ok(near(eh.BREAK_EVEN, 2.8, 1e-9), 'break-even')
for (let level = 1; level <= 10; level++) {
  for (let i = 0; i < 300; i++) {
    const it = eh.makeEffortItem(level, rand)
    ok(it.reward >= 1.24 && it.reward <= 4.3 && (eh.PROBS as readonly number[]).includes(it.p), `effort item ${JSON.stringify(it)}`)
    ok(Math.abs(it.reward - eh.BREAK_EVEN) >= Math.max(0, 0.9 - level * 0.09), `margin L${level}`)
  }
}
ok(eh.betterTask({ p: 50, reward: 4 }) === 'hard' && eh.betterTask({ p: 88, reward: 2 }) === 'easy', 'betterTask')
const ehd = eh.easyHardDetails([t(true, 'hard:88:1'), t(false, 'easy:88:1'), t(true, 'hard:12:0'), t(false, 'none:50')])
ok(ehd.hardRate === 0.667 && ehd.hardRate88 === 0.5 && ehd.hardRate12 === 1 && ehd.hardRate50 === 0 && ehd.hardCompletionRate === 0.5, `easy-hard details ${JSON.stringify(ehd)}`)

// Keypresses: trial shape and details.
for (let i = 0; i < 200; i++) {
  const ms = kp.readyMs(rand)
  ok(ms >= 1500 && ms <= 3500, 'ready ms')
}
const k1 = kp.keyTrial(90, 0, 2, 3)
ok(k1.correct && k1.rt === 167 && !kp.keyTrial(80, 1, 0, 3).correct, 'keyTrial')
const kd = kp.keypressesDetails([k1, kp.keyTrial(60, 1, 0, 3)])
ok(kd.pressesPerSecond === 5 && kd.earlyPresses === 1 && kd.latePresses === 2, `keypresses details ${JSON.stringify(kd)}`)

// Flanker: rule shares, answers, kinds, windows.
let side = 0
let nogo = 0
let prev: 'mid' | 'side' | 'nogo' | null = null
for (let i = 0; i < 6000; i++) {
  const a = fl.makeFlankItem('arrows', prev, rand)
  ok(a.rule !== 'nogo' && a.flank !== 'X' && (a.rule === 'side') === (a.colour === 'red'), 'arrows item')
  ok(a.switched === (prev !== null && prev !== a.rule), 'switch flag')
  prev = a.rule
  if (a.rule === 'side') side++
  const d = fl.makeFlankItem('direction', null, rand)
  ok(d.rule !== 'side' && (d.rule === 'nogo') === (d.flank === 'X'), 'direction item')
  if (d.rule === 'nogo') nogo++
}
ok(near(side / 6000, 1 / 3, 0.03) && near(nogo / 6000, 0.2, 0.03), `flank shares ${side} ${nogo}`)
const sideItem = { rule: 'side', centre: 'L', flank: 'R', colour: 'red', switched: true } as const
ok(fl.answerOf(sideItem) === 'R' && fl.isCorrect(sideItem, 'R') && !fl.isCorrect(sideItem, 'L'), 'side answer')
ok(fl.flankKind(sideItem) === 'side:incong:switch', 'flank kind')
const ng = { rule: 'nogo', centre: 'L', flank: 'X', colour: 'black', switched: false } as const
ok(fl.isCorrect(ng, null) && !fl.isCorrect(ng, 'L') && fl.flankKind(ng) === 'nogo', 'nogo')
ok(fl.windowMs('arrows', 1, 0) === 2200 && fl.windowMs('arrows', 10, 0) === 1120, 'arrows window')
ok(fl.windowMs('direction', 5, 80) < fl.windowMs('direction', 5, 0) && fl.windowMs('direction', 10, 200) === 500, 'direction speeds up')
const fd = fl.flankerDetails([t(true, 'mid:cong:repeat', 500), t(true, 'mid:incong:repeat', 620), t(false, 'side:cong:switch'), t(false, 'nogo'), t(true, 'nogo')])
ok(fd.congruencyCostMs === 120 && fd.ruleSwitchErrors === 1 && fd.noGoErrors === 1, `flanker details ${JSON.stringify(fd)}`)

// Lengths: difference shrinks 20% → 4%, rich pays 3× as often, bias sign.
ok(ln.diffPct(1) === 20 && ln.diffPct(10) === 4 && ln.mouthWidth('long', 1) === 72, 'lengths diff')
for (let level = 1; level < 10; level++) ok(ln.diffPct(level + 1) <= ln.diffPct(level) && ln.mouthWidth('long', level) > ln.SHORT_W, `diff L${level}`)
let richWins = 0
let leanWins = 0
for (let i = 0; i < 20000; i++) {
  if (ln.rewarded('long', 'long', 'long', rand)) richWins++
  if (ln.rewarded('short', 'short', 'long', rand)) leanWins++
  ok(!ln.rewarded('short', 'long', 'long', rand), 'wrong answers never pay')
}
ok(near(richWins / leanWins, 3, 0.3), `reward ratio ${richWins / leanWins}`)
ok(ln.lengthKind('short', 'long', 'long') === 'lean:rich', 'length kind')
const lb = ln.lengthsDetails([...Array(10)].map(() => t(true, 'rich:rich')).concat([...Array(5)].map(() => t(false, 'lean:rich')), [...Array(5)].map(() => t(true, 'lean:lean'))))
ok(lb.responseBias > 0 && lb.accuracy === 0.75 && lb.richAccuracy === 1 && lb.leanAccuracy === 0.5, `lengths details ${JSON.stringify(lb)}`)
ok(ln.lengthsDetails([t(true, 'rich:rich'), t(true, 'lean:lean')]).responseBias === 0, 'no bias')

// Towers: start legal, goal at exactly the BFS minimum, minimum = level + 1.
for (let level = 1; level <= 10; level++) {
  for (let i = 0; i < 40; i++) {
    const p = tw.makeTowerPuzzle(level, rand)
    ok(p.start.every((s, j) => s.length <= p.caps[j]!) && p.goal.every((s, j) => s.length <= p.caps[j]!), 'caps respected')
    ok(p.minMoves === level + 1, `L${level} min moves ${p.minMoves}`)
    ok(tw.distances(p.start, p.caps).get(tw.keyOf(p.goal))!.n === p.minMoves, 'goal distance')
    ok(p.start.flat().length === (level >= 8 ? 5 : 3), 'disc count')
  }
}
ok(tw.nextStates([[0, 1, 2], [], []], [3, 2, 1]).length === 2 && tw.nextStates([[0], [1, 2], []], [3, 2, 1]).length === 3, 'nextStates')
const td = tw.towersDetails([t(true, 'tower:0:3000'), t(false, 'tower:4:1000'), t(false, 'skip:2000')])
ok(td.avgExcessMoves === 2 && td.perfectRate === 0.333 && td.avgPlanningMs === 2000, `towers details ${JSON.stringify(td)}`)

// Money exchange: variants, returns, details.
ok(me.exchangeOf('trust', 3) === 'send' && me.exchangeOf('dictator', 0) === 'give' && me.exchangeOf('dictator', 1) === 'take', 'exchangeOf')
for (let i = 0; i < 500; i++) {
  const r = me.returned(7, rand)
  ok(r >= 0 && r <= 21 && Number.isInteger(r), 'returned')
  const g = me.strangerGift(rand)
  ok(g >= 0 && g <= 5, 'gift')
}
ok(me.exchangeTrial('send', 4, 6, 7, 900, 3).correct, 'always correct')
const md = me.moneyExchangeDetails([me.exchangeTrial('send', 4, 6, 7, 900, 3), me.exchangeTrial('send', 6, 0, 1, 900, 3)])
ok(md.avgSent === 5 && md.avgFairness === 4 && !('avgGiven' in md), `money details ${JSON.stringify(md)}`)
const md2 = me.moneyExchangeDetails([me.exchangeTrial('give', 3, 2, 5, 900, 3), me.exchangeTrial('take', 4, 5, 8, 900, 3)])
ok(md2.avgGiven === 3 && md2.avgTaken === 4 && md2.avgFairness === 6.5, 'dictator details')

// Balloons: banking after one pump never pops but is not a good decision; banking near half the ceiling is; a pop on the
// way to the best stop is bad luck, not a bad plan.
ok(!bl.wellJudged(32, 1, false) && bl.wellJudged(32, 16, false) && bl.wellJudged(32, 10, true) && !bl.wellJudged(32, 30, true), 'balloons judge the decision')

console.log('gamesPymetrics: all checks passed')
