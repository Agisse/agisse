// Run: npx tsx scripts/fixtures.check.ts (CI: URLs only), or npx tsx --env-file=.env scripts/fixtures.check.ts
// Committed fixtures, results and the seed stay synthetic: no URL outside example.com (and agisse.xyz itself), and,
// with a (development) DATABASE_URL, no employer name from the feed. That denylist is read at run time and never written.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'

const files = execSync('git ls-files eval/fixtures eval/results scripts/seed.ts', { encoding: 'utf8' }).split('\n').filter(Boolean)
const texts = files.map((f) => [f, readFileSync(f, 'utf8')] as const)

const urlProblems = (text: string) =>
  [...text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1].toLowerCase()).filter((h) => !/(^|\.)(example\.com|agisse\.xyz)$/.test(h))

const word = (n: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'u')
// A one-word name the text also uses in lower case ("Engineering", "engineering") is an ordinary word there.
const nameProblems = (text: string, names: string[]) =>
  names.filter((n) => text.includes(n) && word(n).test(text) && !(!/\s/.test(n) && word(n.toLowerCase()).test(text)))

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}
eq(urlProblems('see https://jobs.example.com/1 and http://example.com'), [], 'example.com allowed')
eq(urlProblems('"url": "https://careers.acme.io/x"'), ['careers.acme.io'], 'other host flagged')
eq(urlProblems('https://agisse.xyz/docs/'), [], 'agisse.xyz allowed')
eq(nameProblems('Analyst at Acme Group, Brussels', ['Acme Group', 'Acme Groups', 'Brus']), ['Acme Group'], 'whole names only')
eq(nameProblems('Engineering team; civil engineering', ['Engineering']), [], 'ordinary word')
eq(nameProblems('Intern at Acme; Python', ['Acme']), ['Acme'], 'one-word name')

const problems = texts.flatMap(([f, t]) => urlProblems(t).map((h) => `${f}: URL on ${h}`))

const url = process.env.DATABASE_URL
if (url) {
  const sql = neon(url)
  // Shorter names ("Data", "Apple") would mostly flag ordinary words.
  const rows = (await sql`select distinct company from vacancy where length(company) >= 6 and source <> 'seed'`) as { company: string }[]
  const names = rows.map((r) => r.company.trim())
  // Name the file only: the match itself is feed data and must not land in a CI log or a PR.
  for (const [f, t] of texts) { const n = nameProblems(t, names).length; if (n) problems.push(`${f}: ${n} employer name(s) from the feed`) }
}

if (problems.length) throw new Error(`Fixtures must be synthetic:\n${problems.join('\n')}`)
console.log(`fixtures ok (${files.length} files${url ? ', feed employers checked' : ', no DATABASE_URL: URLs only'})`)
