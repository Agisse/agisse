// Run: npx tsx scripts/hired.check.ts
// The README's Hired Wall count equals the rows in HIRED.md, withdrawn stories included. At 0 rows the README has no Hired line.
import { readFileSync } from 'node:fs'
import { hiredRows as rows, repoNumbers } from '../worker/lib/github'
const counter = (md: string) => Number(md.match(/Hired with Agisse: \[(\d+) stor(?:y|ies)\]\(HIRED\.md\)/)?.[1] ?? 0)

const eq = (got: unknown, want: unknown, what: string) => {
  if (got !== want) throw new Error(`${what} = ${got}, want ${want}`)
}
eq(rows('| # | Who | Role | Story |\n|---|---|---|---|\n| 1 | @a | Nurse | #1 |\n| 2 | | Story withdrawn | #2 |\n'), 2, 'rows')
eq(counter('Hired with Agisse: [1 story](HIRED.md).'), 1, 'counter')
eq(counter('No line yet.'), 0, 'counter, no line')

// The launch homepage's numbers: null for anything GitHub doesn't answer, never a zero.
const fake = (pages: Record<string, unknown>) => (async (url: string) =>
  url in pages ? new Response(typeof pages[url] === 'string' ? (pages[url] as string) : JSON.stringify(pages[url])) : new Response('', { status: 404 })) as typeof fetch
const api = 'https://api.github.com/repos/Agisse/agisse'
const raw = 'https://raw.githubusercontent.com/Agisse/agisse/main/HIRED.md'
const both = await repoNumbers(fake({ [api]: { stargazers_count: 12 }, [raw]: '| 1 | @a | Nurse | #1 |\n' }))
eq(`${both.stars} ${both.hired}`, '12 1', 'repoNumbers')
const none = await repoNumbers(fake({}))
eq(`${none.stars} ${none.hired}`, 'null null', 'repoNumbers, private repo')

const wall = rows(readFileSync('HIRED.md', 'utf8'))
const md = readFileSync('README.md', 'utf8')
if (/Hired with Agisse: \[0 /.test(md)) throw new Error('README.md shows the Hired line at 0 stories; leave it out until the first row in HIRED.md')
const readme = counter(md)
if (readme !== wall) throw new Error(`README.md says ${readme} hired stories, HIRED.md has ${wall} rows`)
console.log(`hired: ${wall} stories, README matches`)
