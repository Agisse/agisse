// Run: npx tsx worker/lib/budget.check.ts
import { budgetSpent, pauseFor } from './shared'

const env = { GLOBAL_DAILY_USD_CAP: '15', FREE_DAILY_ACTIONS: '15', FREE_DAILY_ACTIONS_ALL: '600' } as const
const t = { usd: 0, actions: 0, mine: 0, ownKey: false }
const cases: Array<[string, Parameters<typeof pauseFor>, ReturnType<typeof pauseFor>]> = [
  ['fresh', [env, t], undefined],
  ['one under', [env, { ...t, mine: 14, actions: 599 }], undefined],
  ['account limit', [env, { ...t, mine: 15 }], 'you'],
  ['everyone limit first', [env, { ...t, mine: 15, actions: 600 }], 'free'],
  ['USD cap first', [env, { ...t, usd: 15, actions: 600 }], 'cap'],
  ['own key skips free limits', [env, { ...t, mine: 99, actions: 999, ownKey: true }], undefined],
  ['own key still stops at the USD cap', [env, { ...t, usd: 20, ownKey: true }], 'cap'],
  ['"0" means no limit', [{ GLOBAL_DAILY_USD_CAP: '0', FREE_DAILY_ACTIONS: '0', FREE_DAILY_ACTIONS_ALL: '0' }, { usd: 99, actions: 9999, mine: 999, ownKey: false }], undefined],
]
for (const [name, args, want] of cases) if (pauseFor(...args) !== want) throw new Error(`${name}: ${pauseFor(...args)} != ${want}`)

const b = { used: 5, limit: 5, cost: 0, tokens: 0, resetsOn: '' }
for (const paused of ['free', 'you'] as const) if (!budgetSpent({ ...b, paused }).includes('OpenRouter key')) throw new Error(`${paused} message names no key`)
console.log('budget ok')
