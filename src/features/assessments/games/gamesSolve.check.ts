// Run: npx tsx src/features/assessments/games/gamesSolve.check.ts
// The game modules import CSS; Node can't load it, so stub .css before importing them dynamically.
const nodeModule: string = 'node:module'
const { register } = await import(nodeModule)
register('data:text/javascript,export async function load(u,c,n){return u.endsWith(".css")?{format:"module",source:"",shortCircuit:true}:n(u,c)}')

const sw = await import('./SeaWolf')
const rr = await import('./Redrock')
import type { Trial } from '../engine/types'

const ok = (cond: unknown, what: string) => {
  if (!cond) throw new Error(what)
}
function seeded(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
}
const rand = seeded(7)

// Sea Wolf: every site has a valid optimum; ranges narrow and pools grow with level; judging matches the rules.
for (let level = 1; level <= 10; level++) {
  for (let i = 0; i < 60; i++) {
    const s = sw.makeSite(level, rand)
    ok(s.pool.length === 14 + level && new Set(s.pool.map((m) => m.id)).size === s.pool.length, `pool L${level}`)
    ok(s.want !== s.avoid, 'traits differ')
    ok(s.ranges.every(([lo, hi]) => lo >= 1 && hi <= 10 && hi - lo === Math.max(1, 4 - Math.floor(level / 3))), `ranges L${level}`)
    ok(s.pool.every((m) => m.attrs.every((v) => v >= 1 && v <= 10 && Number.isInteger(v)) && m.traits.length > 0), 'microbes')
    const { best, sets } = sw.solveSite(s)
    ok(best > 0 && sets.length > 0 && sets.every((x) => sw.isValid(s, x) && sw.uptake(x) === best), `optimum L${level}`)
    const opt = sets[0]!
    const r = sw.judgeSite(s, opt, opt)
    ok(r.valid && r.ratio === 1 && r.optimalShortlisted && r.picks.every(Boolean) && r.kind === `site:1:100:3:1`, 'judge optimum')
    const bad = s.pool.find((m) => m.traits.includes(s.avoid))
    if (bad) ok(!sw.isValid(s, [bad, opt[1]!, opt[2]!]) && sw.judgeSite(s, [bad, opt[1]!, opt[2]!], s.pool.slice(0, 10)).ratio === 0, 'avoided trait invalid')
  }
}
{
  // Hand-made site: averages, wanted and avoided traits.
  const m = (id: string, attrs: number[], traits: string[], uptake: number) => ({ id, attrs, traits, uptake })
  const pool = [m('a', [2, 5, 5], ['Motile'], 3), m('b', [4, 5, 5], ['Aerobic'], 4), m('c', [6, 5, 5], ['Aerobic'], 5), m('d', [9, 5, 5], ['Biofilm'], 9)]
  const site = { name: 't', ranges: [[3, 5], [4, 6], [4, 6]] as [number, number][], want: 'Motile', avoid: 'Biofilm', pool }
  ok(sw.isValid(site, [pool[0]!, pool[1]!, pool[2]!]), 'avg 4 in 3–5')
  ok(!sw.isValid(site, [pool[1]!, pool[2]!, pool[3]!]), 'avoid + no want')
  ok(sw.solveSite(site).best === 12, 'best 12')
}
const T = (correct: boolean, kind: string): Trial => ({ correct, rt: 1000, level: 3, kind })
const swd = sw.seaWolfDetails([T(true, 'site:1:100:6:1:3'), T(false, 'site:0:0:10:0:0')])
ok(swd.validRate === 0.5 && swd.scoreRatio === 0.5 && swd.shortlistSize === 8 && swd.optimalShortlisted === 0.5 && swd.pickAccuracy === 0.5, `sw details ${JSON.stringify(swd)}`)

// Redrock: studies are well-formed, answers come from the data, options contain exactly one right answer.
ok(rr.evalExpr('(1890 - 1620) / 1620 * 100')!.toFixed(4) === '16.6667' && rr.evalExpr('2×3÷4') === 1.5 && rr.evalExpr('alert(1)') === null && rr.evalExpr('1/0') === null, 'calculator')
ok(rr.isClose(16.6667, 16.7, 1) && !rr.isClose(16.6667, 17, 1) && rr.isClose(1532.4, 1532, 0) && rr.isClose(-4.25, -4.3, 1) && !rr.isClose(3, NaN, 1), 'tolerance')
for (let level = 1; level <= 10; level++) {
  for (let i = 0; i < 100; i++) {
    const s = rr.makeStudy(level, rand)
    ok(s.regions.length === (level <= 3 ? 3 : level <= 7 ? 4 : 5), `regions L${level}`)
    const figs = rr.figures(s)
    ok(figs.size === s.regions.length * 4 && s.relevant.every((id) => figs.has(id)) && new Set(s.relevant).size === 6, 'relevant figures')
    const reg = (id: string) => s.regions.find((r) => r.name === id.split('|')[0])!
    const [a, b, c] = [reg(s.relevant[0]!), reg(s.relevant[2]!), reg(s.relevant[4]!)]
    ok(Math.abs(s.questions[0]!.answer - ((a.y2 - a.y1) / a.y1) * 100) < 1e-9, 'q1')
    ok(Math.abs(s.questions[1]!.answer - b.y2 / b.area) < 1e-9, 'q2')
    ok(Math.abs(s.questions[2]!.answer - c.y2 * (c.y2 / c.y1) ** s.horizon) < 1e-6, 'q3')
    ok(s.questions.every((q) => rr.isClose(q.answer, Number(q.answer.toFixed(q.dp)), q.dp)), 'rounded answer accepted')
    ok(s.report.length === 3 && s.minis.length === 6, 'counts')
    for (const item of [...s.report, ...s.minis]) {
      ok(item.blanks.every((bl) => bl.answer >= 0 && bl.answer < bl.options.length && new Set(bl.options).size === bl.options.length), `blanks ${item.prompt}`)
      ok(rr.judgeChoice(item, item.blanks.map((bl) => bl.answer)) && !rr.judgeChoice(item, item.blanks.map((bl) => (bl.answer + 1) % bl.options.length)), 'judgeChoice')
    }
    ok(s.minis.every((m) => m.table && m.blanks[0]!.options.length === 4), 'mini options')
    const top = s.report[2]!.blanks[0]!
    const pct = (r: { y1: number; y2: number }) => rr.pctChange(r.y1, r.y2)
    ok(top.options[top.answer] === [...s.regions].sort((p, q) => pct(q) - pct(p))[0]!.name, 'conclusion top gain')
  }
}
const j = rr.judgeJournal(['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'd', 'x', 'y', 'z', 'w'])
ok(j.correct && j.recall === 100 && j.precision === 50 && j.kind === 'journal:100:50', 'journal')
ok(!rr.judgeJournal(['a', 'b'], ['a']).correct && rr.judgeJournal(['a'], []).precision === 0, 'journal partial')
const rd = rr.redrockDetails([T(true, 'journal:100:50'), T(false, 'journal:50:100'), T(true, 'analysis'), T(false, 'analysis'), T(true, 'report'), T(true, 'mini'), T(false, 'mini'), T(false, 'mini'), T(false, 'mini')])
ok(rd.journalRecall === 0.75 && rd.journalPrecision === 0.75 && rd.analysisAcc === 0.5 && rd.reportAcc === 1 && rd.miniCaseAcc === 0.25, `rr details ${JSON.stringify(rd)}`)

console.log('gamesSolve: all checks passed')
