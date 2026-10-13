// Run: npx tsx worker/lib/exa.check.ts
import { normalizeProfileUrl } from './exa.ts'

const want = 'https://www.linkedin.com/in/jane-doe'
const cases: [string, string][] = [
  ['https://nl.linkedin.com/in/Jane-Doe/?trk=abc', want],
  ['http://www.linkedin.com/in/jane-doe', want],
  ['linkedin.com/in/jane-doe/', want],
  [' https://www.linkedin.com/in/jane-doe#about ', want],
  ['https://www.linkedin.com/in/j%C3%B6rg-m', 'https://www.linkedin.com/in/jörg-m'],
  ['https://www.linkedin.com/in/bad%E0%A4%A', 'https://www.linkedin.com/in/bad%e0%a4%a'],
  ['https://GitHub.com/JaneDoe/?tab=repos', 'https://github.com/JaneDoe'],
  ['not a url', 'not a url'],
  ['', ''],
]
for (const [input, expected] of cases) {
  const got = normalizeProfileUrl(input)
  if (got !== expected) throw new Error(`normalizeProfileUrl(${JSON.stringify(input)}) = ${got}, want ${expected}`)
}
console.log('exa ok')
