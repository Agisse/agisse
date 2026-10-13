// Run: npx tsx src/features/assessments/games/gamesHireVue.check.ts
// The game modules import CSS; Node can't load it, so stub .css before importing them dynamically.
const nodeModule: string = 'node:module'
const { register } = await import(nodeModule)
register('data:text/javascript,export async function load(u,c,n){return u.endsWith(".css")?{format:"module",source:"",shortCircuit:true}:n(u,c)}')

const nu = await import('./Numerosity')
const dn = await import('./Disconumbers')
const pf = await import('./Pathfinder')
const ip = await import('./ImagePuzzle')
const sm = await import('./ShapeMatch')
const em = await import('./Emotions')
import type { Trial } from '../engine/types'

const ok = (cond: unknown, what: string) => {
  if (!cond) throw new Error(what)
}
function seeded(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
}
const rand = seeded(7)
const t = (correct: boolean, kind: string, rt = 500): Trial => ({ correct, rt, level: 3, kind })

// Numerosity: the planted operands always solve it; whole positive targets; operators unlock by level.
ok(nu.combine('−', [3, 20, 5]) === 12 && nu.combine('÷', [2, 24, 3]) === 4 && nu.combine('×', [2, 3, 4]) === 24, 'combine')
for (let level = 1; level <= 10; level++) {
  for (let i = 0; i < 300; i++) {
    const it = nu.makeNumItem(level, rand)
    ok(Number.isInteger(it.target) && it.target > 0, `L${level} target ${it.target}`)
    ok(it.tiles.length === 5 + Math.ceil(level * 0.7) && it.tiles.length <= nu.KEYS.length, `L${level} tiles`)
    ok(it.need >= 2 && it.need <= 4, 'need')
    if (level < 3) ok(it.op === '+', 'only + below 3')
    if (level < 7) ok(it.op !== '÷', 'no ÷ below 7')
    const sol = nu.findSolution(it)
    ok(sol && nu.isSolution(it, sol), `L${level} solvable ${JSON.stringify(it)}`)
    ok(!nu.isSolution(it, sol!.slice(1)), 'wrong count rejected')
  }
}

// Disconumbers: lengths grow, no repeats, sum among options, judging and details.
ok(dn.makeDiscoRound(1, rand).seq.length === 3 && dn.makeDiscoRound(10, rand).seq.length === 7, 'disco lengths')
for (let level = 1; level <= 10; level++) {
  for (let i = 0; i < 200; i++) {
    const r = dn.makeDiscoRound(level, rand)
    ok(new Set(r.seq).size === r.seq.length && r.seq.every((c) => c >= 0 && c < r.circles.length && r.circles.length <= dn.KEYS.length), 'disco seq')
    ok(r.options.length === 4 && new Set(r.options).size === 4 && r.options.includes(dn.sumOf(r)) && r.options.every((o) => o > 0), 'disco options')
    ok(r.hide === level >= 4 && r.moving === level >= 6, 'disco flags')
    ok(dn.orderRight(r, [...r.seq]) && !dn.orderRight(r, [...r.seq].reverse()), 'disco order')
  }
}
const dd = dn.discoDetails([t(true, dn.discoKind(true, true)), t(false, dn.discoKind(true, false)), t(false, dn.discoKind(false, false)), t(false, 'timeout')])
ok(Math.abs(dd.orderRate - 0.667) < 0.001 && Math.abs(dd.sumRate - 0.333) < 0.001, `disco details ${JSON.stringify(dd)}`)

