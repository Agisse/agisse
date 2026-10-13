// Run: npx tsx src/features/assessments/games/gamesAptitude.check.ts
// The game modules import CSS; Node can't load it, so stub .css before importing them dynamically.
const nodeModule: string = 'node:module'
const { register } = await import(nodeModule)
register('data:text/javascript,export async function load(u,c,n){return u.endsWith(".css")?{format:"module",source:"",shortCircuit:true}:n(u,c)}')

const nd = await import('./NumericalData')
const dg = await import('./Diagrammatic')
const vt = await import('./VerbalTfc')
const cr = await import('./CriticalReasoning')
const sj = await import('./Sjt')
const { CR_ITEMS, CR_OPTIONS, CR_TYPES } = await import('./criticalItems')
const { SJT_SCENARIOS } = await import('./sjtItems')
const { VERBAL_PASSAGES } = await import('./verbalItems')
const { deck } = await import('./Aptitude')
const { PROVIDER_GAMES, CURATED_ASSESSMENTS } = await import('../../../../shared/assessment-catalog')
const { referencePercentile } = await import('../../../../shared/assessments')
import type { Trial } from '../engine/types'

const ok = (cond: unknown, what: string) => {
  if (!cond) throw new Error(what)
}
function seeded(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
}
const rand = seeded(11)

// Numerical: five distinct options, the answer among them and recomputable from the shown data, explanation steps present.
const kinds = new Set<string>()
for (let level = 1; level <= 10; level++) {
  for (let i = 0; i < 300; i++) {
    const it = nd.makeNumericalItem(level, rand)
    kinds.add(it.kind)
    ok(it.options.length === 5 && new Set(it.options).size === 5, `5 distinct options L${level} ${it.kind} ${it.options}`)
    ok(it.answer >= 0 && it.answer < 5, 'answer index')
    ok(it.explain.length > 0 && it.explain.every((l) => l.length > 10), 'explanation')
    ok(it.explain.join(' ').includes(it.options[it.answer]!.replace(/ (people|[A-Z]{3})$/, '').replace(/^€|m$/g, '')), `explanation ends at the answer ${it.kind}: ${it.options[it.answer]} / ${it.explain.join(' ')}`)
    if (it.data.kind === 'bars') ok(it.data.bars.reduce((s, b) => s + b.value, 0) === 100 && it.data.bars.every((b) => b.value >= 6), 'shares sum to 100')
  }
}
ok(['change', 'share', 'project', 'fx-simple', 'fx-cross', 'fx-fee', 'count', 'diff', 'part'].every((k) => kinds.has(k)), `all question kinds generated: ${[...kinds]}`)
{
  // Hand-made: 400 → 500 is +25%, and the wrong-base slip (20%) and the ratio slip (125%) are offered.
  const o = nd.optionsOf(25, [20, 125, 25], 1, (s) => `${s}%`, rand)
  ok(o.options[o.answer] === '25.0%' && o.options.includes('20.0%') && o.options.includes('125.0%') && new Set(o.options).size === 5, 'optionsOf')
}

// Diagrammatic: the rules do what they say, the answer is the chain's output, options look different from each other.
const fig: import('./Diagrammatic').Fig = [
  { s: 'tri', f: true, r: 0 },
  { s: 'circ', f: false, r: 0 },
  { s: 'sq', f: true, r: 90 },
]
ok(dg.figKey(dg.apply('reverse', fig)) === 'sq10 circ00 tri10', 'reverse')
ok(dg.figKey(dg.apply('invert', fig)) === 'tri00 circ10 sq00', 'invert')
ok(dg.figKey(dg.apply('rotate', fig)) === 'tri190 circ00 sq10', 'rotate shows on triangles only')
ok(dg.figKey(dg.apply('shift', fig)) === 'circ00 sq10 tri10', 'shift')
ok(dg.apply('drop', fig).length === 2 && dg.apply('add', fig).length === 4 && dg.figKey(dg.apply('add', fig)).endsWith('tri10'), 'drop/add')
for (let level = 1; level <= 10; level++) {
  for (let i = 0; i < 200; i++) {
    const it = dg.makeDiagItem(level, rand)
    ok(it.chain.length === (level >= 8 ? 3 : level >= 4 ? 2 : 1) && new Set(it.chain).size === it.chain.length, 'chain length')
    ok(dg.figKey(it.options[it.answer]!) === dg.figKey(dg.run(it.chain, it.input)), 'answer = chain output')
    ok(new Set(it.options.map(dg.figKey)).size === it.options.length && it.options.length === (level >= 4 ? 5 : 4), `distinct options L${level}`)
    ok(it.examples.every((e) => dg.figKey(e.to) === dg.figKey(dg.apply(e.op, e.from)) && dg.figKey(e.to) !== dg.figKey(e.from)), 'examples show a visible change')
    ok(it.explain.length === it.chain.length + 1 && it.chain.every((op) => it.sym[op]), 'explanation per box')
  }
}

// Verbal: 30+ statements, every answer a valid label with a justification; passages roughly 120 words.
ok(vt.VERBAL_ITEMS.length >= 30, 'at least 30 verbal items')
ok(new Set(VERBAL_PASSAGES.map((p) => p.id)).size === VERBAL_PASSAGES.length, 'unique passage ids')
for (const p of VERBAL_PASSAGES) {
  const words = p.text.split(/\s+/).length
  ok(words >= 90 && words <= 160, `${p.id} length ${words}`)
  ok(p.statements.every((s) => vt.TFC.includes(s.answer) && s.why.length > 10 && s.text.length > 10), `${p.id} statements`)
}
for (const a of vt.TFC) ok(vt.VERBAL_ITEMS.filter((s) => s.answer === a).length >= 8, `enough ${a} answers`)

