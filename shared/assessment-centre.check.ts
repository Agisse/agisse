// Run: npx tsx shared/assessment-centre.check.ts
import { BEHAVIOURS, COUNTRIES, GROUP_BRIEFS, TRAY_PACKS, groupPct, scoreTray } from './assessment-centre.ts'

const fail = (m: string): never => {
  throw new Error(m)
}
const assert = {
  ok: (c: unknown, m = 'not ok') => void (c || fail(m)),
  equal: (a: unknown, b: unknown, m = '') => void (a === b || fail(`${m}: ${String(a)} !== ${String(b)}`)),
  deepEqual: (a: unknown, b: unknown, m = '') => void (JSON.stringify(a) === JSON.stringify(b) || fail(`${m}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`)),
}

assert.equal(Object.keys(COUNTRIES).length, 11)
assert.equal(GROUP_BRIEFS.length, 3)
assert.equal(BEHAVIOURS.length, 6)
assert.equal(groupPct([3, 3, 3, 3, 3, 3]), 100)
assert.equal(groupPct([0, 0, 0, 0, 0, 0]), 0)
assert.equal(groupPct([1, 2, 3, 0, 1, 2]), 50)

for (const pack of TRAY_PACKS) {
  assert.equal(pack.items.length, 12, pack.id)
  assert.equal(new Set(pack.items.map((i) => i.key)).size, 4, `${pack.id} uses all four actions`)
  const perfect = Object.fromEntries(pack.items.map((i) => [i.id, i.key]))
  assert.equal(scoreTray(pack, perfect).pct, 100)
  assert.equal(scoreTray(pack, {}).points, 0, 'unanswered scores nothing')
}
const pack = TRAY_PACKS[0]!
const nowItem = pack.items.find((i) => i.key === 'now')!
const dropItem = pack.items.find((i) => i.key === 'drop')!
assert.equal(scoreTray(pack, { [nowItem.id]: 'schedule' }).points, 0.5, 'now vs schedule is half right')
assert.equal(scoreTray(pack, { [nowItem.id]: 'drop' }).points, 0, 'dropping urgent work scores nothing')
assert.equal(scoreTray(pack, { [dropItem.id]: 'drop', [nowItem.id]: 'now' }).points, 2)
console.log('assessment centre ok')