// Pathfinder: never starts solved, and undoing the scramble solves it; trace follows pipes.
ok(pf.trace({ size: 2, tiles: [pf.E | pf.W, pf.W | pf.S, 0, pf.N | pf.E], startRow: 0, endRow: 1 }).solved, 'trace solved')
ok(!pf.trace({ size: 2, tiles: [pf.E | pf.W, pf.W | pf.E, 0, pf.N | pf.E], startRow: 0, endRow: 1 }).solved, 'trace wrong row')
for (let level = 1; level <= 10; level++) {
  for (let i = 0; i < 200; i++) {
    const p = pf.makePuzzle(level, rand)
    ok(p.tiles.length === p.size * p.size && p.tiles.every((x) => (pf.PIPES as readonly number[]).includes(x)), 'path tiles')
    ok(!pf.trace(p).solved, 'starts unsolved')
    ok(p.par === 1 + Math.ceil(level / 2), 'par')
  }
}
// Solvability: search ≤ par swaps on small puzzles (BFS over swap sequences is cheap at par ≤ 2).
for (let i = 0; i < 100; i++) {
  const p = pf.makePuzzle(1, rand)
  const n = p.tiles.length
  let found = false
  for (let a = 0; a < n && !found; a++)
    for (let b = a + 1; b < n && !found; b++) {
      const t1 = pf.swapTiles(p.tiles, a, b)
      if (pf.trace({ ...p, tiles: t1 }).solved) found = true
      for (let c = 0; c < n && !found; c++) for (let d = c + 1; d < n && !found; d++) if (pf.trace({ ...p, tiles: pf.swapTiles(t1, c, d) }).solved) found = true
    }
  ok(found, 'level-1 puzzle solvable within par')
}
const pd = pf.pathDetails([t(true, pf.pathKind(3, 3)), t(false, pf.pathKind(6, 4)), t(false, 'skip')])
ok(pd.solved === 2 && pd.skips === 1 && pd.meanExtraSwaps === 1, `path details ${JSON.stringify(pd)}`)

// Image puzzle: shuffled, min swaps, rotation, resemble modes, details.
ok(ip.minSwaps([0, 1, 2]) === 0 && ip.minSwaps([1, 0, 2]) === 1 && ip.minSwaps([1, 2, 0]) === 2, 'minSwaps')
ok(ip.sameGrid(ip.rotate([1, 2, 3, 4], 2, 1), [3, 1, 4, 2]), 'rotate cw')
for (let level = 1; level <= 10; level++) {
  for (let i = 0; i < 200; i++) {
    const p = ip.makeArtPuzzle(level, rand)
    ok(p.n === (level <= 5 ? 3 : 4) && [...p.order].sort((a, b) => a - b).every((x, j) => x === j) && ip.minSwaps(p.order) > 0, 'art puzzle')
    const r = ip.makeResemble(level, rand)
    ok(r.shown.length === r.size * r.size && r.shown.every((c) => c >= 0 && c <= r.colours), 'resemble grid')
    if (level < 4) ok(r.mode === 'none' && ip.sameGrid(r.shown, r.answer), 'upright below 4')
    if (r.mode === 'shown-turned') ok(ip.sameGrid(ip.rotate(r.answer, r.size, r.turn), r.shown) && !ip.sameGrid(r.shown, r.answer), 'shown turned')
    if (r.mode === 'build-turned') ok(level >= 7 && ip.sameGrid(ip.rotate(r.shown, r.size, r.turn), r.answer) && !ip.sameGrid(r.shown, r.answer), 'build turned')
    for (let q = 0; q < 4; q++) ok(ip.sameGrid(ip.rotate(ip.rotate(r.shown, r.size, q), r.size, 4 - q), r.shown), 'rotate inverse')
  }
}
ok(ip.puzzleOk(5, 3) && !ip.puzzleOk(6, 3), 'puzzleOk')
const id = ip.imagePuzzleDetails([t(true, 'swaps:4/3'), t(true, 'swaps:3/3'), t(true, 'upright'), t(false, 'shown-turned'), t(true, 'build-turned')])
ok(id.meanExtraSwaps === 0.5 && id.uprightRate === 1 && id.turnedRate === 0.5, `image details ${JSON.stringify(id)}`)

