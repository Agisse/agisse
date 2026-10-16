// Live switches: an admin changes a limit in /admin without a redeploy. A `setting` row overrides the env var of the same name;
// without rows (self-hosters who never touch it) the env stays in charge.
import type { Db } from '../db'
import { schema } from '../db'

export const SWITCHES = ['GLOBAL_DAILY_USD_CAP', 'FREE_DAILY_ACTIONS', 'FREE_DAILY_ACTIONS_ALL', 'MONTHLY_BUDGET_EUR', 'FEED_DAILY_PAGES', 'CHATGPT_PLAN'] as const
export type Switch = (typeof SWITCHES)[number]
export type SwitchRow = { key: Switch; value: string; updatedBy: string | null; updatedAt: Date }

const TTL_MS = 60_000
// ponytail: per-isolate cache, so another isolate sees a change up to a minute late; a KV binding if that ever matters.
let cache: { at: number; rows: SwitchRow[] } | undefined

export const isSwitch = (key: string): key is Switch => (SWITCHES as readonly string[]).includes(key)

export async function switchRows(db: Db, fresh = false): Promise<SwitchRow[]> {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.rows
  try {
    const rows = (await db.select().from(schema.setting)).filter((r): r is SwitchRow => isSwitch(r.key))
    cache = { at: Date.now(), rows }
    return rows
  } catch (err) {
    // A failed read never takes the app down: keep the last values, or the env's.
    console.error('settings read failed', err instanceof Error ? err.message : err)
    return cache?.rows ?? []
  }
}

/** The env with the live switches applied. */
export const withSwitches = <E extends object>(env: E, rows: SwitchRow[]): E => ({ ...env, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) })

/** After an admin's change: this isolate reads again at once. */
export const forgetSwitches = () => {
  cache = undefined
}
