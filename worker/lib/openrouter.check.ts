// Run: npx tsx worker/lib/openrouter.check.ts
import { freeModels, generateStructured, NoAiKey, smartModels, transcribe } from './openrouter.ts'

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
// No server key and no own key: a clear "connect your key" error before any request. With an own key, that key is used.
const auths: string[] = []
globalThis.fetch = (async (_url: string, init?: RequestInit) => {
  auths.push(new Headers(init?.headers).get('authorization') ?? '')
  return new Response('{}', { status: 500 })
}) as typeof fetch
const call = { apiKey: '', preferredModels: ['a/new'], system: 's', user: 'u', schemaName: 't', schema: {}, validate: (x: unknown) => x, deadlineMs: 20_000 }
const noKey = await generateStructured(call).catch((e) => e)
eq([noKey instanceof NoAiKey, auths.length], [true, 0], 'no key: NoAiKey without a request')
eq(await transcribe({ apiKey: '', model: 'a/audio', audio: 'x', format: 'webm' }).catch((e) => e instanceof NoAiKey), true, 'transcribe without a key')
await generateStructured({ ...call, meter: { tokens: 0, costUsd: 0, byok: { provider: 'openrouter', key: 'sk-own', model: '' } } }).catch(() => {})
eq(auths.length > 0 && auths.every((a) => a === 'Bearer sk-own'), true, 'own key used for every request')
console.log('openrouter ok')
