// Run: npx tsx src/features/assessments/games/gamesAon.check.ts
// The game modules import CSS; Node can't load it, so stub .css before importing them dynamically.
const nodeModule: string = 'node:module'
const { register } = await import(nodeModule)
register('data:text/javascript,export async function load(u,c,n){return u.endsWith(".css")?{format:"module",source:"",shortCircuit:true}:n(u,c)}')

const gl = await import('./GridLock')
const gc = await import('./GridChallenge')
const sc = await import('./SwitchChallenge')
const dc = await import('./DigitChallenge')
const mc = await import('./MotionChallenge')
const gp = await import('./GapChallenge')
const nb = await import('./Numbubbles')
const pi = await import('./ProofIt')
const tu = await import('./TallyUp')
import type { Trial } from '../engine/types'

const ok = (cond: unknown, what: string) => {
  if (!cond) throw new Error(what)
}
function seeded(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
}
const rand = seeded(7)
const t = (correct: boolean, kind: string, rt = 500): Trial => ({ correct, rt, level: 3, kind })
const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

// Polyominoes and Grid Lock: rotation group, tiling is exact, pieces fit back.
const L: [number, number][] = [[0, 0], [1, 0], [2, 0], [2, 1]]
ok(gl.shapeKey(gl.turn(L, 4)) === gl.shapeKey(L) && gl.shapeKey(gl.turn(L, 1)) !== gl.shapeKey(L), 'turns')
ok(![0, 1, 2, 3].some((k) => gl.shapeKey(gl.turn(gl.mirror(L), k)) === gl.shapeKey(L)), 'L is chiral')
for (const level of LEVELS)
  for (let s = 0; s < 40; s++) {
    const p = gl.makeLockPuzzle(level, rand)
    const { rows, cols, pieces } = gl.lockSize(level)
    ok(p.rows === rows && p.cols === cols && p.pieces.length === pieces, `lock size L${level}`)
    ok(p.pieces.reduce((a, x) => a + x.length, 0) === rows * cols && p.pieces.every((x) => x.length >= 2 && x.length <= 5), `lock area L${level}`)
  }
{
  const board = Array(9).fill(-1)
  ok(gl.placeAt(board, 3, [[0, 0], [0, 1]], 0)?.join() === '0,1', 'place')
  ok(gl.placeAt(board, 3, [[0, 0], [0, 1]], 2) === null, 'place off edge')
  board[1] = 0
  ok(gl.placeAt(board, 3, [[0, 0], [0, 1]], 0) === null, 'place overlap')
  // An L anchored at its top cell may extend left of the anchor.
  ok(gl.placeAt(Array(9).fill(-1), 3, [[0, 1], [1, 0], [1, 1]], 1)?.join() === '1,3,4', 'anchor is first cell')
}
const gld = gl.gridLockDetails([t(true, 'rot:3/3'), t(true, 'rot:1/3'), t(false, 'gaveup')])
ok(Math.abs(gld.solveRate - 0.667) < 1e-9 && Math.abs(gld.turnsPerPiece - 0.67) < 1e-9, `lock details ${JSON.stringify(gld)}`)

// Grid challenge: span 2 → 7, distinct dots, distractors well-formed and answerable.
ok(gc.spanFor(1) === 2 && gc.spanFor(10) === 7, 'spans')
for (const level of LEVELS)
  for (let s = 0; s < 50; s++) {
    const task = gc.makeGridTask(level, rand)
    ok(task.dots.length === gc.spanFor(level) && new Set(task.dots).size === task.dots.length && task.dots.every((d) => d >= 0 && d < 16), 'dots')
    ok(task.distractors.length === task.dots.length, 'one distractor per dot')
    for (const d of task.distractors) {
      if (d.type === 'symmetry') ok(gc.isSymmetric(d.cells) === d.symmetric, 'symmetry label')
      else {
        const turned = [0, 1, 2, 3].some((k) => gl.shapeKey(gl.turn(d.a, k)) === gl.shapeKey(d.b))
        ok(turned === !d.mirrored, 'rotation label')
      }
    }
    ok(gc.recallHits(task.dots, task.dots) === task.dots.length && gc.recallHits(task.dots, [...task.dots].reverse()) < task.dots.length, 'recall')
  }
