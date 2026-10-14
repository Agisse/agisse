// Run: npx tsx scripts/hired.check.ts
// The README's Hired Wall count equals the rows in HIRED.md, withdrawn stories included.
import { readFileSync } from 'node:fs'

const rows = (md: string) => md.split('\n').filter((l) => /^\|\s*\d+\s*\|/.test(l)).length
const counter = (md: string) => Number(md.match(/Hired with Agisse: \[(\d+) stor(?:y|ies)\]\(HIRED\.md\)/)?.[1] ?? NaN)

const eq = (got: unknown, want: unknown, what: string) => {
  if (got !== want) throw new Error(`${what} = ${got}, want ${want}`)
}
eq(rows('| # | Who | Role | Story |\n|---|---|---|---|\n| 1 | @a | Nurse | #1 |\n| 2 | | Story withdrawn | #2 |\n'), 2, 'rows')
eq(counter('Hired with Agisse: [1 story](HIRED.md).'), 1, 'counter')

const wall = rows(readFileSync('HIRED.md', 'utf8'))
const readme = counter(readFileSync('README.md', 'utf8'))
if (readme !== wall) throw new Error(`README.md says ${readme} hired stories, HIRED.md has ${wall} rows`)
console.log(`hired: ${wall} stories, README matches`)
