// Run: npx tsx worker/db/feed-contract.check.ts
// docs/feed-contract.md is the public interface for feed providers; this fails when the schema drifts from it.
import { readFileSync } from 'node:fs'
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core'
import { profileEmbedding, vacancy, vacancyFit } from './schema.ts'
import { PROGRAM_LABEL, VACANCY_FUNCTIONS } from '../../shared/listings.ts'

const doc = readFileSync('docs/feed-contract.md', 'utf8')

// "| `name` | type | yes/no | ..." rows under the table's own "## `name`" heading.
const documented = (table: string) => {
  const section = doc.split(/^## /m).find((s) => s.startsWith(`\`${table}\``))
  if (!section) throw new Error(`docs/feed-contract.md has no "## \`${table}\`" section`)
  return [...section.matchAll(/^\| `([a-z_]+)` \| ([^|]+) \| (yes|no) \|/gm)].map((m) => `${m[1]} ${m[2]!.trim()} ${m[3]}`)
}
// Required means a writer must set it: not null, no default, not generated.
const actual = (t: PgTable) =>
  getTableConfig(t).columns.map((c) => `${c.name} ${c.getSQLType()} ${c.notNull && !c.hasDefault && !c.generated ? 'yes' : 'no'}`)

for (const t of [vacancy, vacancyFit, profileEmbedding]) {
  const name = getTableConfig(t).name
  const [got, want] = [actual(t), documented(name)]
  const missing = got.filter((c) => !want.includes(c))
  const stale = want.filter((c) => !got.includes(c))
  if (missing.length || stale.length) throw new Error(`${name}: schema has ${JSON.stringify(missing)}, doc has ${JSON.stringify(stale)}`)
}

// Every allowed value is spelled out, so a provider never has to read the code.
for (const k of [...Object.keys(VACANCY_FUNCTIONS), ...Object.keys(PROGRAM_LABEL)]) {
  if (!doc.includes(`\`${k}\``)) throw new Error(`docs/feed-contract.md doesn't list \`${k}\``)
}

console.log('feed contract ok')