const gcd = gc.gridChallengeDetails([t(true, 'recall:3/3'), t(false, 'recall:1/3'), t(true, 'distractor'), t(false, 'distractor'), t(true, 'distractor')])
ok(gcd.recallAccuracy === 0.5 && Math.abs(gcd.recallPositionRate - 0.667) < 1e-9 && Math.abs(gcd.distractorAccuracy - 0.667) < 1e-9, `grid details ${JSON.stringify(gcd)}`)

// Switch: code semantics, exactly one choice works, chains from level 5.
ok(sc.applyCode([2, 0, 3, 1], ['a', 'b', 'c', 'd']).join('') === 'cadb' && sc.codeLabel([2, 0, 3, 1]) === '3142', 'code 3142')
let chains = 0
for (const level of LEVELS)
  for (let s = 0; s < 200; s++) {
    const it = sc.makeSwitchItem(level, rand)
    ok(it.choices.length === 3 && new Set(it.choices.map(sc.codeLabel)).size === 3, 'distinct choices')
    ok(it.choices.filter((c) => sc.switchWorks(it, c)).length === 1 && sc.switchWorks(it, it.choices[it.answer]!), `one answer L${level}`)
    if (it.switches.length > 1) {
      ok(level >= 5, 'chains from 5')
      chains++
    }
  }
ok(chains > 100, `chains appear ${chains}`)
const scd = sc.switchDetails([t(true, 'single'), t(false, 'single'), t(true, 'chain')])
ok(scd.singleAccuracy === 0.5 && scd.chainAccuracy === 1, 'switch details')

// Digit: precedence, exact division, generated equations solvable, any valid fill accepted.
ok(dc.evalExpr([2, 3, 4], ['+', '×']) === 14 && dc.evalExpr([8, 4, 2], ['÷', '−']) === 0 && dc.evalExpr([7, 2], ['÷']) === null, 'evalExpr')
for (const level of LEVELS)
  for (let s = 0; s < 60; s++) {
    const eq = dc.makeDigitEq(level, rand)
    ok(eq.ops.length + 1 === (level <= 3 ? 2 : level <= 7 ? 3 : 4), 'blank count')
    ok(dc.isValidFill(eq, eq.example), `example valid L${level}`)
    const sols = dc.solutions(eq)
    ok(sols.length >= 1 && sols.every((x) => dc.isValidFill(eq, x)), 'solutions')
    ok(!dc.isValidFill(eq, eq.example.map(() => 1)) || eq.example.length === 1, 'repeat digits rejected')
  }
ok(dc.isValidFill({ ops: ['+'], target: 9, example: [4, 5] }, [2, 7]) && !dc.isValidFill({ ops: ['+'], target: 9, example: [4, 5] }, [0, 9]), 'alternative fill / no zero')
const dd = dc.digitDetails([t(true, '2'), t(false, '3'), t(true, '3')])
ok(dd.twoBlankAccuracy === 1 && dd.threeBlankAccuracy === 0.5 && dd.fourBlankAccuracy === 0, 'digit details')

// Motion (moves): BFS optimum is real, puzzles in range and need blocks from level 3; times generation.
{
  const b = { size: 4, walls: [], blocks: [], ball: 0, exit: 3 }
  ok(mc.solveMoves(b) === 3, 'straight line')
  ok(mc.solveMoves({ ...b, blocks: [1] }) === 4 && mc.solveMoves({ ...b, blocks: [1] }, 30, true) === 5, 'block in the way')
  ok(mc.moveObject({ ...b, blocks: [2] }, 1, 1) === null, 'blocks never enter the exit')
}
for (const level of LEVELS) {
  const t0 = performance.now()
  for (let s = 0; s < 8; s++) {
    const p = mc.makeMovesPuzzle(level, rand)
    const lo = 2 + Math.floor(level * 0.65)
    ok(p.optimum >= lo && p.optimum <= lo + 4 && mc.solveMoves(p) === p.optimum, `moves optimum L${level}`)
    if (level >= 3) ok((mc.solveMoves(p, p.optimum, true) ?? Infinity) > p.optimum, 'blocks matter')
  }
  const ms = (performance.now() - t0) / 8
  ok(ms < 150, `moves generation L${level} ${ms.toFixed(0)}ms`)
}
// Motion (distance): best route is shortest, runner-up beyond the margin.
for (const level of LEVELS)
  for (let s = 0; s < 30; s++) {
    const tr = mc.makeTrack(level, rand)
    const [len, path] = mc.shortest(tr)!
    ok(Math.abs(len - tr.best) < 1e-9 && Math.abs(mc.pathLength(tr, path) - len) < 1e-9, 'track best')
    ok(path.slice(1).every((n, i) => mc.neighbours(tr, path[i]!).includes(n)), 'path uses tracks')
    ok(mc.runnerUp(tr, path) / len - 1 >= 0.15 - (level - 1) * 0.0133 - 1e-9, 'margin')
  }
