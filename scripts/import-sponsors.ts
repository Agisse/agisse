// Loads the public visa-sponsor registers into the `sponsor` table. Run after migration 0028, and again every few months:
//   npx tsx --env-file=.env scripts/import-sponsors.ts           (writes to DATABASE_URL)
//   npx tsx scripts/import-sponsors.ts --dry                      (downloads and parses only)
// NL: the IND register of recognised sponsors for highly skilled migrants (an HTML table).
// UK: the Home Office register of licensed sponsors, Skilled Worker and Graduate Trainee routes (a CSV linked from GOV.UK).
import { eq } from 'drizzle-orm'
import { createDb, schema } from '../worker/db'
import { sponsorKey, type SponsorCountry } from '../shared/sponsors'

const NL_PAGE = 'https://ind.nl/en/public-register-recognised-sponsors/public-register-regular-labour-and-highly-skilled-migrants'
const UK_PAGE = 'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers'
const UK_ROUTES = new Set(['Skilled Worker', 'Global Business Mobility: Graduate Trainee'])

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim()

async function text(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return res.text()
}

async function nl(): Promise<string[]> {
  const html = await text(NL_PAGE)
  return [...html.matchAll(/<th scope="row">([\s\S]*?)<\/th>/g)].map((m) => decode(m[1]!.replace(/<[^>]+>/g, '')))
}

/** One CSV line into fields; quoted fields may hold commas and doubled quotes. */
function csvLine(line: string) {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted && ch === '"' && line[i + 1] === '"') {
      cur += '"'
      i++
    } else if (ch === '"') quoted = !quoted
    else if (ch === ',' && !quoted) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  return [...out, cur]
}

async function uk(): Promise<string[]> {
  const page = await text(UK_PAGE)
  const csvUrl = /https:\/\/assets\.publishing\.service\.gov\.uk\/[^"]+\.csv/.exec(page)?.[0]
  if (!csvUrl) throw new Error('No CSV link on the GOV.UK register page')
  // ponytail: assumes no line breaks inside quoted fields; the register has none.
  const [head, ...lines] = (await text(csvUrl)).split(/\r?\n/)
  const cols = csvLine(head!)
  const name = cols.indexOf('Organisation Name')
  const route = cols.indexOf('Route')
  if (name < 0 || route < 0) throw new Error(`Unexpected CSV columns: ${cols.join(', ')}`)
  return lines.map(csvLine).filter((f) => UK_ROUTES.has(f[route]?.trim() ?? '')).map((f) => f[name]!.trim())
}

/** Unique keys, keeping the first name seen for each. */
export function rowsFor(country: SponsorCountry, names: string[]) {
  const byKey = new Map<string, string>()
  for (const n of names) {
    const key = sponsorKey(n)
    if (key.length >= 2 && !byKey.has(key)) byKey.set(key, n.slice(0, 200))
  }
  return [...byKey].map(([key, name]) => ({ key, country, name }))
}

const dry = process.argv.includes('--dry')
const lists = { NL: rowsFor('NL', await nl()), GB: rowsFor('GB', await uk()) }
for (const [country, rows] of Object.entries(lists)) console.log(country, rows.length, 'sponsors, e.g.', rows.slice(0, 3).map((r) => r.name).join(' | '))
if (dry) process.exit(0)

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set (use --env-file=.env)')
const db = createDb(url)
for (const [country, rows] of Object.entries(lists) as [SponsorCountry, ReturnType<typeof rowsFor>][]) {
  // ponytail: delete-then-insert, not one transaction (neon-http); the feed briefly sees a partial list during an import.
  await db.delete(schema.sponsor).where(eq(schema.sponsor.country, country))
  for (let i = 0; i < rows.length; i += 2000) await db.insert(schema.sponsor).values(rows.slice(i, i + 2000)).onConflictDoNothing()
  console.log(country, 'imported')
}
