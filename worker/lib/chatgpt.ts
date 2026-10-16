// Sign in with ChatGPT (developers.openai.com/cookbook/articles/sign-in-with-chatgpt): the seeker's own Plus or Pro plan pays for
// their model calls, with no API key. It is not a login for Agisse. Written from OpenAI's protocol docs; OpenAI's DevKit is under a
// noncommercial license that does not fit the AGPL, so none of its code is used.
// OAuth with PKCE, a 127.0.0.1 callback in local mode and dynamic client registration. Tokens are sealed in ai_key like a pasted key
// (worker/lib/byok.ts); this file holds only the protocol.

declare global {
  interface Env {
    /** "1" on `npx agisse` (local/server.ts): ChatGPT plan usage is allowed for locally run open-source apps. */
    AGISSE_LOCAL?: string
    /** "1" turns ChatGPT plan usage on for a hosted server; only after OpenAI admits it from the waitlist. Off by default. */
    CHATGPT_PLAN?: string
  }
}

const AUTH = 'https://auth.openai.com'
export const RESOURCE = 'https://api.openai.com/v1'
const SCOPE = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct'
/** The grant that lets Agisse run requests on the plan; sign-in alone doesn't give it. */
export const DIRECT = 'chatgpt.tokens.use.direct'

export const chatgptAvailable = (env: Pick<Env, 'AGISSE_LOCAL' | 'CHATGPT_PLAN'>) => env.AGISSE_LOCAL === '1' || env.CHATGPT_PLAN === '1'

/** OpenAI accepts only http://127.0.0.1 loopback callbacks for local apps, never localhost; same port and path as the app. */
export function redirectUri(env: { AGISSE_LOCAL?: string; APP_URL: string }) {
  const url = new URL('/auth/chatgpt', env.APP_URL)
  if (env.AGISSE_LOCAL === '1') url.hostname = '127.0.0.1'
  return url.toString()
}

const b64url = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const sha256 = (s: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))

/** Fresh PKCE verifier, its S256 challenge and a nonce, per attempt. */
export async function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)))
  return { verifier, challenge: b64url(await sha256(verifier)), nonce: b64url(crypto.getRandomValues(new Uint8Array(16))) }
}

/** One stable id per install, derived from its auth secret (one per data folder locally), so nothing extra is stored. */
export async function hostId(secret: string) {
  const h = [...new Uint8Array(await sha256(`agisse chatgpt host\0${secret}`)).slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `urn:uuid:${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

export function authorizeUrl(p: { hostId: string; redirect: string; state: string; challenge: string; nonce: string }) {
  const q = new URLSearchParams({
    client_id: 'dynamic_agent_client',
    agent_name_hint: 'Agisse',
    ext_agent_host_id: p.hostId,
    response_type: 'code',
    redirect_uri: p.redirect,
    scope: SCOPE,
    resource: RESOURCE,
    state: p.state,
    nonce: p.nonce,
    code_challenge_method: 'S256',
    code_challenge: p.challenge,
  })
  return `${AUTH}/api/accounts/authorize?${q}`
}

/** What ai_key.sealed holds for ChatGPT. */
export type Grant = { clientId: string; access: string; refresh: string; expiresAt: number; name: string }

/** A message the seeker can act on; anything else is logged and shown as a generic failure. */
export class ChatgptError extends Error {}

/** Refresh errors after which only a new sign-in helps (errors-and-recovery in OpenAI's docs). */
const DEAD = /invalid_grant|invalid_refresh_token|token_expired|refresh_token_(expired|invalidated|reused)/

type TokenResponse = { access_token?: string; refresh_token?: string; id_token?: string; expires_in?: number; scope?: string; error?: string }

async function token(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${AUTH}/api/accounts/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...body, resource: RESOURCE }), signal: AbortSignal.timeout(15_000) })
  const json = (await res.json().catch(() => ({}))) as TokenResponse
  if (!res.ok || !json.access_token) throw new Error(`token ${res.status} ${json.error ?? ''}`)
  return json
}

const hasDirect = (scope: string | undefined) => (scope ?? '').split(/[\s+]+/).includes(DIRECT)

export function claims(jwt: string): Record<string, unknown> {
  const part = jwt.split('.')[1] ?? ''
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))))
}

/** The callback's code for tokens. Throws ChatgptError when the seeker said no or didn't allow plan usage. */
export async function exchangeCode(p: { query: Record<string, string | undefined>; verifier: string; nonce: string; redirect: string }): Promise<Grant> {
  const { code, client_id: clientId, error } = p.query
  if (error) throw new ChatgptError(error === 'access_denied' ? 'ChatGPT sign-in was cancelled.' : 'ChatGPT sign-in did not finish. Try again.')
  // dynamic_agent_client only starts registration; the callback carries the client id OpenAI issued for this account.
  if (!code || !clientId || clientId === 'dynamic_agent_client') throw new ChatgptError('ChatGPT sign-in did not finish. Try again.')
  const t = await token({ grant_type: 'authorization_code', client_id: clientId, code, code_verifier: p.verifier, redirect_uri: p.redirect })
  // The ID token comes straight from the token endpoint over TLS, so issuer, audience, expiry and nonce are checked and the
  // signature is not (OpenID Connect Core 3.1.3.7). ponytail: verify against OpenAI's JWKS if tokens ever arrive another way.
  const id = claims(t.id_token ?? '')
  const aud = Array.isArray(id.aud) ? id.aud : [id.aud]
  if (id.iss !== AUTH || !aud.includes(clientId) || Number(id.exp) * 1000 < Date.now() || id.nonce !== p.nonce) throw new Error('id token did not validate')
  if (!hasDirect(t.scope ?? p.query.scope)) throw new ChatgptError('Allow Agisse to use your ChatGPT plan, then connect again.')
  return { clientId, access: t.access_token!, refresh: t.refresh_token ?? '', expiresAt: Date.now() + (t.expires_in ?? 3600) * 1000, name: String(id.name || id.email || 'ChatGPT') }
}

/** A new access token; null when the refresh token is dead and the seeker must connect again. */
export async function refreshGrant(g: Grant): Promise<Grant | null> {
  try {
    const t = await token({ grant_type: 'refresh_token', client_id: g.clientId, refresh_token: g.refresh })
    if (t.scope && !hasDirect(t.scope)) return null
    return { ...g, access: t.access_token!, refresh: t.refresh_token ?? g.refresh, expiresAt: Date.now() + (t.expires_in ?? 3600) * 1000 }
  } catch (err) {
    if (DEAD.test(String(err))) return null
    throw err
  }
}

/** Ends the session at OpenAI; best effort, as the tokens are deleted here either way. */
export async function revoke(g: Grant) {
  try {
    const { revocation_endpoint: url } = (await (await fetch(`${AUTH}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(10_000) })).json()) as { revocation_endpoint?: string }
    if (url) await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: g.refresh, token_type_hint: 'refresh_token', client_id: g.clientId }), signal: AbortSignal.timeout(10_000) })
  } catch (err) {
    console.warn('[chatgpt] revoke failed', err instanceof Error ? err.message : err)
  }
}

