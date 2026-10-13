// Run: npx tsx src/lib/geo.check.ts
import { geocodable, parseGeo, spread } from './geo.ts'

const ok = (cond: boolean, msg: string) => { if (!cond) throw new Error(msg) }

ok(parseGeo([{ lon: '4.35', lat: '50.85' }, { lon: '0', lat: '0' }])?.join() === '4.35,50.85', 'parses first point')
ok(parseGeo([]) === null, 'no hits → null')
ok(parseGeo(null) === null, 'null body → null')
ok(parseGeo([{ lon: 'x', lat: '1' }]) === null, 'bad coords → null')

ok(geocodable('Brussels, Belgium'), 'city geocodable')
ok(!geocodable('Remote') && !geocodable(' fully remote ') && !geocodable('') && !geocodable(null), 'remote/empty skipped')

ok(spread([4, 50], 0).join() === '4,50', 'first pin stays put')
ok(spread([4, 50], 1).join() !== '4,50', 'second pin moves')

console.log('geo ok')