// Critical reasoning: ≥8 per section, answers in range, the section filter works.
ok(new Set(CR_ITEMS.map((i) => i.id)).size === CR_ITEMS.length, 'unique cr ids')
for (const t of CR_TYPES) {
  const xs = CR_ITEMS.filter((i) => i.type === t)
  ok(xs.length >= 8, `${t} has ≥8 items`)
  ok(xs.every((i) => Number.isInteger(i.answer) && i.answer >= 0 && i.answer < CR_OPTIONS[t].length && i.why.length > 10 && i.stem && i.claim), `${t} well-formed`)
  ok(cr.crPool(t).every((i) => i.type === t) && cr.crPool(t).length === xs.length, `${t} filter`)
}
ok(cr.crPool(undefined).length === CR_ITEMS.length, 'default mixes all')
const T = (correct: boolean, kind: string): Trial => ({ correct, rt: 1000, level: 3, kind })
const crd = cr.crDetails([T(true, 'deduction'), T(false, 'deduction'), T(true, 'evaluation')])
ok(crd.deductionAcc === 0.5 && crd.evaluationAcc === 1 && !('inferenceAcc' in crd), `cr details ${JSON.stringify(crd)}`)

// SJT: ≥20 scenarios, ratings a permutation of 1–4, judging both variants.
ok(SJT_SCENARIOS.length >= 20 && new Set(SJT_SCENARIOS.map((s) => s.id)).size === SJT_SCENARIOS.length, 'sjt count')
for (const s of SJT_SCENARIOS) {
  ok([...s.ratings].sort().join() === '1,2,3,4' && s.note.length > 10 && s.competency, `${s.id} key`)
  const best = s.ratings.indexOf(4)
  const worst = s.ratings.indexOf(1)
  ok(sj.judgeMostLeast(s, best, worst).correct && sj.judgeMostLeast(s, best, worst).kind === 'ml:2', 'most/least right')
  ok(!sj.judgeMostLeast(s, worst, best).correct && sj.judgeMostLeast(s, worst, best).kind === 'ml:0', 'most/least swapped')
  ok(sj.judgeRate(s, [...s.ratings]).correct && sj.judgeRate(s, [...s.ratings]).kind === 'rate:100', 'rate exact')
  ok(!sj.judgeRate(s, s.ratings.map((r) => 5 - r)).correct, 'rate reversed')
}
ok(sj.sjtDetails([T(true, 'ml:2'), T(false, 'ml:1'), T(false, 'rate:50')]).partialCredit === 0.67, 'sjt partial credit')

// Deck: every item once before any repeats.
const d = deck([1, 2, 3, 4], rand)
ok(new Set([d(), d(), d(), d()]).size === 4, 'deck covers all before repeating')

// Catalogue: every new engine is offered by a publisher; guides, practice links and basis are set on the aptitude tests.
for (const id of ['numerical-data', 'verbal-tfc', 'sjt', 'critical-reasoning', 'diagrammatic']) ok(PROVIDER_GAMES.some((g) => g.gameId === id), `${id} in catalogue`)
for (const g of PROVIDER_GAMES.filter((x) => x.basis)) {
  const words = g.guide?.split(/\s+/).length ?? 0
  ok(words >= 40 && words <= 160 && g.practiceUrl?.startsWith('https://'), `${g.id} guide (${words} words) and practice link`)
  ok(!g.timeRecorded || (g.realDuration === null && g.realRounds), `${g.id}: time-recorded tests have no countdown but a set length`)
}
ok(CURATED_ASSESSMENTS.find((c) => c.company === 'PwC')!.gameTypes.includes('numerical-data'), 'PwC stage uses the SHL tests')

// Reference percentile: monotone, centred, clamped.
ok(referencePercentile(50) === 50 && referencePercentile(65) === 84 && referencePercentile(35) === 16, 'reference curve')
ok(referencePercentile(0) === 1 && referencePercentile(100) === 99, 'clamped')

// Regressions: no zero answers to "how many more / by what percentage", a bank fee adds to what is paid, rounding stated.
for (let level = 1; level <= 10; level++)
  for (let i = 0; i < 500; i++) {
    const it = nd.makeNumericalItem(level, rand)
    const a = it.options[it.answer]!
    if (it.kind === 'diff') ok(a !== '0 people', `diff never 0: ${it.question}`)
    if (it.kind === 'change') ok(a !== '0.0%', `change never 0%: ${it.question}`)
    if (it.kind === 'fx-fee') ok(it.question.includes('on top') && it.explain.some((l) => l.startsWith('Add the')), `fee is added: ${it.question}`)
    if (it.kind === 'project' && it.data.kind === 'bars') ok(it.question.includes('Round to the nearest person'), 'survey projection states rounding')
  }
// Diagrammatic: each example fits exactly one box, so the rule can be read, not guessed by elimination.
for (let level = 1; level <= 10; level++)
  for (let i = 0; i < 500; i++)
    for (const e of dg.makeDiagItem(level, rand).examples) ok(dg.OPS.filter((o) => dg.figKey(dg.apply(o, e.from)) === dg.figKey(e.to)).length === 1, `one rule fits example L${level}`)
// Deck: never the same item twice in a row, also across a reshuffle.
{
  const d2 = deck([1, 2, 3], rand)
  let prev = d2()
  for (let i = 0; i < 300; i++) {
    const x = d2()
    ok(x !== prev, 'deck repeats an item back to back')
    prev = x
  }
}

console.log('gamesAptitude: all checks passed')