// Shape match: exactly one odd figure; Shapedance has one identical group and all others unique.
for (let level = 1; level <= 10; level++) {
  for (let i = 0; i < 200; i++) {
    const u = sm.makeUnique(level, rand)
    const keys = u.figs.map(sm.figKey)
    ok(keys.filter((k) => k === keys[u.odd]).length === 1 && new Set(keys).size === 2, 'unique odd one')
    const it = sm.makeIdentical(level, rand)
    const ks = it.figs.map(sm.figKey)
    ok(it.figs.length === it.size * it.size && it.same.length >= 2, 'identical size')
    ok(it.same.every((j) => ks[j] === ks[it.same[0]]), 'identical group')
    ok(ks.every((k, j) => it.same.includes(j) || ks.filter((x) => x === k).length === 1), 'distractors unique')
    ok(sm.judgeIdentical(it, it.same).correct && !sm.judgeIdentical(it, it.same.slice(1)).correct, 'judge identical')
  }
}
ok(sm.variantsOf({ shape: 0, colour: 0, rot: 0, dot: 0 }, true).length === 5 && sm.variantsOf({ shape: 0, colour: 0, rot: 0, dot: 0 }, false).length === 16, 'variant counts')
const sd = sm.shapeDetails([t(true, 'colour'), t(false, 'colour'), t(true, 'rot'), t(false, 'id:2/3/1'), t(true, 'id:3/3/0')])
ok(sd.colourRate === 0.5 && sd.rotationRate === 1 && sd.detailRate === 0 && sd.missed === 1 && sd.falseAlarms === 1, `shape details ${JSON.stringify(sd)}`)

// Emotions: label sets, alternation and limits for 'ten', match items, 20+ situations, details.
ok(em.labelsFor('six').length === 6 && em.labelsFor('seven').includes('contempt') && em.labelsFor('ten').length === 10, 'label sets')
ok(Object.values(em.SITUATIONS).flat().length >= 20, 'situations')
ok(em.intensityFor(1) === 1 && em.intensityFor(10) < 0.45, 'intensity')
for (let level = 1; level <= 10; level++) {
  for (const v of ['six', 'seven', 'ten'] as const) {
    for (let i = 0; i < 40; i++) {
      const it = em.makeEmotionItem(level, v, i, rand)
      ok(em.labelsFor(v).includes(it.target), 'target in set')
      if (v === 'ten') ok(i % 2 ? it.situation && it.limitMs === 30000 && em.SITUATIONS[it.target].includes(it.situation) : !it.situation && it.limitMs === 7000, 'ten alternation')
      else ok(it.limitMs === null && !it.situation, 'untimed')
    }
  }
  for (let i = 0; i < 100; i++) {
    const m = em.makeMatchItem(level, rand)
    ok(m.options.length === 3 && m.options[m.answer].emotion === m.target && m.options.filter((o) => o.emotion === m.target).length === 1 && m.limitMs === 3000, 'match item')
  }
}
const p = em.paramsFor('happy', 0.5)
ok(p.smile === 0.5 && p.browInner === 0, 'paramsFor')
const ed = em.emotionDetails([
  t(true, em.emotionKind('happy', 'happy', false)),
  t(false, em.emotionKind('sad', 'timeout', false)),
  t(true, em.emotionKind('sad', 'sad', true)),
  t(false, em.emotionKind('angry', 'disgusted', true)),
])
ok(ed.timeouts === 1 && ed.faceOnlyRate === 0.5 && ed.situationRate === 0.5 && ed.sadRate === 0.5 && ed.happyRate === 1, `emotion details ${JSON.stringify(ed)}`)

// Puzzle: no two pieces look alike, or a correctly rebuilt picture could be marked wrong.
for (let level = 1; level <= 10; level++)
  for (let i = 0; i < 100; i++) {
    const p = ip.makeArtPuzzle(level, rand)
    ok(ip.piecesDistinct(p.art, p.n), `distinct pieces L${level}`)
  }
ok(!ip.piecesDistinct({ bg: '#fff', shapes: [] }, 3), 'blank art has twin pieces')

console.log('gamesHireVue: all checks passed')
