// Run: npx tsx src/lib/ai-wait.check.ts
import { stepAt } from './ai-wait.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (got !== want) throw new Error(`${what} = ${got}, want ${want}`)
}

// Four steps over 24 s: a new one every 6 s.
eq(stepAt(0, 4, 24), 0, 'starts on the first step')
eq(stepAt(5.9, 4, 24), 0, 'first step until its share is up')
eq(stepAt(6, 4, 24), 1, 'second step at 6 s')
eq(stepAt(18, 4, 24), 3, 'last step at 18 s')
eq(stepAt(77, 4, 24), 3, 'a slow free model holds on the last step, never past it')
eq(stepAt(-1, 4, 24), 0, 'clock skew stays on the first step')
eq(stepAt(30, 1, 24), 0, 'one step never moves')
eq(stepAt(30, 0, 24), 0, 'no steps falls back to the label')

console.log('ai-wait ok')
