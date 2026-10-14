// Run: npx tsx worker/lib/budget.check.ts
import { budgetSpent, creditFor, eurPerUsd, pauseFor } from './shared'

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
// One-time credit: Haiku first while credit is left; never on an own key or a trial account; nothing once it's 0.
const money = { USD_TO_EUR: '0.9', PRICE_MARGIN: '0.3333333333', OPENROUTER_CREDIT_MODELS: 'anthropic/claude-haiku-5.5' }
if (Math.abs(eurPerUsd(money) - 1.35) > 1e-6) throw new Error(`$1 should cost €1.35 (cost + 50%), got ${eurPerUsd(money)}`)
if (creditFor(money, 3.2, false, false)?.models[0] !== 'anthropic/claude-haiku-5.5') throw new Error('credit left: Haiku first')
const none: Array<[string, number | null, boolean, boolean]> = [['spent', 0, false, false], ['none', null, false, false], ['own key', 5, true, false], ['trial', 5, false, true]]
for (const [name, credit, ownKey, trial] of none) if (creditFor(money, credit, ownKey, trial)) throw new Error(`${name}: no credit models`)
if (creditFor({ ...money, OPENROUTER_CREDIT_MODELS: '' }, 5, false, false)) throw new Error('no credit models set: free chain only')
console.log('budget ok')
