// Run: npx tsx scripts/mcp-smoke.ts   (env: MCP_URL=https://agisse.xyz, AGISSE_EMAIL + AGISSE_PASSWORD for the OAuth tier, or MCP_TOKEN to skip straight to the tool tier)
// Read-only regression suite against a live Agisse MCP server. Never calls draft_outreach and never writes a status, job or company.
import { createHash, randomBytes } from 'node:crypto'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { REPLY_STATUSES } from '../shared/types'

const ORIGIN = new URL(process.env.MCP_URL ?? 'https://agisse.xyz').origin
const MCP = `${ORIGIN}/mcp`
const REDIRECT_URI = 'http://127.0.0.1:8976/callback'

let failed = 0
const ok: (cond: unknown, what: string) => asserts cond = (cond, what) => {
  if (!cond) throw new Error(`expected ${what}`)
}
async function check(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    console.log(`✓ ${name}`)
  } catch (err) {
    failed++
    console.log(`✗ ${name}: ${err instanceof Error ? err.message : err}`)
  }
}
const skip = (name: string, why: string) => console.log(`skip ${name}: ${why}`)

const getJson = async (path: string) => {
  const res = await fetch(ORIGIN + path)
  ok(res.status === 200, `GET ${path} → 200, got ${res.status}`)
  return (await res.json()) as Record<string, any>
}
const b64url = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url')
const initBody = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'mcp-smoke', version: '1' } } })

/** POSTs an MCP initialize with the given Authorization and asserts the 401 challenge. */
async function expectChallenge(auth: string | undefined) {
  const res = await fetch(MCP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(auth ? { Authorization: auth } : {}) },
    body: initBody,
  })
  ok(res.status === 401, `401, got ${res.status}`)
  const www = res.headers.get('www-authenticate') ?? ''
  ok(www.includes(`resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/mcp"`), `WWW-Authenticate with resource_metadata, got "${www}"`)
}

// ---------- Tier A: unauthenticated ----------
console.log(`# Tier A: unauthenticated (${ORIGIN})`)
let asMeta: Record<string, any> = {}
let clientId: string | undefined

await check('GET /.well-known/oauth-authorization-server', async () => {
  asMeta = await getJson('/.well-known/oauth-authorization-server')
  ok(asMeta.issuer === `${ORIGIN}/api/auth`, `issuer ${ORIGIN}/api/auth, got ${asMeta.issuer}`)
  ok(asMeta.code_challenge_methods_supported?.includes('S256'), 'S256 PKCE support')
  ok(typeof asMeta.registration_endpoint === 'string', 'registration_endpoint')
})
await check('GET /.well-known/openid-configuration', async () => {
  const oidc = await getJson('/.well-known/openid-configuration')
  ok(oidc.issuer === asMeta.issuer, `issuer ${asMeta.issuer}, got ${oidc.issuer}`)
  ok(oidc.token_endpoint === asMeta.token_endpoint, 'same token_endpoint as AS metadata')
})
await check('GET /.well-known/oauth-protected-resource/mcp', async () => {
  const prm = await getJson('/.well-known/oauth-protected-resource/mcp')
  ok(prm.resource === MCP, `resource ${MCP}, got ${prm.resource}`)
  ok(prm.authorization_servers?.includes(asMeta.issuer), `authorization_servers includes ${asMeta.issuer}`)
})
await check('POST /mcp without token → 401 challenge', () => expectChallenge(undefined))
await check('POST /mcp with garbage bearer → 401 challenge', () => expectChallenge('Bearer not-a-token'))
await check('POST /mcp with forged unsigned JWT → 401 (not 500)', () => {
  const now = Math.floor(Date.now() / 1000)
  const claims = { iss: asMeta.issuer, aud: MCP, sub: 'forged', iat: now, exp: now + 600, scope: 'openid' }
  return expectChallenge(`Bearer ${b64url({ alg: 'EdDSA', typ: 'JWT', kid: 'forged' })}.${b64url(claims)}.${randomBytes(64).toString('base64url')}`)
})
await check('dynamic client registration', async () => {
  const res = await fetch(asMeta.registration_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'agisse mcp-smoke',
      application_type: 'native', // the default 'web' type rejects http loopback redirect URIs
      redirect_uris: [REDIRECT_URI],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    }),
  })
  const body = (await res.json().catch(() => ({}))) as Record<string, any>
  ok(res.status === 200 || res.status === 201, `200/201, got ${res.status} ${JSON.stringify(body)}`)
  ok(typeof body.client_id === 'string', 'client_id in response')
  clientId = body.client_id
})

