// Run: npx tsx worker/lib/chatgpt.check.ts
import { freshGrant } from './byok.ts'
import { authorizeUrl, chatgptAvailable, ChatgptError, exchangeCode, hostId, pkce, readStream, redirectUri, refreshGrant, type Grant } from './chatgpt.ts'
import { generateStructured } from './openrouter.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}
const b64url = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const jwt = (c: Record<string, unknown>) => `e30.${btoa(JSON.stringify(c)).replace(/=+$/, '')}.sig`

// Off unless local or switched on; the callback is 127.0.0.1 locally, never localhost.
eq([chatgptAvailable({}), chatgptAvailable({ CHATGPT_PLAN: '0' }), chatgptAvailable({ AGISSE_LOCAL: '1' }), chatgptAvailable({ CHATGPT_PLAN: '1' })], [false, false, true, true], 'availability')
eq(redirectUri({ AGISSE_LOCAL: '1', APP_URL: 'http://localhost:5180' }), 'http://127.0.0.1:5180/auth/chatgpt', 'local redirect')
eq(redirectUri({ APP_URL: 'https://agisse.xyz' }), 'https://agisse.xyz/auth/chatgpt', 'hosted redirect')

// PKCE: S256 of the verifier, fresh per attempt.
const a = await pkce()
const b = await pkce()
eq(a.challenge, b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(a.verifier))), 'S256 challenge')
eq([a.verifier.length >= 43, a.verifier !== b.verifier, a.nonce !== b.nonce], [true, true, true], 'fresh verifier and nonce')

// One stable urn:uuid per install secret.
const host = await hostId('secret-a')
eq([host === (await hostId('secret-a')), host === (await hostId('secret-b')), /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(host)], [true, false, true], 'host id')

const q = new URL(authorizeUrl({ hostId: host, redirect: 'http://127.0.0.1:5180/auth/chatgpt', state: 's', challenge: a.challenge, nonce: a.nonce })).searchParams
eq(Object.fromEntries(q), {
  client_id: 'dynamic_agent_client', agent_name_hint: 'Agisse', ext_agent_host_id: host, response_type: 'code', redirect_uri: 'http://127.0.0.1:5180/auth/chatgpt',
  scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct', resource: 'https://api.openai.com/v1', state: 's', nonce: a.nonce, code_challenge_method: 'S256', code_challenge: a.challenge,
}, 'authorize params')

// Code exchange: the issued client id, PKCE verifier and resource go to the token endpoint; the ID token's nonce, issuer and audience must match.
let sent: URLSearchParams[] = []
let reply: () => Response = () => new Response('{}', { status: 500 })
globalThis.fetch = (async (_url: string, init?: RequestInit) => {
  sent.push(new URLSearchParams(String(init?.body ?? '')))
  return reply()
}) as typeof fetch
const idt = (over: Record<string, unknown> = {}) => jwt({ iss: 'https://auth.openai.com', aud: 'oaiapp_1', exp: Date.now() / 1000 + 600, nonce: 'n1', name: 'Sam', ...over })
const tokens = (over: Record<string, unknown> = {}) => () => Response.json({ access_token: 'at1', refresh_token: 'rt1', id_token: idt(), expires_in: 3600, scope: 'openid chatgpt.tokens.use.direct', ...over })
const exch = (query: Record<string, string>) => exchangeCode({ query: { code: 'c1', client_id: 'oaiapp_1', ...query }, verifier: 'v1', nonce: 'n1', redirect: 'http://127.0.0.1:5180/auth/chatgpt' })

reply = tokens()
const g = await exch({})
eq([g.clientId, g.access, g.refresh, g.name], ['oaiapp_1', 'at1', 'rt1', 'Sam'], 'grant')
eq(Object.fromEntries(sent[0]), { grant_type: 'authorization_code', client_id: 'oaiapp_1', code: 'c1', code_verifier: 'v1', redirect_uri: 'http://127.0.0.1:5180/auth/chatgpt', resource: 'https://api.openai.com/v1' }, 'token body')
const fails = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof ChatgptError ? 'user' : 'internal'))
reply = tokens({ id_token: idt({ nonce: 'other' }) })
eq(await fails(exch({})), 'internal', 'nonce mismatch rejected')
reply = tokens({ id_token: idt({ aud: 'oaiapp_2' }) })
eq(await fails(exch({})), 'internal', 'audience mismatch rejected')
reply = tokens({ scope: 'openid email' })
eq(await fails(exch({})), 'user', 'no plan-usage grant: sharing is off')
sent = []
eq([await fails(exch({ error: 'access_denied' })), await fails(exch({ client_id: 'dynamic_agent_client' })), sent.length], ['user', 'user', 0], 'cancel and missing client id: no exchange')

