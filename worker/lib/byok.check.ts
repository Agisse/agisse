// Run: npx tsx worker/lib/byok.check.ts
import { keyLooksValid, open, seal } from './byok.ts'

const sealed = await seal('secret', 'user-a', 'sk-ant-abc')
if ((await open('secret', 'user-a', sealed)) !== 'sk-ant-abc') throw new Error('round trip failed')
for (const [secret, user] of [['secret', 'user-b'], ['other', 'user-a']]) {
  if (await open(secret, user, sealed).then(() => true, () => false)) throw new Error(`opened with ${secret}/${user}`)
}
const k = 'x'.repeat(30)
const cases: Array<[Parameters<typeof keyLooksValid>, boolean]> = [
  [['openai', `sk-proj-${k}`], true],
  [['openai', `sk-ant-${k}`], false],
  [['openai', `sk-or-v1-${k}`], false],
  [['anthropic', `sk-ant-api03-${k}`], true],
  [['anthropic', `sk-${k}`], false],
  [['openrouter', `sk-or-v1-${k}`], true],
  [['openai', `sk-${k} x`], false],
  [['gemini', `AIzaSy${k}`], true],
  [['gemini', `sk-${k}`], false],
  [['mistral', k], true],
  [['mistral', 'short'], false],
]
for (const [args, want] of cases) if (keyLooksValid(...args) !== want) throw new Error(`keyLooksValid(${args.join(', ')}) != ${want}`)
console.log('byok ok')
