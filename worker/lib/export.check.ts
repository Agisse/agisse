// Run: npx tsx worker/lib/export.check.ts
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import * as schema from '../db/schema.ts'
import { EXPORTED, SKIPPED } from './export.ts'

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
console.log('export ok')
