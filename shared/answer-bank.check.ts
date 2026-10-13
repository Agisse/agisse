// Run: npx tsx shared/answer-bank.check.ts
import { matchAnswer } from './answer-bank.ts'

const cases: Array<[string, ReturnType<typeof matchAnswer>]> = [
  ['What is your notice period?*', 'notice'],
  ['When can you start?', 'notice'],
  ['Beschikbaar vanaf', 'notice'],
  ['Frühester Eintrittstermin', 'notice'],
  ['Salary expectations (required)', 'salary'],
  ['Gehaltsvorstellung', 'salary'],
  ['Prétentions salariales / rémunération souhaitée', 'salary'],
  ['Are you legally authorized to work in the Netherlands?', 'workAuth'],
  ['Will you now or in the future require visa sponsorship?', 'workAuth'],
  ['Are you willing to relocate?', 'relocate'],
  ['How did you hear about us?', 'heardFrom'],
  ['Comment avez-vous connu notre entreprise ?', 'heardFrom'],
  ["Reference's notice period", null],
  ['First name', null],
  ['Why do you want to join us?', null],
]
for (const [label, want] of cases) if (matchAnswer(label) !== want) throw new Error(`${label} = ${matchAnswer(label)}, want ${want}`)
console.log('answer-bank ok')
