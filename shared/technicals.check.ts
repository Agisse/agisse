// Run: npx tsx shared/technicals.check.ts
import { BOX_DAYS, CARDS, dueCards, schedule } from './technicals.ts'

const fail = (m: string): never => {
  throw new Error(m)
}
const assert = {
  ok: (c: unknown, m = 'not ok') => void (c || fail(m)),
  equal: (a: unknown, b: unknown, m = '') => void (a === b || fail(`${m}: ${String(a)} !== ${String(b)}`)),
  deepEqual: (a: unknown, b: unknown, m = '') => void (JSON.stringify(a) === JSON.stringify(b) || fail(`${m}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`)),
}

const DAY = 86_400_000
assert.ok(CARDS.filter((c) => c.deck === 'finance').length >= 40)
assert.ok(CARDS.filter((c) => c.deck === 'business').length >= 15)
assert.equal(new Set(CARDS.map((c) => c.id)).size, CARDS.length, 'unique ids')
assert.ok(CARDS.every((c) => (c.deck === 'finance') === Boolean(c.topic)), 'every finance card has a banking topic, no business card does')

const now = 1_000 * DAY
assert.deepEqual(schedule(undefined, 'good', now), { box: 1, due: now + DAY })
assert.deepEqual(schedule(undefined, 'easy', now), { box: 2, due: now + 3 * DAY })
assert.deepEqual(schedule({ box: 3, due: 0 }, 'again', now), { box: 0, due: now + 60_000 }, 'again comes back this session')
assert.equal(schedule({ box: 3, due: 0 }, 'hard', now).box, 3, 'hard stays in its box')
assert.ok(schedule({ box: 3, due: 0 }, 'hard', now).due < schedule({ box: 3, due: 0 }, 'good', now).due, 'hard comes back sooner than good')
assert.equal(schedule({ box: BOX_DAYS.length - 1, due: 0 }, 'easy', now).box, BOX_DAYS.length - 1, 'top box caps')

const deck = CARDS.slice(0, 5)
const states = { [deck[0]!.id]: { box: 1, due: now - 2 }, [deck[1]!.id]: { box: 2, due: now + DAY }, [deck[2]!.id]: { box: 1, due: now - 5 } }
assert.deepEqual(dueCards(deck, states, now, 1).map((c) => c.id), [deck[2]!.id, deck[0]!.id, deck[3]!.id], 'oldest due first, then new up to the limit; not-yet-due skipped')
console.log('technicals ok')
