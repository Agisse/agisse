// Run: npx tsx worker/lib/export.check.ts
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import * as schema from '../db/schema.ts'
import { EXPORTED, SKIPPED, withoutCost } from './export.ts'

const exported = new Set(Object.values(EXPORTED).map((t) => getTableConfig(t).name))
const withUser = Object.values(schema)
  .filter((t: unknown): t is PgTable => t instanceof PgTable)
  .map(getTableConfig)
  .filter((t) => t.columns.some((c) => c.name === 'user_id'))
  .map((t) => t.name)

for (const name of withUser) {
  if (exported.has(name) === name in SKIPPED) throw new Error(`${name}: list it in exactly one of EXPORTED or SKIPPED`)
}
for (const name of [...exported, ...Object.keys(SKIPPED)]) if (!withUser.includes(name)) throw new Error(`${name} has no user_id column`)
// Owner decision on #67: usage rows are the seeker's data, what we paid for them is not.
if (EXPORTED.usage !== schema.usage) throw new Error('usage belongs in the export')
const row = { costUsd: 0.01 } as typeof schema.usage.$inferSelect
if ('costUsd' in withoutCost([row])[0]) throw new Error('costUsd must stay out of the export')
console.log('export ok')
