// Run: npx tsx worker/lib/quality.check.ts
import { byRank, promptVersion } from './openrouter.ts'
import { rankModels } from './quality.ts'
import { styleBlock } from './shared.ts'
import { calibrate, MIN_N, SCORE_BUCKETS } from '../../shared/quality.ts'

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
const block = styleBlock([Array(400).fill('word').join(' ')], ['too formal'])
eq([block.includes('SEEKER\'S OWN STYLE'), block.match(/\bword\b/g)?.length, block.includes('- too formal')], [true, 250, true], 'style block cuts examples to 250 words and lists objections')
eq(styleBlock([], []), '', 'nothing learned yet adds nothing to the prompt')
console.log('quality checks passed')