// Refresh: rotating refresh token, issued client id, no scope; a dead token means connect again.
sent = []
reply = () => Response.json({ access_token: 'at2', refresh_token: 'rt2', expires_in: 3600 })
const r = await refreshGrant(g)
eq([r?.access, r?.refresh, Object.fromEntries(sent[0])], ['at2', 'rt2', { grant_type: 'refresh_token', client_id: 'oaiapp_1', refresh_token: 'rt1', resource: 'https://api.openai.com/v1' }], 'refresh')
reply = () => Response.json({ error: 'refresh_token_reused' }, { status: 400 })
eq(await refreshGrant(g), null, 'dead refresh token')

// freshGrant: untouched while valid; two requests at once share one refresh (tokens rotate); a dead token deletes the row.
const writes: string[] = []
const db = { delete: () => ({ where: async () => writes.push('delete') }), update: () => ({ set: () => ({ where: async () => writes.push('update') }) }) } as unknown as Parameters<typeof freshGrant>[0]
const env = { BETTER_AUTH_SECRET: 'x' } as Env
const soon: Grant = { ...g, expiresAt: Date.now() + 60_000 }
const valid: Grant = { ...g, expiresAt: Date.now() + 3_600_000 }
eq([await freshGrant(db, env, 'u1', valid), writes], [valid, []], 'valid token kept')
sent = []
reply = () => Response.json({ access_token: 'at3', refresh_token: 'rt3', expires_in: 3600 })
const [x, y] = await Promise.all([freshGrant(db, env, 'u1', soon), freshGrant(db, env, 'u1', soon)])
eq([x?.access, y?.access, sent.length, writes], ['at3', 'at3', 1, ['update']], 'one refresh at a time')
reply = () => Response.json({ error: 'invalid_grant' }, { status: 400 })
eq([await freshGrant(db, env, 'u1', soon), writes.at(-1)], [null, 'delete'], 'dead token cleared')
globalThis.fetch = (async () => { throw new Error('offline') }) as typeof fetch
eq((await freshGrant(db, env, 'u1', soon))?.access, 'at1', 'offline: still-valid token kept')

// The stream: only response.completed is success.
const sse = (...evs: object[]) => evs.map((e) => `event: x\ndata: ${JSON.stringify(e)}\n\n`).join('')
eq(readStream(sse({ type: 'response.output_text.delta', delta: '{' }, { type: 'response.completed', response: { model: 'm1', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"a":1}' }] }] } })), { text: '{"a":1}', model: 'm1' }, 'completed')
eq(await Promise.resolve().then(() => readStream(sse({ type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded' } } }))).catch((e) => e.message), 'response.failed subscription_sharing_usage_limit_exceeded', 'failed')

// Routing: a ChatGPT key goes to the Responses API with stream and store set, structured output first, the schema in the prompt when the plan refuses it.
const calls: Array<{ url: string; auth: string; body: Record<string, unknown> }> = []
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  calls.push({ url, auth: new Headers(init?.headers).get('authorization') ?? '', body: init?.body ? JSON.parse(String(init.body)) : {} })
  if (url.endsWith('/models')) return Response.json({ models: [{ slug: 'hidden', visibility: 'hide' }, { slug: 'gpt-x', visibility: 'list' }] })
  if (calls.filter((c) => c.url.endsWith('/responses')).length === 1) return Response.json({ error: { code: 'subscription_sharing_unsupported_capability', param: 'text.format' } }, { status: 400 })
  return new Response(sse({ type: 'response.completed', response: { model: 'gpt-x', output: [{ content: [{ type: 'output_text', text: '{"ok":true}' }] }] } }))
}) as typeof fetch
const out = await generateStructured({ preferredModels: [], system: 'sys', user: 'Mail jane@example.com', schemaName: 't', schema: { type: 'object' }, validate: (v) => v, meter: { tokens: 0, costUsd: 0, byok: { provider: 'chatgpt', key: 'at1', model: '' } } })
const responses = calls.filter((c) => c.url === 'https://api.openai.com/v1/responses')
eq(out, { data: { ok: true }, model: 'gpt-x' }, 'answer')
eq([responses.length, responses.every((c) => c.auth === 'Bearer at1' && c.body.stream === true && c.body.store === false && c.body.model === 'gpt-x')], [2, true], 'Responses API on the plan default')
eq([!!responses[0].body.text, !!responses[1].body.text, String(responses[1].body.instructions).includes('JSON Schema')], [true, false, true], 'schema in the prompt after the plan refused text.format')
eq(JSON.stringify(responses).includes('jane@example.com'), false, 'contact details stripped')
console.log('chatgpt ok')