const md = mc.motionDetails([t(true, 'extra:0'), t(false, 'extra:2'), t(false, 'skip'), t(true, 'extra:0')])
ok(md.optimalRate === 0.5 && Math.abs(md.meanExtra - 0.667) < 1e-9 && md.skipRate === 0.25, `motion details ${JSON.stringify(md)}`)

// Gap: valid Latin squares, '?' unique and consistent with the hidden answer; deduction needed from level 4.
for (const level of LEVELS)
  for (let s = 0; s < 30; s++) {
    const it = gp.makeGapItem(level, rand)
    const n = it.n
    ok(n === (level <= 5 ? 4 : 5) && it.grid[it.q] === null, 'gap shape')
    const full = [...it.grid]
    full[it.q] = it.answer
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        for (let k = c + 1; k < n; k++) {
          const [x, y] = [full[r * n + c], full[r * n + k]]
          ok(x === null || y === null || x !== y, 'row distinct')
          const [u, v] = [full[c * n + r], full[k * n + r]]
          ok(u === null || v === null || u !== v, 'col distinct')
        }
    const vals = gp.qValues(n, it.grid, it.q)
    ok(vals.size === 1 && vals.has(it.answer), `unique L${level}`)
    if (level >= 4) ok(!it.direct && gp.directCandidates(n, it.grid, it.q).length > 1, 'needs deduction')
  }
const gpd = gp.gapDetails([t(true, 'direct'), t(false, 'deduce'), t(true, 'deduce')])
ok(gpd.directAccuracy === 1 && gpd.deductionAccuracy === 0.5, 'gap details')

// Numbubbles: expressions evaluate to their value, target rounds have 2–3 hits, ascending values distinct; pop rules; streak scoring.
for (const level of LEVELS)
  for (let s = 0; s < 60; s++) {
    for (const idx of [0, 1]) {
      const rd = nb.makeBubbleRound(idx, level, rand)
      ok(rd.bubbles.length === 5 + Math.floor((level - 1) / 3), 'bubble count')
      for (const b of rd.bubbles) ok(dc.evalExpr(b.nums, b.ops) === b.value && b.nums.every((x) => Number.isInteger(x) && x > 0), `expr ${nb.bubbleText(b)} = ${b.value}`)
      if (rd.rule === 'target') {
        const hits = rd.bubbles.filter((b) => b.value === rd.target).length
        ok(hits >= 2 && hits <= 3, 'target hits')
      } else ok(new Set(rd.bubbles.map((b) => b.value)).size === rd.bubbles.length, 'ascending distinct')
    }
  }
{
  const v = (value: number) => ({ nums: [value], ops: [], value })
  const asc = { rule: 'ascending' as const, target: 0, bubbles: [v(5), v(2), v(9)] }
  ok(nb.isRightPop(asc, [], 1) && !nb.isRightPop(asc, [], 0) && nb.isRightPop(asc, [1], 0), 'ascending pops')
  ok(nb.remaining(asc, [1]).join() === '0,2', 'ascending remaining')
  const tg = { rule: 'target' as const, target: 7, bubbles: [v(7), v(6), v(7)] }
  ok(nb.isRightPop(tg, [], 2) && !nb.isRightPop(tg, [], 1) && nb.remaining(tg, [0]).join() === '2', 'target pops')
}
ok(nb.starsFor(1) === 1 && nb.starsFor(4) === 2 && nb.starsFor(13) === 5 && nb.starsFor(40) === 5, 'stars')
const nbd = nb.numbubblesDetails([t(true, 'pop'), t(true, 'pop'), t(true, 'pop'), t(true, 'pop'), t(false, 'pop'), t(true, 'pop'), t(false, 'miss')])
ok(nbd.bestStreak === 4 && nbd.points === 1 + 1 + 1 + 2 + 1 && Math.abs(nbd.popAccuracy - 0.833) < 1e-9, `bubbles details ${JSON.stringify(nbd)}`)