/** The models this plan can use, in OpenAI's order (the first is its default). */
export async function listModels(access: string): Promise<string[]> {
  const res = await fetch(`${RESOURCE}/models`, { headers: { Authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(10_000) })
  if (!res.ok) return []
  const { models } = (await res.json().catch(() => ({}))) as { models?: Array<{ slug: string; visibility?: string }> }
  return (models ?? []).filter((m) => m.visibility === 'list').map((m) => m.slug)
}

/** One Responses API call on the plan. The flow requires stream: true and store: false; the stream is read whole. */
export async function respond(access: string, body: Record<string, unknown>, timeoutMs: number): Promise<{ text: string; model: string }> {
  const res = await fetch(`${RESOURCE}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, stream: true, store: false }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const raw = await res.text()
  if (!res.ok) {
    // Only the code and param: the rest of an error body can quote the input.
    const e = (JSON.parse(raw.trim().startsWith('{') ? raw : '{}') as { error?: { code?: string; param?: string } }).error
    throw new Error(`${res.status} ${e?.code ?? ''} ${e?.param ?? ''}`.trim())
  }
  return readStream(raw)
}

type Event = { type?: string; response?: { model?: string; error?: { code?: string }; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> } }

/** Server-sent events to the final text: only response.completed counts as success. */
export function readStream(raw: string): { text: string; model: string } {
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data:')) continue
    let ev: Event
    try {
      ev = JSON.parse(line.slice(5))
    } catch {
      continue
    }
    if (ev.type === 'response.failed' || ev.type === 'response.incomplete') throw new Error(`${ev.type} ${ev.response?.error?.code ?? ''}`.trim())
    if (ev.type === 'response.completed') {
      const text = (ev.response?.output ?? []).flatMap((o) => o.content ?? []).filter((c) => c.type === 'output_text').map((c) => c.text ?? '').join('')
      return { text, model: ev.response?.model ?? '' }
    }
  }
  throw new Error('stream ended before response.completed')
}

/** A short end-to-end check before the plan is used, as OpenAI asks. Throws ChatgptError when the plan can't run requests. */
export async function testRequest(access: string, model: string) {
  try {
    const { text } = await respond(access, { model, input: [{ role: 'user', content: 'Reply with OK.' }] }, 30_000)
    if (!text.trim()) throw new Error('empty answer')
  } catch (err) {
    console.warn('[chatgpt] test request failed', err instanceof Error ? err.message : err)
    throw new ChatgptError(/not_eligible/.test(String(err)) ? 'This ChatGPT plan cannot be used by other apps. Plus and Pro can.' : /usage_limit/.test(String(err)) ? 'Your ChatGPT plan has reached its usage limit. Try again later.' : 'ChatGPT did not answer a test request. Try again.')
  }
}
