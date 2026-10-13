// Run: npx tsx worker/lib/openrouter.check.ts
import { freeModels, smartModels } from './openrouter.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

const so = ['structured_outputs']
const m = (id: string, completion: string, created: number, ctx = 128_000, params = so) => ({ id, context_length: ctx, pricing: { prompt: completion, completion }, supported_parameters: params, created })
const catalog = [
  m('a/old', '0.0000005', 1),
  m('a/new', '0.000001', 3),
  m('a/pricey', '0.00001', 4),
  m('a/free:free', '0', 5),
  m('a/new:batch', '0.0000005', 3),
  m('~a/latest', '0.000001', 6),
  m('a/nojson', '0.000001', 7, 128_000, []),
  m('a/small', '0.000001', 8, 32_000),
]

eq(smartModels(catalog, 2), ['a/new', 'a/old'], 'smartModels')
eq(freeModels([...catalog, m('a/plain:free', '0', 9, 128_000, [])]), ['a/free:free', 'a/plain:free'], 'freeModels')
console.log('openrouter ok')
