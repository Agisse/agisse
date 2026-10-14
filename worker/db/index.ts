import { AsyncLocalStorage } from 'node:async_hooks'
import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

export type Db = ReturnType<typeof createDb>

// Each query is one HTTP round trip to Neon; count them per request for the Server-Timing header.
export const dbTiming = new AsyncLocalStorage<{ queries: number; ms: number }>()
neonConfig.fetchFunction = async (...args: Parameters<typeof fetch>) => {
  const start = Date.now()
  try {
    return await fetch(...args)
  } finally {
    const t = dbTiming.getStore()
    if (t) {
      t.queries++
      t.ms += Date.now() - start
    }
  }
}

export function createDb(databaseUrl: string) {
  return drizzle(neon(databaseUrl), { schema, casing: 'snake_case' })
}

export { schema }