// Proof It: 15+ templates of 60–120 words; error counts by level; each error changes its token and is the only change.
ok(pi.TEMPLATES.length >= 15, 'template count')
for (const tp of pi.TEMPLATES) {
  const words = tp.text.split(' ').length
  ok(words >= 60 && words <= 120, `${tp.title}: ${words} words`)
}
for (const level of LEVELS)
  for (const tp of pi.TEMPLATES) {
    const clean = pi.makeProofDoc(1, seeded(level * 31), tp)
    const doc = pi.makeProofDoc(level, seeded(level * 31), tp)
    ok(doc.errors.length === 2 + Math.floor((level - 1) / 3), `error count L${level} ${tp.title}`)
    ok(new Set(doc.errors.map((e) => e.i)).size === doc.errors.length, 'distinct error tokens')
    for (const e of doc.errors) ok(doc.tokens[e.i] !== e.was, `error changes token ${e.was}`)
    // Same seed → same facts; every non-error token matches its clean original.
    const touched = (i: number) => [...doc.errors, ...clean.errors].some((e) => e.i === i)
    doc.tokens.forEach((w, i) => ok(touched(i) || w === clean.tokens[i], `only error tokens change: ${w}`))
    for (const e of doc.errors) if (e.type !== 'typo') ok(doc.ref.some(([, v]) => e.was.includes(v)), `fact error is in the table: ${e.was}`)
  }
ok(pi.typo('letter', seeded(1)) !== 'letter' && pi.typo('letter', seeded(1)).length === 6, 'typo')
ok(pi.changeDigit('PO-1000', seeded(3)) !== 'PO-1000' && !pi.changeDigit('5', seeded(3)).startsWith('0'), 'changeDigit')
ok(pi.respell('Okafor', seeded(2)) !== 'Okafor', 'respell')
const pd = pi.proofDetails([t(true, 'hit:typo'), t(true, 'hit:number'), t(false, 'false'), t(false, 'miss:date'), t(false, 'miss:typo')])
ok(pd.hitRate === 0.5 && Math.abs(pd.precision - 0.667) < 1e-9 && pd.typoHitRate === 0.5 && pd.factHitRate === 0.5, `proof details ${JSON.stringify(pd)}`)

// Tally Up: lengths and speed by level, never a tie, winner matches totals; modifiers from level 3.
ok(tu.tokenValue({ side: 0, value: 4, mod: 'double' }) === 8 && tu.tokenValue({ side: 1, value: 2, mod: 'negate' }) === -2, 'token values')
for (const level of LEVELS)
  for (let s = 0; s < 200; s++) {
    const it = tu.makeTallyItem(level, rand)
    const [a, b] = tu.totals(it)
    ok(it.tokens.length === 4 + Math.floor(level * 0.6) && a !== b && tu.winner(it) === (a > b ? 0 : 1), 'tally item')
    if (level <= 2) ok(it.tokens.every((x) => x.mod === null), 'no modifiers early')
  }
ok(tu.makeTallyItem(1, rand).showMs === 900 && tu.makeTallyItem(10, rand).showMs === 450, 'pace')
const td = tu.tallyDetails([t(true, 'plain'), t(false, 'mod'), t(true, 'mod'), t(false, 'timeout')])
ok(td.plainAccuracy === 1 && td.modifierAccuracy === 0.5 && td.timeouts === 1, 'tally details')

for (const g of [gl.gridLock, gc.gridChallenge, sc.switchChallenge, dc.digitChallenge, mc.motionChallenge, gp.gapChallenge, nb.numbubbles, pi.proofIt, tu.tallyUp]) ok(g.duration > 0 && g.targetRt > 0 && g.skills.length && g.details, g.id)

console.log('gamesAon checks passed')