// ---------- Tier B: full OAuth ----------
console.log('# Tier B: OAuth authorization code + PKCE')
let token = process.env.MCP_TOKEN
const { AGISSE_EMAIL, AGISSE_PASSWORD } = process.env
if (token) skip('OAuth flow', 'MCP_TOKEN set')
else if (!AGISSE_EMAIL || !AGISSE_PASSWORD) skip('OAuth flow', 'set AGISSE_EMAIL and AGISSE_PASSWORD (or MCP_TOKEN)')
else if (!clientId) skip('OAuth flow', 'client registration failed')
else {
  const jar = new Map<string, string>()
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  const keep = (res: Response) => {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';')
      const i = pair!.indexOf('=')
      jar.set(pair!.slice(0, i).trim(), pair!.slice(i + 1).trim())
    }
    return res
  }
  const verifier = randomBytes(32).toString('base64url')
  const state = randomBytes(16).toString('base64url')
  let code: string | undefined
  let refresh: string | undefined

  await check('sign in (email/password)', async () => {
    const res = keep(await fetch(`${ORIGIN}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({ email: AGISSE_EMAIL, password: AGISSE_PASSWORD }),
    }))
    ok(res.status === 200, `200, got ${res.status} ${await res.text()}`)
    ok(jar.size > 0, 'a session cookie')
  })

  await check('authorize + consent → code', async () => {
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: clientId!,
      redirect_uri: REDIRECT_URI,
      scope: asMeta.scopes_supported?.includes('offline_access') ? 'openid offline_access' : 'openid',
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      resource: MCP,
    })
    let url = `${asMeta.authorization_endpoint}?${q}`
    for (let hop = 0; hop < 6 && !url.startsWith(REDIRECT_URI); hop++) {
      const next = new URL(url, ORIGIN)
      if (next.pathname === '/consent') {
        // What src/routes/Consent.tsx does via oauthProviderClient: POST the signed part of the page query as oauth_query.
        const p = next.searchParams
        const signed = new Set(p.getAll('ba_param'))
        const oauthQuery = new URLSearchParams([...p].filter(([k]) => k === 'sig' || k === 'ba_param' || signed.has(k))).toString()
        const res = keep(await fetch(`${ORIGIN}/api/auth/oauth2/consent`, {
          method: 'POST',
          redirect: 'manual',
          headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie() },
          body: JSON.stringify({ accept: true, oauth_query: oauthQuery }),
        }))
        const body = res.status < 300 ? ((await res.json()) as Record<string, any>) : {}
        const to = res.headers.get('location') ?? body.url ?? body.redirect_uri
        ok(to, `consent to redirect, got ${res.status} ${JSON.stringify(body)}`)
        url = to
        continue
      }
      ok(next.origin === ORIGIN && next.pathname.startsWith('/api/auth/'), `redirect to consent or ${REDIRECT_URI}, got ${url}`)
      const res = keep(await fetch(next, { redirect: 'manual', headers: { Cookie: cookie(), Accept: 'text/html' } }))
      const to = res.headers.get('location')
      ok(to, `a redirect from ${next.pathname}, got ${res.status} ${await res.text()}`)
      url = to
    }
    const back = new URL(url).searchParams
    ok(url.startsWith(REDIRECT_URI), `to end at ${REDIRECT_URI}, got ${url}`)
    ok(!back.get('error'), `no error, got ${back.get('error')}: ${back.get('error_description')}`)
    ok(back.get('state') === state, 'state round-trips')
    code = back.get('code') ?? undefined
    ok(code, 'a code')
  })

  const tokenRequest = async (params: Record<string, string>) => {
    const res = await fetch(asMeta.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId!, resource: MCP, ...params }),
    })
    const body = (await res.json().catch(() => ({}))) as Record<string, any>
    ok(res.status === 200, `200, got ${res.status} ${JSON.stringify(body)}`)
    ok(typeof body.access_token === 'string' && body.access_token.split('.').length === 3, 'a JWT access_token')
    const aud = JSON.parse(Buffer.from(body.access_token.split('.')[1], 'base64url').toString()).aud
    ok([aud].flat().includes(MCP), `aud includes ${MCP}, got ${JSON.stringify(aud)}`)
    return body
  }
  if (code) {
    await check('token exchange (authorization_code + code_verifier)', async () => {
      const body = await tokenRequest({ grant_type: 'authorization_code', code: code!, redirect_uri: REDIRECT_URI, code_verifier: verifier })
      token = body.access_token
      refresh = body.refresh_token
    })
    if (!refresh) skip('refresh_token grant', 'no refresh_token issued')
    else
      await check('refresh_token grant (tier C uses the refreshed token)', async () => {
        token = (await tokenRequest({ grant_type: 'refresh_token', refresh_token: refresh! })).access_token
      })
  }
}

// ---------- Tier C: authenticated MCP ----------
console.log('# Tier C: authenticated MCP')
if (!token) skip('authenticated MCP', 'no access token')
else {
  const client = new Client({ name: 'agisse-mcp-smoke', version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(new URL(MCP), { requestInit: { headers: { Authorization: `Bearer ${token}` } } })
  type Result = Awaited<ReturnType<typeof client.callTool>>
  const call = (name: string, args: Record<string, unknown> = {}) => client.callTool({ name, arguments: args }) as Promise<Result>
  const data = (r: Result): any => {
    ok(!r.isError, `success, got error ${JSON.stringify(r.content)}`)
    if (r.structuredContent) return r.structuredContent
    const first = (r.content as { type: string; text?: string }[])[0]
    return JSON.parse(first?.text ?? 'null')
  }
  /** A tool-level failure: isError result or a JSON-RPC error; either way not a transport/500. */
  const rejects = async (name: string, args: Record<string, unknown>, allowProtocolError: boolean) => {
    let r: Result
    try {
      r = await call(name, args)
    } catch (err) {
      ok(allowProtocolError, `isError result, got thrown ${err instanceof Error ? err.message : err}`)
      return
    }
    ok(r.isError === true, `isError, got ${JSON.stringify(r.content)}`)
  }

  let connected = false
  await check('initialize', async () => {
    await client.connect(transport)
    connected = true
    ok(client.getServerVersion()?.name, 'serverInfo')
  })
  if (connected) {
    const { tools } = await client.listTools()
    const tool = (n: string) => tools.find((t) => t.name === n)
    await check('tools/list: readOnlyHint matches list_*/get_* vs writes', () => {
      const bad = tools.filter((t) => t.annotations?.readOnlyHint !== /^(list|get)_/.test(t.name)).map((t) => t.name)
      ok(tools.length > 0 && !bad.length, `correct readOnlyHint on all tools, wrong on ${bad}`)
      ok(tool('update_contact_status')?.annotations?.readOnlyHint === false, 'update_contact_status readOnlyHint false')
      ok(tool('draft_outreach')?.annotations?.readOnlyHint === false, 'draft_outreach readOnlyHint false')
    })
    await check('tools/list: draft_outreach openWorldHint true', () => ok(tool('draft_outreach')?.annotations?.openWorldHint === true, 'openWorldHint true'))
    await check('tools/list: every tool has outputSchema', () => {
      const missing = tools.filter((t) => !t.outputSchema).map((t) => t.name)
      ok(!missing.length, `outputSchema on all tools, missing on ${missing}`)
    })
    await check("tools/list: get_profile _meta['openai/profile']", () => ok(tool('get_profile')?._meta?.['openai/profile'] === true, "_meta['openai/profile'] === true"))

    await check('get_profile', async () => {
      const p = data(await call('get_profile'))
      ok(typeof p.id === 'string' && p.id.length > 0, 'non-empty id')
    })
    await check('get_usage', async () => {
      const u = data(await call('get_usage'))
      for (const k of ['used', 'limit', 'remaining']) ok(typeof u[k] === 'number', `${k} is a number, got ${JSON.stringify(u[k])}`)
    })

    const firstIds: Record<string, string | undefined> = {}
    for (const name of ['list_board', 'list_searches', 'list_contacted']) {
      await check(`${name} {limit:1} paginates`, async () => {
        const page = data(await call(name, { limit: 1 }))
        ok(Array.isArray(page?.items), `{items,nextCursor,total}, got ${JSON.stringify(page).slice(0, 120)}`)
        ok(page.items.length <= 1, `items.length <= 1, got ${page.items.length}`)
        ok(typeof page.total === 'number' && 'nextCursor' in page, 'total number and nextCursor key')
        firstIds[name] = page.items[0]?.id
        if (page.nextCursor != null) {
          const next = data(await call(name, { limit: 1, cursor: page.nextCursor }))
          ok(JSON.stringify(next.items[0]) !== JSON.stringify(page.items[0]), 'next page starts with a different item')
        }
      })
    }

    const bogusId = '00000000-0000-0000-0000-00000000dead'
    await check('get_contact(bogus id) → isError', () => rejects('get_contact', { personId: bogusId }, false))
    await check('get_board_item(bogus id) → isError', () => rejects('get_board_item', { jobId: bogusId }, false))
    await check('get_search(bogus id) → isError', () => rejects('get_search', { searchId: bogusId }, false))
    await check('list_board {limit:0} → error', () => rejects('list_board', { limit: 0 }, true))
    // Bogus person id too, so a broken validator still cannot write anything.
    await check("update_contact_status {status:'bogus'} → error", () => rejects('update_contact_status', { personId: bogusId, status: 'bogus' }, true))

    await check('get_seeker_brief {} → cv + targets, no rubric', async () => {
      const b = data(await call('get_seeker_brief'))
      ok(typeof b.cv === 'string' && Array.isArray(b.targetIndustries), 'cv string and targetIndustries array')
      ok(b.evaluation === undefined, 'no evaluation without jdText')
    })
    await check('get_seeker_brief {jdText} → rubric + output schema', async () => {
      const b = data(await call('get_seeker_brief', { jdText: 'Acme hires a junior product manager in Ghent. '.repeat(6) }))
      ok(typeof b.evaluation?.instructions === 'string' && b.evaluation.instructions.includes('two passes'), 'instructions text')
      ok(b.evaluation?.outputSchema?.type === 'object' && 'score' in b.evaluation.outputSchema.properties, 'outputSchema with score')
    })
    // Invalid inputs only: nothing may be written by a smoke run.
    await check("add_job {jdText:'short'} → error", () => rejects('add_job', { jdText: 'short', evaluation: {} }, true))
    await check('add_to_shortlist {} → error', () => rejects('add_to_shortlist', {}, true))

    const personId = firstIds.list_contacted
    if (!personId) skip('update_contact_status expectedStatus mismatch', 'no contacted person (or list_contacted not paginated yet)')
    else
      await check('update_contact_status expectedStatus mismatch → isError, unchanged', async () => {
        const before = data(await call('get_contact', { personId }))
        const current = before.status ?? before.person?.status
        const wrong = REPLY_STATUSES.find((s) => s !== current)!
        // No status/followedUp in the call: even if the guard broke there is nothing to write.
        await rejects('update_contact_status', { personId, expectedStatus: wrong }, false)
        const after = data(await call('get_contact', { personId }))
        ok(JSON.stringify(after) === JSON.stringify(before), 'contact unchanged')
      })

    await client.close()
  }

  await check('tampered token signature → 401', () => {
    const [h, p, s] = token!.split('.')
    const i = Math.floor(s!.length / 2)
    return expectChallenge(`Bearer ${h}.${p}.${s!.slice(0, i)}${s![i] === 'A' ? 'B' : 'A'}${s!.slice(i + 1)}`)
  })
}

skip('pending account → 403', 'needs an unapproved account; not testable read-only from outside')
skip('JWKS key rotation', 'needs server-side key rotation; not testable read-only from outside')

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)
