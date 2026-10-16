// Run: npx tsx worker/lib/quality.check.ts
import { byRank, promptVersion } from './openrouter.ts'
import { rankModels } from './quality.ts'
import { styleBlock } from './shared.ts'
import { calibrate, MIN_N, progressed, SCORE_BUCKETS, scoreRows } from '../../shared/quality.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

const rank = rankModels([
  { task: 'cv', model: 'good', answered: 20, failed: 0, flagged: 0, down: 0 },
  { task: 'cv', model: 'flaky', answered: 10, failed: 10, flagged: 0, down: 0 },
  { task: 'cv', model: 'sloppy', answered: 20, failed: 0, flagged: 20, down: 0 },
  { task: 'cv', model: 'new', answered: 5, failed: 0, flagged: 0, down: 0 },
])
eq(rank.cv, { good: 1, flaky: 0.5, sloppy: 0.5 }, 'scores; too few samples are left out')
eq(byRank(['sloppy', 'new', 'flaky', 'good'], rank.cv), ['good', 'sloppy', 'new', 'flaky'], 'best first, ties keep configured order')
eq(byRank(['a', 'b'], undefined), ['a', 'b'], 'no ranking keeps the order')
eq(byRank(['bad', 'unknown'], { bad: 0.2 }), ['unknown', 'bad'], 'measured-bad falls behind unmeasured')
const v = await promptVersion('hello')
eq([v.length, v === (await promptVersion('hello')), v === (await promptVersion('hello!'))], [8, true, false], 'prompt version is a stable 8-hex hash')
const rows = [...Array(MIN_N)].map((_, i) => ({ value: 4.6, hit: i < 12 })).concat([{ value: 2, hit: true }, { value: 4, hit: false }])
eq(
  calibrate(rows, SCORE_BUCKETS).map((b) => [b.bucket, b.n, b.hits, b.rate]),
  [['< 3.0', 1, 1, null], ['3.0–3.9', 0, 0, null], ['4.0–4.4', 1, 0, null], ['≥ 4.5', MIN_N, 12, 12 / MIN_N]],
  'calibration buckets; rate hidden below MIN_N',
)
const now = new Date('2026-10-16T00:00:00Z')
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString()
const h = (...s: string[]) => s.map((status, i) => ({ status, at: ago(40 - i) })) as Parameters<typeof progressed>[0]
eq(
  [
    progressed(h('applied', 'interview', 'rejected'), ago(40), now),
    progressed(h('applied', 'rejected'), ago(40), now),
    progressed(h('applied'), ago(40), now),
    progressed(h('applied'), ago(10), now),
    progressed(h('applied', 'responded'), ago(10), now),
    progressed(h('saved'), null, now),
    progressed([], ago(40), now),
  ],
  [true, false, false, null, true, null, null],
  'hit if it ever progressed, miss if rejected or silent 30+ days, else pending',
)
eq(
  scoreRows(
    [
      { score: 4.6, history: h('applied', 'interview'), appliedAt: ago(40), share: true },
      { score: 4.6, history: h('applied', 'interview'), appliedAt: ago(40), share: false },
      { score: 3.2, history: h('applied'), appliedAt: ago(40), share: null },
      { score: 3.2, history: h('applied'), appliedAt: ago(10), share: true },
    ],
    now,
  ),
  [{ value: 4.6, hit: true }, { value: 3.2, hit: false }],
  'opted-out seekers and pending applications are left out; no profile setting counts as on',
)
const block = styleBlock([Array(400).fill('word').join(' ')], ['too formal'])
eq([block.includes('SEEKER\'S OWN STYLE'), block.match(/\bword\b/g)?.length, block.includes('- too formal')], [true, 250, true], 'style block cuts examples to 250 words and lists objections')
eq(styleBlock([], []), '', 'nothing learned yet adds nothing to the prompt')
console.log('quality checks passed')
