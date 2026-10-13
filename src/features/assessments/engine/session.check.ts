// Run: npx tsx src/features/assessments/engine/session.check.ts
import { GameSession, median, nextLevel } from './session'
import type { GameDef, Trial } from './types'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}
const t = (correct: boolean, rt = 500, level = 3): Trial => ({ correct, rt, level })

eq(median([3, 1, 2]), 2, 'median odd')
eq(median([4, 1, 2, 3]), 2.5, 'median even')
eq(nextLevel(3, Array(6).fill(t(true, 400)), 800), 4, 'fast and accurate goes up')
eq(nextLevel(3, Array(6).fill(t(true, 1200)), 800), 3, 'accurate but slow stays')
eq(nextLevel(3, [t(true), t(false), t(false), t(false), t(true), t(false)], 800), 2, 'under 60% goes down')
eq(nextLevel(1, Array(6).fill(t(false)), 800), 1, 'floor')
eq(nextLevel(10, Array(6).fill(t(true, 100)), 800), 10, 'ceiling')
eq(nextLevel(3, Array(5).fill(t(true, 100)), 800), 3, 'needs a full window')

const game = { id: 'numerical-speed', name: 'x', skills: ['numerical-speed'], howTo: '', duration: 60, targetRt: 800, Component: () => null } as GameDef
const s = new GameSession(game, 3)
s.start()
for (let i = 0; i < 12; i++) s.submitAnswer(t(true, 300, s.level))
eq(s.level, 5, 'one step per window')
const r = s.finish()
eq([r.accuracy, r.errors, r.trials, r.difficultyReached], [1, 0, 12, 4], 'result')
eq(r.skillMetrics['numerical-speed'], r.score, 'skill metric')

// 5 of 6 right at speed is "> 85%" in spirit: it levels up.
eq(nextLevel(3, [...Array(5).fill(t(true, 400)), t(false, 400)], 800), 4, '5 of 6 goes up')
// A correctly withheld response waited out its window; it is not a slow answer.
const held = (rt: number): Trial => ({ correct: true, rt, level: 3, withheld: true })
eq(nextLevel(3, [t(true, 300), t(true, 300), held(1500), held(1500), held(1500), t(true, 300)], 800), 4, 'withheld rts do not block levelling')
{
  const g = new GameSession(game, 3)
  g.start()
  ;[t(true, 300), held(1500), held(1500), t(true, 400)].forEach((x) => g.submitAnswer(x))
  eq(g.finish().medianResponseTime, 350, 'median rt skips withheld')
}
// Simulation walks the level at random: the score credits the mean level answered right, not the luckiest peak.
{
  const g = new GameSession(game, 5, false)
  g.start()
  ;[2, 9, 4].forEach((level) => g.submitAnswer(t(true, 500, level)))
  eq(g.finish().difficultyReached, 5, 'simulation level is the mean')
}
// Nothing answered, or a preference game: no skill score to store.
{
  const g = new GameSession(game, 3)
  g.start()
  eq(g.finish().skillMetrics, {}, 'no trials, no skill score')
  const p = new GameSession(game, 3, true, false)
  p.start()
  p.submitAnswer(t(true))
  eq(p.finish().skillMetrics, {}, 'unscored game, no skill score')
}
console.log('session ok')
