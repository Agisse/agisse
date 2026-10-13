import { Hono, type Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import { sentry } from '@sentry/hono/cloudflare'
import { and, desc, eq, gte, isNotNull, isNull, ne, notInArray, or, sql } from 'drizzle-orm'
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core'
import { z } from 'zod'
import { requireMcpAuth } from '@better-auth/mcp'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createDb, schema, type Db } from './db'
import { isAdminEmail, createAuth, type Auth } from './auth'
import { buildMcpServer } from './lib/mcp'
import { checkClosedPostings } from './lib/closed'
import { qualityReport } from './lib/quality'
import { draftOutreach, draftPrep, extractProfileFromResume, runSearch } from './lib/pipeline'
import { answerQuestion, checkApplication, cvPlain, cvText, draftCover, draftEmail, evaluateJob, findPosting, insertJob, missingKeywords, postingKey, pushStatus, saveJob, sharedPosting, tailorCv } from './lib/jobs'
import { answerFeedback, interviewQuestions, offerBrief, payCheck, roleKey } from './lib/interview'
import { fetchProfileText, normalizeProfileUrl } from './lib/exa'
import { bestMatch, companyKey, percentileOf, researchAssessment } from './lib/assessments'
import { curatedFor, providerGame } from '../shared/assessment-catalog'
import { ANSWER_FIELDS, EMPTY_ANSWERS, matchAnswer, type AnswerKey } from '../shared/answer-bank'
import { STORY_TEXT_LIMIT, type Story } from '../shared/stories'
import type { ProgressData } from '../shared/progress'
import { NoAiKey, NoModelAvailable, transcribe } from './lib/openrouter'
import { DEFAULT_MODEL, keyLooksValid, listKeyModels, loadUserKey, seal, verifyKey } from './lib/byok'
import { SavedCompanyInput, scoutCompanies, similarCompanies, toSaved, upsertSavedCompany } from './lib/companies'
import { researchSelection } from './lib/selection'
import { adzunaEnabled, searchAdzuna } from './lib/adzuna'
import { askHelper, OPENING_QUESTION } from './lib/helper'
import { extractKeywords, matchInOtherWords, rewriteBullet, suggestHeadlines } from './lib/cv'
import { matchKeywords } from '../shared/cv-review'
import { LINKEDIN_TEXT_LIMIT, reviewLinkedin } from '../shared/linkedin-review'
import {
  boothNumber,
  budgetSpent,
  charge,
  loadBudget,
  loadContactedPeople,
  loadJobSummaries,
  loadMemories,
  loadProfile,
  loadResumeText,
  loadSearchList,
  loadSearchWithPeople,
  modelError,
  newMeter,
  userStyle,
  spendThisMonth,
  toBudget,
  toJob,
  toMemory,
  toPerson,
  toSearch,
} from './lib/shared'
import { mails } from './lib/email'
import { referralStatus } from './lib/waitlist'
import { openVacancyStats, quickFit, searchVacancies, vacancyFacets } from './lib/vacancies'
import { ADZUNA_COUNTRIES, EMPTY_FEED_PREFS, FEED_LEVELS, PROGRAM_LABEL, SPOKEN_LANGUAGES, VACANCY_COUNTRIES, VACANCY_FUNCTIONS, VACANCY_INDUSTRIES } from '../shared/listings'
import { dueItems } from '../src/lib/followup'
import type { SelectionProcess } from '../shared/selection'
import { ANSWER_QUESTION_LIMIT, ANSWER_TEXT_LIMIT, type InterviewQuestion, type PracticeAnswer } from '../shared/interview'
import { COGNITIVE_SKILLS, BENCHMARK_MIN_USERS, GAME_IDS, REPORT_KINDS, TRAINING_MODES, type AssessmentReport, type CompanyAssessment, type SkillBenchmark, type TrainingSession } from '../shared/assessments'
import type { HelperMessage } from '../shared/helper'
import { COMPANY_SIZES, CONTACT_VALUES, EMAIL_KINDS, EMPTY_PROFILE, GOALS, JD_TEXT_LIMIT, JOB_STATUSES, MEMORY_KINDS, MEMORY_LIMIT, MEMORY_TEXT_LIMIT, NOTE_LANGUAGES, RATED_TASKS, REPLY_STATUSES, RESUME_PDF_LIMIT, RESUME_TEXT_LIMIT, TRIAL_RESUME_READS, normalizeDomain, type JobEvaluation, type NoteLanguage, type Person, type Profile, type Scout, type ScoutSummary, type BubbleMapSummary, type SavedBubbleMap } from '../shared/types'

declare global {
  interface Env {
    /** Unset: Sentry stays off. */
    SENTRY_DSN?: string
  }
}

type Variables = {
  db: Db
  auth: Auth
  userId: string
  isAdmin: boolean
  /** Pending account on its free try: one search, nothing else that costs money. */
  trial: boolean
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

// Sentry wraps everything else, so it must be the first middleware registered.
app.use(sentry(app, (env) => ({ dsn: env.SENTRY_DSN, tracesSampleRate: 1.0, enableLogs: true })))

// The zone's "Always Use HTTPS" is not enabled, so the Worker owns the redirect (it runs first for
// every path, see wrangler.jsonc) and pins HTTPS for a year via HSTS. Local dev stays on http.
app.use('*', async (c, next) => {
  const url = new URL(c.req.url)
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  // One canonical host for search engines: http → https and www → apex.
  if (!local && (url.protocol === 'http:' || (url.hostname.startsWith('www.') && ['GET', 'HEAD'].includes(c.req.method)))) {
    url.protocol = 'https:'
    url.hostname = url.hostname.replace(/^www\./, '')
    return c.redirect(url.toString(), 301)
  }
  await next()
  if (!local) c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('X-Frame-Options', 'SAMEORIGIN')
  c.header('Permissions-Policy', 'camera=(self), geolocation=(), microphone=(self)')
})

// Cloudflare's free Workers rate limiter (per colo, approximate): credential endpoints per IP, everything else per signed-in user below.
const AUTH_WRITE = /^\/api\/auth\/(sign-in|sign-up|request-password-reset|reset-password)/
app.use('/api/auth/*', async (c, next) => {
  if (c.req.method === 'POST' && AUTH_WRITE.test(c.req.path) && c.env.AUTH_LIMITER) {
    const { success } = await c.env.AUTH_LIMITER.limit({ key: c.req.header('cf-connecting-ip') ?? 'unknown' })
    if (!success) return c.json({ code: 'RATE_LIMITED', message: 'Too many attempts. Wait a minute and try again.' }, 429)
  }
  await next()
})

// One db + auth instance per isolate (auth is per-origin because baseURL is derived from it).
let dbCache: { url: string; db: Db } | null = null
const authCache = new Map<string, Auth>()

// Also covers the MCP endpoint and its OAuth discovery routes, which live outside /api.
const withDbAuth = createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
  const url = c.env.DATABASE_URL
  if (!dbCache || dbCache.url !== url) dbCache = { url, db: createDb(url) }
  const origin = new URL(c.req.url).origin
  let auth = authCache.get(origin)
  if (!auth) {
    auth = createAuth(c.env, dbCache.db, origin)
    authCache.set(origin, auth)
  }
  c.set('db', dbCache.db)
  c.set('auth', auth)
  await next()
})
for (const path of ['/api/*', '/mcp', '/.well-known/*']) app.use(path, withDbAuth)

// requireMcpAuth (below) verifies bearer tokens by fetching `${origin}/api/auth/jwks`, but a Custom Domain
// Worker can't fetch its own hostname (the MCP client saw `500 Jwks failed`). Serve that one URL in-process.
// ponytail: global fetch shim, drop it once @better-auth/mcp accepts a jwks function instead of a URL.
const networkFetch = globalThis.fetch
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input)
  const auth = url.pathname === '/api/auth/jwks' ? authCache.get(url.origin) : undefined
  return auth ? auth.handler(new Request(input, init)) : networkFetch(input, init)
}

app.get('/api/health', (c) => c.json({ ok: true }))

// The homepage's live count of open roles. Public, so it sits above the session guard; the edge cache keeps it to one query an hour.
app.get('/api/public/stats', async (c) => {
  const key = new Request(new URL('/api/public/stats', c.req.url))
  const hit = await caches.default.match(key)
  if (hit) return hit
  const stats = await openVacancyStats(c.get('db'))
  const res = c.json(stats, 200, { 'Cache-Control': 'public, max-age=3600' })
  c.executionCtx.waitUntil(caches.default.put(key, res.clone()))
  return res
})

// Sign-up is open and every account starts on the waitlist (pending, one free search) until approved.
// A personal invite skips the waitlist (auth.ts user.create hook); it is claimed before Better Auth runs, so one code opens one account.
const openInvite = (code: string) => and(eq(schema.invite.code, code), isNull(schema.invite.usedAt), isNull(schema.invite.revokedAt))

// GROUP_INVITE (declared in auth.ts): one reusable link for a group chat; every sign-up with it starts approved on the default budget.
// Rotate or delete the secret to kill the link. ponytail: no use cap, add one if the link leaks.
const isGroupInvite = (env: Env, code: string) => !!env.GROUP_INVITE?.trim() && code === env.GROUP_INVITE.trim()

app.post('/api/auth/sign-up/email', async (c) => {
  const db = c.get('db')
  const code = c.req.header('x-invite')?.trim() ?? ''
  // The group link is approved by the user.create hook in auth.ts, which reads the same header.
  if (!code || isGroupInvite(c.env, code)) return c.get('auth').handler(c.req.raw)
  const [claimed] = await db.update(schema.invite).set({ usedAt: new Date() }).where(openInvite(code)).returning({ code: schema.invite.code })
  if (!claimed) return c.json({ code: 'INVITE_INVALID', message: 'This invite is not valid, already used, or withdrawn. Ask the person who invited you for a new link.' }, 403)
  const res = await c.get('auth').handler(c.req.raw)
  const user = res.ok ? ((await res.clone().json().catch(() => null)) as { user?: { id: string } } | null)?.user : undefined
  if (!user) {
    await db.update(schema.invite).set({ usedAt: null }).where(eq(schema.invite.code, code))
    return res
  }
  await db.update(schema.invite).set({ usedBy: user.id }).where(eq(schema.invite.code, code))
  return res
})

// Lets the door say a link is dead before anyone fills the form.
app.get('/api/invite/:code', async (c) => {
  if (isGroupInvite(c.env, c.req.param('code'))) return c.json({ valid: true })
  const row = await c.get('db').query.invite.findFirst({ where: openInvite(c.req.param('code')), columns: { code: true } })
  return c.json({ valid: !!row })
})

// MCP clients (Claude Code, Codex, ...) register a `http://127.0.0.1:<port>` callback without an
// application_type, which Better Auth then treats as `web` and rejects. A loopback-only client is native.
app.post('/api/auth/oauth2/register', async (c) => {
  const raw = await c.req.text()
  let body: { application_type?: string; redirect_uris?: unknown } | null = null
  try {
    body = JSON.parse(raw)
  } catch {}
  const loopback = (u: unknown) => typeof u === 'string' && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//.test(u)
  const native = body && !body.application_type && Array.isArray(body.redirect_uris) && body.redirect_uris.length > 0 && body.redirect_uris.every(loopback)
  const headers = new Headers(c.req.raw.headers)
  headers.delete('content-length')
  return c.get('auth').handler(new Request(c.req.url, { method: 'POST', headers, body: native ? JSON.stringify({ ...body, application_type: 'native' }) : raw }))
})

app.on(['GET', 'POST'], '/api/auth/*', (c) => c.get('auth').handler(c.req.raw))

// OAuth discovery metadata (RFC 8414/9728) for the `mcp` plugin below is served at the root by
// Better Auth, not under /api/auth, so an MCP client's discovery request needs its own route here —
// otherwise it falls through to the SPA (see the `app.notFound` fallback at the bottom of this file).
// Authorization-server metadata only exists at issuer-suffixed paths (the issuer is origin + `/api/auth`),
// so the bare root paths some clients ask for are aliased to them.
const ROOT_METADATA: Record<string, string> = {
  '/.well-known/oauth-authorization-server': '/.well-known/oauth-authorization-server/api/auth',
  '/.well-known/openid-configuration': '/api/auth/.well-known/openid-configuration',
}
app.on(['GET'], '/.well-known/*', (c) => {
  const url = new URL(c.req.url)
  const alias = ROOT_METADATA[url.pathname]
  if (!alias) return c.get('auth').handler(c.req.raw)
  url.pathname = alias
  return c.get('auth').handler(new Request(url, c.req.raw))
})

// requireMcpAuth answers bad/expired tokens with a 401 challenge itself, but rethrows anything else it hits
// while verifying (a JWKS fetch error, say) as a bare 500, so those get the same challenge here.
const mcpChallenge = (origin: string) =>
  new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Invalid token' }, id: null }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"` },
  })

// Remote MCP server: an AI client (Claude Desktop/Code, ...) connects here as one signed-in user,
// authenticated by the OAuth bearer token the `mcp` Better Auth plugin issues — never a session cookie,
// so this route stays outside the `/api/*` session guard below.
app.all('/mcp', async (c) => {
  const origin = new URL(c.req.url).origin
  let verified = false
  try {
    return await requireMcpAuth(
      c.get('auth'),
      async (request, claims) => {
        verified = true
        const userId = claims.sub
        if (!userId) return mcpChallenge(origin)
        const db = c.get('db')
        const user = await db.query.user.findFirst({ where: eq(schema.user.id, userId) })
        const isAdmin = user?.isAdmin && isAdminEmail(c.env, user.email)
        if (!user || (user.accessStatus !== 'approved' && !isAdmin)) return c.json({ error: 'This account is not approved for MCP access.' }, 403)
        const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })
        const server = buildMcpServer(db, c.env, userId, false)
        await server.connect(transport)
        return transport.handleRequest(request)
      },
      { resource: `${origin}/mcp` },
    )(c.req.raw)
  } catch (err) {
    // Errors from the MCP handler itself stay real 500s; only verification failures become a challenge.
    if (verified) throw err
    console.error('mcp token verification failed', err instanceof Error ? err.message : err)
    return mcpChallenge(origin)
  }
})

// What a pending account may do on its free try. Deleting is out so the try cannot be reset.
const TRIAL_ROUTES = [
  /^GET \/api\/(me|searches|contacted|referral|vacancies|vacancies\/facets|jobs)$/,
  // The feed and saving from it are plain database work; evaluating or tailoring stays closed (evaluateInto).
  /^GET \/api\/jobs\/[^/]+$/,
  /^POST \/api\/jobs$/,
  /^GET \/api\/searches\/[^/]+$/,
  /^POST \/api\/searches$/,
  /^PUT \/api\/profile(\/resume)?$/,
  /^POST \/api\/profile\/extract$/,
  /^PATCH \/api\/people\/[^/]+$/,
]

// ---- Session guard for everything below ----
app.use('/api/*', async (c, next) => {
  if (c.req.path.startsWith('/api/auth') || c.req.path.startsWith('/api/invite/') || c.req.path === '/api/health' || c.req.path === '/api/public/stats') return next()
  const session = await c.get('auth').api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'Sign in to continue.' }, 401)
  const user = await c.get('db').query.user.findFirst({ where: eq(schema.user.id, session.user.id) })
  if (!user) return c.json({ error: 'Account not found.' }, 401)
  const isAdmin = user.isAdmin && isAdminEmail(c.env, user.email)
  if (user.accessStatus === 'rejected' && !isAdmin) {
    return c.json({ error: 'Access was declined. Contact the administrator if this is a mistake.', status: user.accessStatus }, 403)
  }
  const trial = user.accessStatus === 'pending' && !isAdmin
  if (trial && !TRIAL_ROUTES.some((r) => r.test(`${c.req.method} ${c.req.path}`))) {
    return c.json({ error: 'This opens once the administrator approves your account.' }, 403)
  }
  // Writes are what reach paid models; reads stay unlimited. Admin is exempt.
  if (c.req.method !== 'GET' && !isAdmin && c.env.API_LIMITER) {
    const { success } = await c.env.API_LIMITER.limit({ key: session.user.id })
    if (!success) return c.json({ error: 'You are going a bit fast. Wait a minute and try again.' }, 429)
  }
  c.set('userId', session.user.id)
  c.set('isAdmin', isAdmin)
  c.set('trial', trial)
  await next()
})

// Your invite link, invites left and (while waiting) your place in line.
app.get('/api/referral', async (c) => c.json(await referralStatus(c.get('db'), c.get('userId'))))

app.get('/api/admin/users', async (c) => {
  if (!c.get('isAdmin')) return c.json({ error: 'Admin access required.' }, 403)
  const db = c.get('db')
  const [users, used] = await Promise.all([
    db.query.user.findMany({ orderBy: desc(schema.user.createdAt), columns: { id: true, name: true, email: true, accessStatus: true, reviewedAt: true, createdAt: true, isAdmin: true, budgetEur: true } }),
    spendThisMonth(db),
  ])
  return c.json({
    users: users.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      reviewedAt: u.reviewedAt?.toISOString() ?? null,
      budget: toBudget(c.env, used.get(u.id), u.budgetEur),
    })),
  })
})

// Output quality per task, prompt version and model, plus score calibration (worker/lib/quality.ts).
app.get('/api/admin/quality', async (c) => {
  if (!c.get('isAdmin')) return c.json({ error: 'Admin access required.' }, 403)
  return c.json({ report: await qualityReport(c.get('db')) })
})

app.patch('/api/admin/users/:id', async (c) => {
  if (!c.get('isAdmin')) return c.json({ error: 'Admin access required.' }, 403)
  const parsed = z
    .object({
      status: z.enum(['approved', 'rejected', 'pending']).optional(),
      // null = back to the default monthly budget.
      budgetEur: z.number().min(0).max(100_000).nullable().optional(),
    })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: 'Choose approved, rejected, or pending, and a budget between €0 and €100,000.' }, 400)
  const { status, budgetEur } = parsed.data
  const target = await c.get('db').query.user.findFirst({ where: eq(schema.user.id, c.req.param('id')) })
  if (!target) return c.json({ error: 'Account not found.' }, 404)
  if (target.isAdmin && status) return c.json({ error: 'The administrator account cannot be changed here.' }, 400)
  const set: Partial<typeof schema.user.$inferInsert> = { updatedAt: new Date() }
  if (status) Object.assign(set, { accessStatus: status, reviewedAt: status === 'pending' ? null : new Date() })
  if (budgetEur !== undefined) set.budgetEur = budgetEur
  const [user] = await c.get('db').update(schema.user).set(set).where(eq(schema.user.id, target.id)).returning({ id: schema.user.id, accessStatus: schema.user.accessStatus, budgetEur: schema.user.budgetEur })
  if (status === 'approved' && target.accessStatus !== 'approved') c.executionCtx.waitUntil(mails.approved(c.env, target, new URL(c.req.url).origin))
  return c.json({ user })
})

app.get('/api/admin/invites', async (c) => {
  if (!c.get('isAdmin')) return c.json({ error: 'Admin access required.' }, 403)
  const rows = await c.get('db')
    .select({ code: schema.invite.code, note: schema.invite.note, createdAt: schema.invite.createdAt, usedAt: schema.invite.usedAt, revokedAt: schema.invite.revokedAt, usedByName: schema.user.name, usedByEmail: schema.user.email })
    .from(schema.invite)
    .leftJoin(schema.user, eq(schema.user.id, schema.invite.usedBy))
    .orderBy(desc(schema.invite.createdAt))
  return c.json({ invites: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), usedAt: r.usedAt?.toISOString() ?? null, revokedAt: r.revokedAt?.toISOString() ?? null })) })
})

app.post('/api/admin/invites', async (c) => {
  if (!c.get('isAdmin')) return c.json({ error: 'Admin access required.' }, 403)
  const parsed = z.object({ note: z.string().trim().min(1).max(120) }).safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: 'Say who the invite is for, in 120 characters or fewer.' }, 400)
  // 9 random bytes = 12 URL-safe characters.
  const code = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(9)))).replace(/\+/g, '-').replace(/\//g, '_')
  const [row] = await c.get('db').insert(schema.invite).values({ code, note: parsed.data.note }).returning()
  return c.json({ invite: { code: row!.code, note: row!.note, createdAt: row!.createdAt.toISOString(), usedAt: null, revokedAt: null, usedByName: null, usedByEmail: null } })
})

app.delete('/api/admin/invites/:code', async (c) => {
  if (!c.get('isAdmin')) return c.json({ error: 'Admin access required.' }, 403)
  const [row] = await c.get('db').update(schema.invite).set({ revokedAt: new Date() }).where(openInvite(c.req.param('code'))).returning({ code: schema.invite.code })
  if (!row) return c.json({ error: 'That invite is already used or withdrawn.' }, 409)
  return c.json({ ok: true })
})

// ---- Helpers ----

const ProfileSchema = z.object({
  headline: z.string().max(160).default(''),
  university: z.string().max(120).default(''),
  degree: z.string().max(120).default(''),
  gradYear: z.string().max(8).default(''),
  employers: z.array(z.string().max(80)).max(20).default([]),
  internships: z.array(z.string().max(80)).max(20).default([]),
  organizations: z.array(z.string().max(80)).max(20).default([]),
  interests: z.array(z.string().max(60)).max(30).default([]),
  targetIndustries: z.array(z.string().max(60)).max(20).default([]),
  skills: z.array(z.string().max(40)).max(30).default([]),
  background: z.string().max(1200).default(''),
  linkedinPremium: z.boolean().default(false),
  smartModel: z.boolean().default(true),
  jobFeed: z
    .object({
      query: z.string().trim().max(120).default(''),
      // Older profiles saved lowercase Adzuna codes; unknown codes are dropped rather than failing the whole save.
      countries: z
        .array(z.string().max(4))
        .max(40)
        .default([])
        .transform((cs) => [...new Set(cs.map((c) => c.toUpperCase()).filter((c) => c in VACANCY_COUNTRIES))]),
      level: z.enum(FEED_LEVELS).default('any'),
      remoteOnly: z.boolean().default(false),
      minSalary: z.number().int().min(0).max(1_000_000).nullable().default(null),
      functions: z.array(z.string().max(20)).max(20).default([]).transform((fs) => fs.filter((f) => f in VACANCY_FUNCTIONS)),
      industries: z.array(z.string().max(30)).max(20).default([]).transform((is) => is.filter((i) => i in VACANCY_INDUSTRIES)),
      languages: z.array(z.string().max(20)).max(16).default([]).transform((ls) => ls.filter((l) => (SPOKEN_LANGUAGES as readonly string[]).includes(l))),
      blocked: z.array(z.string().trim().min(1).max(120)).max(300).default([]),
      sponsorsOnly: z.boolean().default(false),
      programs: z.array(z.string().max(30)).max(10).default([]).transform((ps) => ps.filter((x) => x in PROGRAM_LABEL)),
    })
    .default(EMPTY_FEED_PREFS),
  answers: z
    .object(Object.fromEntries(ANSWER_FIELDS.map((f) => [f.key, z.string().trim().max(400).default('')])) as Record<AnswerKey, z.ZodDefault<z.ZodString>>)
    .default(EMPTY_ANSWERS),
})

const ResumeInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(200, 'That PDF has almost no readable text. If it is a scan, export a text version and try again.')
    .max(RESUME_TEXT_LIMIT),
})

const HelperInputSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(4000),
  })).min(1).max(12),
  // The page the seeker has open; the worker loads what is on it (see parsePage in lib/helper.ts).
  path: z.string().max(240).default('/'),
})

// The user's own public LinkedIn profile, as an alternative to a résumé PDF.
const LinkedinInputSchema = z.object({
  linkedin: z
    .string()
    .max(300)
    .transform((s, ctx) => {
      const url = normalizeProfileUrl(s)
      return /^https:\/\/www\.linkedin\.com\/in\/[^/]+$/.test(url) ? url : (ctx.addIssue({ code: 'custom', message: 'Paste your profile link, e.g. https://www.linkedin.com/in/your-name' }), z.NEVER)
    }),
})

const SearchInputSchema = z.object({
  company: z.string().trim().min(1, 'Company is required').max(120),
  // Optional: blank means "work it out" (see POST /api/searches).
  domain: z
    .string()
    .max(200)
    .nullish()
    .transform((s, ctx) => (!s?.trim() ? null : (normalizeDomain(s) ?? (ctx.addIssue({ code: 'custom', message: 'That website does not look right, e.g. https://www.google.com' }), z.NEVER)))),
  role: z.string().trim().min(1, 'Target role is required').max(120),
  location: z.string().trim().max(120).optional().nullable(),
  goal: z.enum(GOALS).optional().nullable(),
  contactTypes: z.array(z.enum(CONTACT_VALUES)).max(CONTACT_VALUES.length).default([]),
  sharedOnly: z.boolean().default(false),
})

async function loadBriefing(db: Db, userId: string) {
  const row = await db.query.profile.findFirst({ where: eq(schema.profile.userId, userId), columns: { briefing: true, cvReview: true } })
  return { briefing: row?.briefing ?? null, cvReview: row?.cvReview ?? null }
}

/** The free try is spent once a search did not fail (a running one counts, so it cannot be doubled up). */
async function trialUsed(db: Db, userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.search)
    .where(and(eq(schema.search.userId, userId), ne(schema.search.status, 'failed')))
  return (row?.n ?? 0) > 0
}

// ---- Me / profile ----

app.get('/api/me', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const [u, profile, { briefing, cvReview }, budget, used, memories, aiKey] = await Promise.all([
    db.query.user.findFirst({ where: eq(schema.user.id, userId), columns: { id: true, name: true, email: true, isAdmin: true } }),
    loadProfile(db, userId),
    loadBriefing(db, userId),
    loadBudget(db, c.env, userId),
    c.get('trial') ? trialUsed(db, userId) : false,
    loadMemories(db, userId),
    db.query.aiKey.findFirst({ where: eq(schema.aiKey.userId, userId), columns: { provider: true, model: true, last4: true } }),
  ])
  return c.json({ user: u, profile, briefing, cvReview, memories, budget, trial: c.get('trial') ? { used } : null, adzuna: adzunaEnabled(c.env), aiKey: aiKey ?? null })
})

// ---- Own AI key (bring your own key) ----
// The key goes in once, is checked against the provider, sealed, and never comes back out: /api/me shows the last four only.

const ModelId = z.string().trim().max(100).regex(/^[\w.:/-]*$/)

app.put('/api/ai-key', async (c) => {
  if (c.get('trial')) return c.json({ error: 'Your own key works once your account is approved.' }, 403)
  const parsed = z
    .object({ provider: z.enum(['openrouter', 'openai', 'anthropic', 'gemini', 'mistral']), key: z.string().trim().max(300), model: ModelId.default('') })
    .safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: 'Choose a provider and paste a key.' }, 400)
  const { provider, key } = parsed.data
  if (!keyLooksValid(provider, key)) return c.json({ error: 'That does not look like a key for this provider.' }, 400)
  const model = parsed.data.model || DEFAULT_MODEL[provider]
  const problem = await verifyKey({ provider, key, model })
  if (problem) return c.json({ error: problem }, 400)
  const userId = c.get('userId')
  const row = { provider, model, sealed: await seal(c.env.BETTER_AUTH_SECRET, userId, key), last4: key.slice(-4), createdAt: new Date() }
  await c.get('db').insert(schema.aiKey).values({ userId, ...row }).onConflictDoUpdate({ target: schema.aiKey.userId, set: row })
  return c.json({ aiKey: { provider, model, last4: row.last4 } })
})

/** Switch model without pasting the key again; checked against the provider like a new key. */
app.patch('/api/ai-key', async (c) => {
  const parsed = z.object({ model: ModelId }).safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: 'That is not a model id.' }, 400)
  const db = c.get('db')
  const userId = c.get('userId')
  const k = await loadUserKey(db, c.env, userId)
  if (!k) return c.json({ error: 'Add a key first.' }, 404)
  const model = parsed.data.model || DEFAULT_MODEL[k.provider]
  const problem = await verifyKey({ ...k, model })
  if (problem) return c.json({ error: problem }, 400)
  await db.update(schema.aiKey).set({ model }).where(eq(schema.aiKey.userId, userId))
  return c.json({ aiKey: { provider: k.provider, model, last4: k.key.slice(-4) } })
})

/** Model ids the stored key can use, for the picker. */
app.get('/api/ai-key/models', async (c) => {
  const k = await loadUserKey(c.get('db'), c.env, c.get('userId'))
  return c.json({ models: k ? await listKeyModels(k) : [] })
})

app.delete('/api/ai-key', async (c) => {
  await c.get('db').delete(schema.aiKey).where(eq(schema.aiKey.userId, c.get('userId')))
  return c.json({ ok: true })
})

// ---- Story bank: the seeker's STAR stories, matched to postings in the browser (shared/stories.ts) ----

const StoryInput = z.object({
  title: z.string().trim().min(1).max(160),
  text: z.string().trim().min(20, 'Write the story first.').max(STORY_TEXT_LIMIT),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
})
const toStory = (r: typeof schema.story.$inferSelect): Story => ({ id: r.id, title: r.title, text: r.text, tags: r.tags, createdAt: r.createdAt.toISOString() })

app.get('/api/stories', async (c) => {
  const rows = await c.get('db').select().from(schema.story).where(eq(schema.story.userId, c.get('userId'))).orderBy(desc(schema.story.createdAt)).limit(200)
  return c.json({ stories: rows.map(toStory) })
})

app.post('/api/stories', async (c) => {
  const parsed = StoryInput.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid story' }, 400)
  const [row] = await c.get('db').insert(schema.story).values({ id: crypto.randomUUID(), userId: c.get('userId'), ...parsed.data }).returning()
  return c.json({ story: toStory(row!) })
})

app.put('/api/stories/:id', async (c) => {
  const parsed = StoryInput.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid story' }, 400)
  const [row] = await c.get('db').update(schema.story).set(parsed.data).where(and(eq(schema.story.id, c.req.param('id')), eq(schema.story.userId, c.get('userId')))).returning()
  if (!row) return c.json({ error: 'Story not found' }, 404)
  return c.json({ story: toStory(row) })
})

app.delete('/api/stories/:id', async (c) => {
  await c.get('db').delete(schema.story).where(and(eq(schema.story.id, c.req.param('id')), eq(schema.story.userId, c.get('userId'))))
  return c.json({ ok: true })
})

// The extension, on click: which of the form's field labels ask for one of the seeker's saved answers. No model call.
app.post('/api/profile/answers/match', async (c) => {
  const parsed = z.object({ labels: z.array(z.string().max(1000)).max(120) }).safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: 'Invalid form labels' }, 400)
  const answers = (await loadProfile(c.get('db'), c.get('userId')))?.answers ?? EMPTY_ANSWERS
  const matches = parsed.data.labels.flatMap((label) => {
    const key = matchAnswer(label)
    return key ? [{ label, key, name: ANSWER_FIELDS.find((f) => f.key === key)!.label, text: answers[key] ?? '' }] : []
  })
  return c.json({ matches })
})

app.put('/api/profile', async (c) => {
  const parsed = ProfileSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid profile' }, 400)
  const clean = (arr: string[]) => [...new Set(arr.map((s) => s.trim()).filter(Boolean))]
  const data: Profile = {
    ...parsed.data,
    headline: parsed.data.headline.trim(),
    university: parsed.data.university.trim(),
    degree: parsed.data.degree.trim(),
    gradYear: parsed.data.gradYear.trim(),
    employers: clean(parsed.data.employers),
    internships: clean(parsed.data.internships),
    organizations: clean(parsed.data.organizations),
    interests: clean(parsed.data.interests),
    targetIndustries: clean(parsed.data.targetIndustries),
    skills: clean(parsed.data.skills),
    background: parsed.data.background.trim(),
  }
  const db = c.get('db')
  await db
    .insert(schema.profile)
    .values({ userId: c.get('userId'), data })
    .onConflictDoUpdate({ target: schema.profile.userId, set: { data, updatedAt: new Date() } })
  return c.json({ profile: data })
})

// Résumé text (already extracted in the browser; the PDF itself never reaches the Worker), or the user's public
// LinkedIn profile fetched through Exa → a filled badge the user reviews before saving. One model call, charged to the monthly token budget.
app.post('/api/profile/extract', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = body && typeof body === 'object' && 'linkedin' in body ? LinkedinInputSchema.safeParse(body) : ResumeInputSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid résumé text' }, 400)
  const db = c.get('db')
  const userId = c.get('userId')
  if (c.get('trial')) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.usage)
      .where(and(eq(schema.usage.userId, userId), eq(schema.usage.kind, 'resume')))
    if ((row?.n ?? 0) >= TRIAL_RESUME_READS) return c.json({ error: 'Your free try covers a few résumé reads, and they are used. More opens once the administrator approves your account.' }, 403)
  }
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  try {
    if ('linkedin' in parsed.data) {
      const text = await fetchProfileText(c.env, parsed.data.linkedin, meter, db)
      if (text.length < 100) return c.json({ error: 'That LinkedIn profile is not public or not indexed yet. Try your résumé PDF instead.' }, 404)
      // Not stored as résumé text: a real CV uploaded earlier stays what the job board tailors from.
      return c.json(await extractProfileFromResume(c.env, text, meter))
    }
    const { profile, model } = await extractProfileFromResume(c.env, parsed.data.text, meter)
    // Kept for tailoring CVs and cover letters on the job board; the badge fields are saved by the user.
    await db
      .insert(schema.profile)
      .values({ userId, data: EMPTY_PROFILE, resumeText: parsed.data.text })
      .onConflictDoUpdate({ target: schema.profile.userId, set: { resumeText: parsed.data.text } })
    return c.json({ profile, model })
  } catch (err) {
    return c.json({ error: modelError(err, 'read the résumé') }, 502)
  } finally {
    await charge(db, userId, 'resume', meter)
  }
})

// The original PDF, kept in R2 (one per user, replaced on re-upload). The body is streamed straight
// through, never parsed, so the Worker stays inside its CPU budget.
app.put('/api/profile/resume', async (c) => {
  const size = Number(c.req.header('content-length') ?? 0)
  if (c.req.header('content-type') !== 'application/pdf' || !size || !c.req.raw.body) return c.json({ error: 'Upload the résumé as a PDF.' }, 400)
  if (size > RESUME_PDF_LIMIT) return c.json({ error: 'That PDF is over 10 MB. Export a smaller version and try again.' }, 413)
  const filename = decodeURIComponent(c.req.header('x-filename') ?? 'resume.pdf').slice(0, 200)
  await c.env.RESUMES.put(`resumes/${c.get('userId')}.pdf`, c.req.raw.body, {
    httpMetadata: { contentType: 'application/pdf' },
    customMetadata: { filename, uploadedAt: new Date().toISOString() },
  })
  return c.json({ ok: true })
})

// ---- CV review ----
// The score is rule-based and computed in the browser (shared/cv-review.ts); the Worker keeps its summary and runs the
// model calls the review offers on demand, one each. A pasted CV is used for the call and never stored.

app.get('/api/cv', async (c) => {
  const row = await c.get('db').query.profile.findFirst({ where: eq(schema.profile.userId, c.get('userId')), columns: { resumeText: true, cvReview: true } })
  return c.json({ resumeText: row?.resumeText ?? null, review: row?.cvReview ?? null })
})

const CvReviewInput = z.object({ score: z.number().int().min(0).max(100), failed: z.array(z.string().max(40)).max(40) })

app.put('/api/cv/review', async (c) => {
  const parsed = CvReviewInput.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: 'Invalid review' }, 400)
  const review = { ...parsed.data, at: new Date().toISOString() }
  await c
    .get('db')
    .insert(schema.profile)
    .values({ userId: c.get('userId'), data: EMPTY_PROFILE, cvReview: review })
    .onConflictDoUpdate({ target: schema.profile.userId, set: { cvReview: review } })
  await c.get('db').insert(schema.cvReviewLog).values({ id: crypto.randomUUID(), userId: c.get('userId'), score: review.score, failed: review.failed })
  return c.json({ review })
})

const RewriteInput = z.object({ line: z.string().trim().min(3).max(600), check: z.string().max(40), cv: z.string().max(RESUME_TEXT_LIMIT).optional() })

app.post('/api/cv/rewrite', async (c) => {
  const parsed = RewriteInput.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: 'Pick a line from your CV to rewrite.' }, 400)
  const db = c.get('db')
  const userId = c.get('userId')
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const [profile, resumeText] = await Promise.all([loadProfile(db, userId), loadResumeText(db, userId)])
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  // No row to point at: the id only ties a thumbs rating to this generation.
  meter.ref = crypto.randomUUID()
  try {
    const { options, note } = await rewriteBullet(c.env, parsed.data.line, parsed.data.check, profile, parsed.data.cv?.trim() || resumeText, meter)
    if (!options.length) return c.json({ error: 'Every version claimed something your CV does not say, so none is shown. Try again.' }, 422)
    return c.json({ options, note, refId: meter.ref })
  } catch (err) {
    return c.json({ error: modelError(err, 'rewrite the line') }, 502)
  } finally {
    await charge(db, userId, 'cv', meter)
  }
})

const MatchInput = z
  .object({
    jobId: z.string().max(64).optional(),
    jdText: z.string().trim().min(200, 'Paste the whole posting: that is too short to pull keywords from.').max(JD_TEXT_LIMIT).optional(),
    cv: z.string().max(RESUME_TEXT_LIMIT).optional(),
  })
  .refine((v) => !!v.jobId !== !!v.jdText, 'Pick a posting or paste one.')

// Job match. Exact keyword match first (free, what a simple ATS does); then one Jev call reads the CV for the keywords
// it lacks word for word ("shown in other words") and, with the posting text, gives a fit verdict. A board posting already
// has its keywords from the evaluation; a pasted one gets them from one LLM call. The pasted CV or posting is not stored.
app.post('/api/cv/match', async (c) => {
  const parsed = MatchInput.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Pick a posting or paste one.' }, 400)
  const db = c.get('db')
  const userId = c.get('userId')
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const [profile, resumeText, row] = await Promise.all([loadProfile(db, userId), loadResumeText(db, userId), parsed.data.jobId ? findEvaluated(db, parsed.data.jobId, userId) : null])
  if (parsed.data.jobId && !row) return c.json({ error: 'Evaluate this posting first.' }, 404)
  const cv = parsed.data.cv?.trim() || cvText(profile, resumeText)
  if (cv.trim().length < 100) return c.json({ error: 'Import your résumé or paste your CV first: there is nothing to match yet.' }, 422)
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  try {
    const posting = row?.jdText ?? parsed.data.jdText!
    const keywords = row ? row.evaluation.keywords : await extractKeywords(c.env, posting, meter)
    const exact = matchKeywords(cv, keywords)
    const { inOtherWords, fit } = await matchInOtherWords(c.env, cv, exact.missing, posting, meter)
    const total = exact.matched.length + exact.missing.length
    return c.json({
      keywords,
      matched: exact.matched,
      inOtherWords,
      missing: exact.missing.filter((k) => !inOtherWords.includes(k)),
      pct: exact.pct,
      recruiterPct: total ? Math.round((100 * (exact.matched.length + inOtherWords.length)) / total) : 0,
      fit,
      jobId: row?.id ?? null,
      label: row ? `${row.role} at ${row.company}` : 'the pasted posting',
    })
  } catch (err) {
    return c.json({ error: modelError(err, 'read the posting') }, 502)
  } finally {
    await charge(db, userId, 'cv', meter)
  }
})

const LinkedinReviewInput = z.object({ text: z.string().max(LINKEDIN_TEXT_LIMIT), headline: z.string().max(300).optional(), url: z.string().max(500).optional() })

// The extension sends the text of the seeker's own profile tab; rule checks only, no model call, nothing stored.
app.post('/api/cv/linkedin-review', async (c) => {
  const parsed = LinkedinReviewInput.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success || parsed.data.text.trim().length < 50) return c.json({ error: 'Open your own LinkedIn profile and try again.' }, 400)
  return c.json({ review: reviewLinkedin(parsed.data, await loadProfile(c.get('db'), c.get('userId'))) })
})

const HeadlinesInput = z.object({ current: z.string().max(300).default('') })

app.post('/api/cv/headlines', async (c) => {
  const parsed = HeadlinesInput.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: 'That headline is too long.' }, 400)
  const db = c.get('db')
  const userId = c.get('userId')
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const [profile, resumeText, roles] = await Promise.all([
    loadProfile(db, userId),
    loadResumeText(db, userId),
    db.selectDistinct({ role: schema.job.role }).from(schema.job).where(eq(schema.job.userId, userId)).limit(40),
  ])
  if (!resumeText?.trim() && !profile?.skills.length && !profile?.degree) return c.json({ error: 'Import your résumé or fill in your profile first: headlines are built from it.' }, 422)
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  try {
    const headlines = await suggestHeadlines(c.env, parsed.data.current.trim(), profile, resumeText, roles.map((r) => r.role), meter)
    if (!headlines.length) return c.json({ error: 'Every headline claimed something your CV does not say, so none is shown. Try again.' }, 422)
    return c.json({ headlines })
  } catch (err) {
    return c.json({ error: modelError(err, 'write headlines') }, 502)
  } finally {
    await charge(db, userId, 'cv', meter)
  }
})

// ---- Searches ----

app.get('/api/searches', async (c) => {
  return c.json({ searches: await loadSearchList(c.get('db'), c.get('userId')) })
})

app.post('/api/searches', async (c) => {
  const parsed = SearchInputSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid search' }, 400)
  const db = c.get('db')
  const userId = c.get('userId')

  // ponytail: two simultaneous trial requests can both pass this check; the client sends one.
  if (c.get('trial') && (await trialUsed(db, userId))) {
    return c.json({ error: 'Your free try is used. Full access opens once the administrator approves your account.' }, 403)
  }
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))

  // No website given: take it from a company Agisse already knows by exactly that name, else search without one.
  const known = parsed.data.domain ? [] : await db.select({ domain: schema.company.domain }).from(schema.company).where(sql`lower(${schema.company.name}) = lower(${parsed.data.company})`).limit(2)
  const input = { ...parsed.data, domain: parsed.data.domain ?? (known.length === 1 ? known[0]!.domain : null), contactTypes: [...new Set(parsed.data.contactTypes)], location: parsed.data.location || null, goal: parsed.data.goal ?? null }
  const id = crypto.randomUUID()
  meter.ref = id
  const [created] = await db
    .insert(schema.search)
    .values({ id, userId, company: input.company, domain: input.domain, role: input.role, location: input.location, goal: input.goal, contactTypes: input.contactTypes, sharedOnly: input.sharedOnly, status: 'running' })
    .returning()

  const profile = await loadProfile(db, userId)
  try {
    const result = await runSearch(c.env, input, profile, { meter, db })
    const rows = result.people.map((p, i) => ({
      id: crypto.randomUUID(),
      searchId: id,
      userId,
      rank: i + 1,
      outreach: '',
      ...p,
    }))
    if (rows.length) await db.insert(schema.person).values(rows)
    const [updated] = await db
      .update(schema.search)
      .set({ status: 'done', model: result.model, peopleCount: rows.length })
      .where(eq(schema.search.id, id))
      .returning()
    const people = await db.query.person.findMany({ where: eq(schema.person.searchId, id), orderBy: schema.person.rank })
    const number = await boothNumber(db, userId, created!.createdAt)
    return c.json({ search: { ...toSearch(updated ?? created!, number), people: people.map(toPerson) } }, 201)
  } catch (err) {
    const message =
      err instanceof NoModelAvailable
        ? 'Could not complete the search: no model answered in time. Try again later.'
        : err instanceof Error
          ? err.message
          : 'Search failed'
    const [failed] = await db.update(schema.search).set({ status: 'failed', error: message }).where(eq(schema.search.id, id)).returning()
    const number = await boothNumber(db, userId, created!.createdAt)
    return c.json({ error: message, search: { ...toSearch(failed ?? created!, number), people: [] } }, 502)
  } finally {
    await charge(db, userId, 'search', meter)
  }
})

// Another discovery round for an existing booth: new angles, everyone already listed excluded,
// new badges appended after the current ranks.
app.post('/api/searches/:id/more', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const row = await db.query.search.findFirst({ where: and(eq(schema.search.id, c.req.param('id')), eq(schema.search.userId, userId)) })
  if (!row) return c.json({ error: 'Search not found' }, 404)
  if (row.status === 'running') return c.json({ error: 'This booth is still being searched.' }, 409)

  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  meter.ref = row.id

  const existing = await db.query.person.findMany({ where: eq(schema.person.searchId, row.id), orderBy: schema.person.rank })
  const profile = await loadProfile(db, userId)
  const round = row.rounds + 1
  const input = { company: row.company, domain: row.domain, role: row.role, location: row.location, goal: row.goal, contactTypes: row.contactTypes, sharedOnly: row.sharedOnly }
  const number = await boothNumber(db, userId, row.createdAt)

  try {
    const result = await runSearch(c.env, input, profile, {
      round,
      excludeUrls: existing.map((p) => normalizeProfileUrl(p.profileUrl)),
      excludeNames: existing.map((p) => p.name),
      meter,
      db,
    })
    const startRank = existing.reduce((m, p) => Math.max(m, p.rank), 0)
    const rows = result.people.map((p, i) => ({ id: crypto.randomUUID(), searchId: row.id, userId, rank: startRank + i + 1, outreach: '', ...p }))
    if (rows.length) await db.insert(schema.person).values(rows)
    const [updated] = await db
      .update(schema.search)
      .set({ status: 'done', error: null, model: result.model ?? row.model, rounds: round, peopleCount: existing.length + rows.length })
      .where(eq(schema.search.id, row.id))
      .returning()
    const people = await db.query.person.findMany({ where: eq(schema.person.searchId, row.id), orderBy: schema.person.rank })
    return c.json({ search: { ...toSearch(updated ?? row, number), people: people.map(toPerson) }, added: rows.length })
  } catch (err) {
    const message =
      err instanceof NoModelAvailable
        ? 'Could not complete the search: no model answered in time. Try again later.'
        : err instanceof Error
          ? err.message
          : 'Search failed'
    // The booth keeps its people; only this round failed.
    return c.json({ error: message, search: { ...toSearch(row, number), people: existing.map(toPerson) } }, 502)
  } finally {
    await charge(db, userId, 'search', meter)
  }
})

app.get('/api/searches/:id', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const found = await loadSearchWithPeople(db, userId, c.req.param('id'))
  if (!found) return c.json({ error: 'Search not found' }, 404)
  const { search } = found
  // One query for every badge: the same profile contacted from another of this user's booths, newest first.
  // Matched in JS on normalized URLs, since older rows hold raw ones.
  // ponytail: loads all of the user's contacted people; fine at hand-sent-note scale.
  const others = search.people.length
    ? await db
        .select({
          profileUrl: schema.person.profileUrl,
          searchId: schema.person.searchId,
          company: sql<string>`coalesce(${schema.search.company}, ${schema.person.company})`,
          contactedAt: schema.person.contactedAt,
          // Same rule as boothNumber: 1 + the user's searches created strictly before it.
          number: sql<number>`(select count(*)::int + 1 from ${schema.search} b where b.user_id = ${schema.search.userId} and b.created_at < ${schema.search.createdAt})`,
        })
        .from(schema.person)
        // Left join: contacts added by hand have no search.
        .leftJoin(schema.search, eq(schema.search.id, schema.person.searchId))
        .where(and(eq(schema.person.userId, userId), isNotNull(schema.person.contactedAt), or(isNull(schema.person.searchId), ne(schema.person.searchId, search.id))))
        .orderBy(desc(schema.person.contactedAt))
    : []
  const also = new Map<string, Person['alsoContacted']>()
  for (const o of others) {
    if (!o.profileUrl) continue // added by hand without a link: nothing to match on
    const url = normalizeProfileUrl(o.profileUrl)
    if (!also.has(url)) also.set(url, { searchId: o.searchId, company: o.company, number: o.searchId ? o.number : null, contactedAt: o.contactedAt!.toISOString() })
  }
  return c.json({ search: { ...search, people: search.people.map((p) => ({ ...p, alsoContacted: also.get(normalizeProfileUrl(p.profileUrl)) ?? null })) } })
})

app.delete('/api/searches/:id', async (c) => {
  const res = await c
    .get('db')
    .delete(schema.search)
    .where(and(eq(schema.search.id, c.req.param('id')), eq(schema.search.userId, c.get('userId'))))
    .returning({ id: schema.search.id })
  if (!res.length) return c.json({ error: 'Search not found' }, 404)
  return c.json({ ok: true })
})

// ---- People: contact tracking ----

const ContactPatch = z.object({
  contacted: z.boolean().optional(),
  status: z.enum(REPLY_STATUSES).optional(),
  followedUp: z.boolean().optional(),
  channel: z.string().max(40).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  outreach: z.string().max(2000).optional(),
})

app.patch('/api/people/:id', async (c) => {
  const parsed = ContactPatch.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: 'Invalid update' }, 400)
  const set: PgUpdateSetSource<typeof schema.person> = {}
  if (parsed.data.contacted !== undefined) {
    set.contactedAt = parsed.data.contacted ? new Date() : null
    set.status = parsed.data.contacted ? 'contacted' : null
    if (!parsed.data.contacted) set.followedUpAt = null
  }
  if (parsed.data.status !== undefined) set.status = parsed.data.status
  if (parsed.data.followedUp !== undefined) set.followedUpAt = parsed.data.followedUp ? new Date() : null
  if (parsed.data.channel !== undefined) set.contactChannel = parsed.data.channel
  if (parsed.data.notes !== undefined) set.notes = parsed.data.notes
  if (parsed.data.outreach !== undefined) {
    set.outreach = parsed.data.outreach
    // Saving on blur sends unchanged text too; only a real change counts as an edit of the draft.
    set.outreachEdited = sql`${schema.person.outreachEdited} or ${schema.person.outreach} is distinct from ${parsed.data.outreach}`
  }
  const [row] = await c
    .get('db')
    .update(schema.person)
    .set(set)
    .where(and(eq(schema.person.id, c.req.param('id')), eq(schema.person.userId, c.get('userId'))))
    .returning()
  if (!row) return c.json({ error: 'Person not found' }, 404)
  return c.json({ person: toPerson(row) })
})

// Write (or rewrite) the note for one person. Charged to the monthly token budget.
// ?kind=followup drafts the one follow-up to the sent note instead; it is returned, not stored.
app.post('/api/people/:id/outreach', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const rewrite = c.req.query('rewrite') === '1'
  const lang = c.req.query('lang') ?? 'en'
  if (!(NOTE_LANGUAGES as readonly string[]).includes(lang)) return c.json({ error: 'Unsupported language' }, 400)
  const followup = c.req.query('kind') === 'followup'
  const row = await db.query.person.findFirst({ where: and(eq(schema.person.id, c.req.param('id')), eq(schema.person.userId, userId)) })
  if (!row) return c.json({ error: 'Person not found' }, 404)
  if (followup && !row.outreach) return c.json({ error: 'Write the first note before a follow-up.' }, 400)
  if (row.outreach && !rewrite && !followup) return c.json({ person: toPerson(row) })
  if (!row.searchId) return c.json({ error: 'Added by hand, so there is no search to draft from.' }, 400)

  const [srch, profile, u] = await Promise.all([
    db.query.search.findFirst({ where: eq(schema.search.id, row.searchId) }),
    loadProfile(db, userId),
    db.query.user.findFirst({ where: eq(schema.user.id, userId), columns: { name: true } }),
  ])
  if (!srch) return c.json({ error: 'Search not found' }, 404)
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  meter.ref = row.id
  try {
    const { outreach } = await draftOutreach(
      c.env,
      row,
      { company: srch.company, role: srch.role, location: srch.location, goal: srch.goal },
      profile,
      u?.name ?? 'the seeker',
      meter,
      { lang: lang as NoteLanguage, kind: followup ? 'followup' : 'note', style: followup ? '' : await userStyle(db, userId, 'agisse_outreach', row.id) },
    )
    if (followup) return c.json({ followup: outreach })
    const [updated] = await db.update(schema.person).set({ outreach, outreachEdited: false }).where(eq(schema.person.id, row.id)).returning()
    return c.json({ person: toPerson(updated ?? row) })
  } catch (err) {
    return c.json({ error: modelError(err, 'write the note') }, 502)
  } finally {
    await charge(db, userId, 'outreach', meter)
  }
})

// A first networking email to this person, for when the seeker has their address. Returned, not stored. Charged like outreach.
app.post('/api/people/:id/email', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const lang = c.req.query('lang') ?? 'en'
  if (!(NOTE_LANGUAGES as readonly string[]).includes(lang)) return c.json({ error: 'Unsupported language' }, 400)
  const row = await db.query.person.findFirst({ where: and(eq(schema.person.id, c.req.param('id')), eq(schema.person.userId, userId)) })
  if (!row) return c.json({ error: 'Person not found' }, 404)
  const [srch, profile, resumeText, u] = await Promise.all([
    row.searchId ? db.query.search.findFirst({ where: eq(schema.search.id, row.searchId) }) : undefined,
    loadProfile(db, userId),
    loadResumeText(db, userId),
    db.query.user.findFirst({ where: eq(schema.user.id, userId), columns: { name: true } }),
  ])
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const context = `Target company: ${srch?.company ?? row.company}
Target role: ${srch?.role ?? 'not given'}
Goal: ${srch?.goal || 'role advice'}

PERSON
Name: ${row.name}
Title: ${row.title} at ${row.company}
What we know: ${row.summary}
Shared ground: ${row.sharedGround.length ? row.sharedGround.map((g) => `${g.kind}: ${g.detail}`).join('; ') : 'none found'}`
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  meter.ref = row.id
  try {
    const { email } = await draftEmail(c.env, 'intro', context, profile, resumeText, u?.name ?? '', lang as NoteLanguage, meter)
    return c.json({ email })
  } catch (err) {
    return c.json({ error: modelError(err, 'write the email') }, 502)
  } finally {
    await charge(db, userId, 'outreach', meter)
  }
})

// Call prep sheet once they replied: stored, ?rewrite=1 writes it again. Charged like outreach.
app.post('/api/people/:id/prep', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const row = await db.query.person.findFirst({ where: and(eq(schema.person.id, c.req.param('id')), eq(schema.person.userId, userId)) })
  if (!row) return c.json({ error: 'Person not found' }, 404)
  if (row.status !== 'replied' && row.status !== 'call booked') return c.json({ error: 'Prep opens once they replied.' }, 400)
  if (row.prep && c.req.query('rewrite') !== '1') return c.json({ person: toPerson(row) })
  if (!row.searchId) return c.json({ error: 'Added by hand, so there is no search to prep from.' }, 400)

  const [srch, profile] = await Promise.all([db.query.search.findFirst({ where: eq(schema.search.id, row.searchId) }), loadProfile(db, userId)])
  if (!srch) return c.json({ error: 'Search not found' }, 404)
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  meter.ref = row.id
  try {
    const { questions, talkingPoints } = await draftPrep(c.env, row, { company: srch.company, role: srch.role, location: srch.location, goal: srch.goal }, profile, meter)
    const prep = { questions, talkingPoints, createdAt: new Date().toISOString() }
    const [updated] = await db.update(schema.person).set({ prep }).where(eq(schema.person.id, row.id)).returning()
    return c.json({ person: toPerson(updated ?? row) })
  } catch (err) {
    return c.json({ error: modelError(err, 'write the prep sheet') }, 502)
  } finally {
    await charge(db, userId, 'outreach', meter)
  }
})

// A contact met outside Agisse: no search, no model call, nothing charged.
const ManualContact = z.object({
  name: z.string().trim().min(1).max(200),
  title: z.string().trim().max(200).default(''),
  company: z.string().trim().min(1).max(200),
  profileUrl: z.string().trim().url().max(500).optional().or(z.literal('')),
  notes: z.string().max(2000).optional(),
  status: z.enum(REPLY_STATUSES).optional(),
})

app.post('/api/people', async (c) => {
  const parsed = ManualContact.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: 'Give at least a name and a company, and a valid profile link if any.' }, 400)
  const { status, notes, profileUrl, ...rest } = parsed.data
  const [row] = await c
    .get('db')
    .insert(schema.person)
    .values({
      ...rest,
      id: crypto.randomUUID(),
      userId: c.get('userId'),
      profileUrl: profileUrl ?? '',
      notes: notes || null,
      status: status ?? null,
      contactedAt: status ? new Date() : null,
      rank: 0,
      score: 0,
      value: 'peer',
      reason: '',
      summary: '',
    })
    .returning()
  return c.json({ person: toPerson(row!) })
})

// How many things wait on the seeker today, for the Board nav count. Only the columns dueItems reads.
app.get('/api/due', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const [people, jobs] = await Promise.all([
    db
      .select({ status: schema.person.status, contactedAt: schema.person.contactedAt, followedUpAt: schema.person.followedUpAt })
      .from(schema.person)
      .where(and(eq(schema.person.userId, userId), eq(schema.person.status, 'contacted'))),
    db
      .select({ id: schema.job.id, status: schema.job.status, appliedAt: schema.job.appliedAt, nextAt: schema.job.nextAt })
      .from(schema.job)
      .where(and(eq(schema.job.userId, userId), notInArray(schema.job.status, ['rejected', 'discarded']))),
  ])
  const iso = (d: Date | null) => d?.toISOString() ?? null
  const count = dueItems(
    jobs.map((j) => ({ id: j.id, status: j.status, appliedAt: iso(j.appliedAt), nextAt: iso(j.nextAt) })),
    people.map((p) => ({ status: p.status, contactedAt: iso(p.contactedAt), followedUpAt: iso(p.followedUpAt) })),
  ).length
  return c.json({ count })
})

app.get('/api/contacted', async (c) => {
  return c.json({ people: await loadContactedPeople(c.get('db'), c.get('userId')) })
})

// One grounded thinking partner across the whole workspace. It reads summaries only; raw résumés
// and job descriptions stay out of the prompt. Conversation history is supplied by the open page.
app.post('/api/helper', async (c) => {
  const parsed = HelperInputSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Ask a shorter question.' }, 400)
  const db = c.get('db')
  const userId = c.get('userId')
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  try {
    const reply = await askHelper(c.env, db, userId, parsed.data.messages as HelperMessage[], meter, parsed.data.path)
    return c.json({ reply })
  } catch (err) {
    return c.json({ error: modelError(err, 'read your job-search desk') }, 502)
  } finally {
    await charge(db, userId, 'helper', meter)
  }
})

// The desk's opening synthesis: 8 queries + a model call, so it runs only when the user asks and is
// cached on the profile row until the next manual refresh (see loadBriefing, /api/me).
app.post('/api/helper/briefing', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  try {
    const reply = await askHelper(c.env, db, userId, [{ role: 'user', content: OPENING_QUESTION }], meter)
    const briefing = { ...reply, at: new Date().toISOString() }
    await db
      .insert(schema.profile)
      .values({ userId, data: EMPTY_PROFILE, briefing })
      .onConflictDoUpdate({ target: schema.profile.userId, set: { briefing } })
    return c.json({ briefing })
  } catch (err) {
    return c.json({ error: modelError(err, 'read your job-search desk') }, 502)
  } finally {
    await charge(db, userId, 'helper', meter)
  }
})

// ---- Memory: what the assistant knows about the seeker, only ever saved by their click ----

const MemoryInput = z.object({
  kind: z.enum(MEMORY_KINDS),
  text: z.string().trim().min(1).max(MEMORY_TEXT_LIMIT),
  source: z.enum(['user', 'assistant']).default('user'),
  ref: z.string().max(240).nullable().optional(),
})

app.get('/api/memory', async (c) => c.json({ memories: await loadMemories(c.get('db'), c.get('userId')) }))

app.post('/api/memory', async (c) => {
  const parsed = MemoryInput.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid memory' }, 400)
  const db = c.get('db')
  const userId = c.get('userId')
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.memory).where(eq(schema.memory.userId, userId))
  if (n >= MEMORY_LIMIT) return c.json({ error: `The assistant remembers up to ${MEMORY_LIMIT} things. Delete one on your Profile first.` }, 400)
  const [row] = await db.insert(schema.memory).values({ id: crypto.randomUUID(), userId, ...parsed.data, ref: parsed.data.ref ?? null }).returning()
  return c.json({ memory: toMemory(row) })
})

app.patch('/api/memory/:id', async (c) => {
  const parsed = MemoryInput.pick({ kind: true, text: true }).partial().safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid memory' }, 400)
  const [row] = await c
    .get('db')
    .update(schema.memory)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(schema.memory.id, c.req.param('id')), eq(schema.memory.userId, c.get('userId'))))
    .returning()
  if (!row) return c.json({ error: 'Memory not found' }, 404)
  return c.json({ memory: toMemory(row) })
})

app.delete('/api/memory/:id', async (c) => {
  await c
    .get('db')
    .delete(schema.memory)
    .where(and(eq(schema.memory.id, c.req.param('id')), eq(schema.memory.userId, c.get('userId'))))
  return c.json({ ok: true })
})

// ---- Job board: postings evaluated against the CV (ported from career-ops) ----

// jdText may be left empty when a link is given: the posting is then read from the link.
const JobInputSchema = z
  .object({
    jdText: z.string().trim().max(JD_TEXT_LIMIT, 'That posting is too long. Paste the job description itself, without the rest of the page.').default(''),
    url: z.string().trim().url('That link is not a valid URL.').max(500).optional().nullable().or(z.literal('')),
    // Save without evaluating: what the listing already says.
    save: z.object({ company: z.string().max(200), role: z.string().max(200), location: z.string().max(200).nullable().optional(), deadline: z.string().date().nullable().optional() }).optional(),
  })
  .refine((d) => d.save || d.jdText.length >= 200 || (!d.jdText && d.url), 'Paste the whole posting: that is too little text to judge.')

const ListingQuerySchema = z.object({
  what: z.string().trim().min(1, 'Say what kind of role you want.').max(120),
  // Empty for the job feed: the whole country.
  where: z.string().trim().max(120).default(''),
  country: z.string().toLowerCase().refine((value) => value in ADZUNA_COUNTRIES, 'Choose a supported country.'),
})

const isLinkedin = (url: string) => {
  const host = new URL(url).hostname.toLowerCase()
  return host === 'linkedin.com' || host.endsWith('.linkedin.com')
}

const JobPatch = z.object({
  status: z.enum(JOB_STATUSES).optional(),
  notes: z.string().max(2000).nullable().optional(),
  coverLetter: z.string().max(6000).optional(),
  nextAt: z.string().datetime().nullable().optional(),
  offer: z.object({ base: z.number().int().min(0).max(100_000_000).nullable(), currency: z.string().trim().toUpperCase().length(3), extras: z.string().trim().max(1000) }).nullable().optional(),
})

const findJob = (db: Db, id: string, userId: string) => db.query.job.findFirst({ where: and(eq(schema.job.id, id), eq(schema.job.userId, userId)) })
/** For the routes that work from the evaluation: a saved, unevaluated posting is not found there (the UI asks to evaluate first). */
const findEvaluated = async (db: Db, id: string, userId: string) => {
  const row = await findJob(db, id, userId)
  return row?.evaluation ? (row as typeof row & { evaluation: JobEvaluation }) : undefined
}

app.get('/api/jobs', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const [jobs, resumeText] = await Promise.all([loadJobSummaries(db, userId), loadResumeText(db, userId)])
  // Without an imported résumé, evaluations and CVs work from the badge fields alone.
  return c.json({ jobs, hasResume: !!resumeText })
})

// Optional city search. Unlike public ATS boards, Adzuna needs secret keys and therefore runs here.
app.get('/api/listings', async (c) => {
  if (!adzunaEnabled(c.env)) return c.json({ error: 'City search is not configured.' }, 404)
  const parsed = ListingQuerySchema.safeParse({ what: c.req.query('what'), where: c.req.query('where'), country: c.req.query('country') })
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid search' }, 400)
  try {
    return c.json({ listings: await searchAdzuna(c.env, c.get('db'), parsed.data) })
  } catch (err) {
    console.error('adzuna search failed', err)
    return c.json({ error: 'City search could not reach Adzuna. Its daily allowance may be used up; try again later.' }, 502)
  }
})

const list = (v: string | undefined) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : [])
const VacancyQuerySchema = z.object({
  q: z.string().max(120).default(''),
  countries: z.array(z.string().max(4)).max(40),
  level: z.enum(FEED_LEVELS).default('any'),
  functions: z.array(z.string().max(20)).max(20),
  industries: z.array(z.string().max(30)).max(20),
  languages: z.array(z.enum(SPOKEN_LANGUAGES)).max(16),
  remoteOnly: z.boolean(),
  sponsorsOnly: z.boolean(),
  deadlineWithin: z.coerce.number().int().min(1).max(365).nullable(),
  newWithin: z.coerce.number().int().min(1).max(90).nullable(),
  programs: z.array(z.string().max(30)).max(10),
  sort: z.enum(['match', 'new', 'deadline']).default('match'),
  offset: z.coerce.number().int().min(0).max(3000).default(0),
  similar: z.object({ url: z.string().max(2000), title: z.string().max(300) }).nullable(),
})

// The scraped early-career feed (startup-radar fills `vacancy`), ranked for this seeker. No model call.
app.get('/api/vacancies', async (c) => {
  const q = (k: string) => c.req.query(k)
  const parsed = VacancyQuerySchema.safeParse({
    q: q('q'), countries: list(q('countries')).map((x) => x.toUpperCase()), level: q('level'), functions: list(q('functions')),
    industries: list(q('industries')), languages: list(q('languages')), remoteOnly: q('remote') === '1', sponsorsOnly: q('sponsors') === '1',
    deadlineWithin: q('deadline_within') || null, newWithin: q('new_within') || null, programs: list(q('programs')), sort: q('sort'), offset: q('offset'),
    similar: q('similar') || q('similar_title') ? { url: q('similar') ?? '', title: q('similar_title') ?? '' } : null,
  })
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid filters' }, 400)
  const db = c.get('db')
  const userId = c.get('userId')
  const profile = await loadProfile(db, userId)
  return c.json(await searchVacancies(db, userId, { ...parsed.data, blocked: profile?.jobFeed?.blocked ?? [] }, [...(profile?.skills ?? []), ...(profile?.targetIndustries ?? [])]))
})

app.get('/api/vacancies/facets', async (c) => {
  c.header('cache-control', 'private, max-age=600')
  return c.json(await vacancyFacets(c.get('db')))
})

// The extension's job-page badge, on click: is this page's posting on the seeker's board, and how well does the CV cover it.
// Matched by postingKey, so tracking parameters and a trailing /apply don't matter. No model call.
app.get('/api/jobs/lookup', async (c) => {
  const url = c.req.query('url') ?? ''
  if (!/^https?:\/\//.test(url)) return c.json({ error: 'A link is required.' }, 400)
  const db = c.get('db')
  const userId = c.get('userId')
  const bare = (k: string) => k.replace(/\/(apply|application|confirmation|thank-?you)$/, '')
  const want = bare(await postingKey(url, ''))
  // ponytail: compares against the seeker's 200 newest jobs in JS; an indexed key column if boards get bigger.
  const jobs = await loadJobSummaries(db, userId)
  let hit = null
  for (const j of jobs) if (j.url && bare(await postingKey(j.url, '')) === want) { hit = j; break }
  if (!hit) return c.json({ job: null, keywords: null })
  const row = await findJob(db, hit.id, userId)
  if (!row?.evaluation) return c.json({ job: hit, keywords: null })
  const [profile, resumeText] = await Promise.all([loadProfile(db, userId), loadResumeText(db, userId)])
  const cv = row.cv ? cvPlain(row.cv) : cvText(profile, resumeText)
  return c.json({ job: hit, keywords: { total: row.evaluation.keywords.length, missing: missingKeywords(cv, row.evaluation.keywords) } })
})

app.get('/api/jobs/:id', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const row = await findJob(db, c.req.param('id'), userId)
  if (!row) return c.json({ error: 'Posting not found' }, 404)
  if (c.req.query('keywords') !== '1') return c.json({ job: toJob(row) })
  // ?keywords=1 (the extension): posting keywords absent from the CV the seeker would send, the tailored one when it exists.
  const [profile, resumeText] = await Promise.all([loadProfile(db, userId), loadResumeText(db, userId)])
  const cv = row.cv ? cvPlain(row.cv) : cvText(profile, resumeText)
  return c.json({ job: toJob(row), missingKeywords: row.evaluation ? missingKeywords(cv, row.evaluation.keywords) : [] })
})

// Paste a posting → one evaluation call → pinned on the board. Charged to the monthly budget.
// Postings are shared across users by postingKey: a repeat paste returns the seeker's existing job for free,
// and a posting someone else already brought in skips the page read (the evaluation is still per seeker).
// With `save`, the posting is only saved (free, no model call) and evaluated later from its page.
app.post('/api/jobs', async (c) => {
  const parsed = JobInputSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid posting' }, 400)
  const url = parsed.data.url || null
  const db = c.get('db')
  const userId = c.get('userId')
  const save = parsed.data.save
  if (save) {
    if (!url) return c.json({ error: 'A saved posting needs its link.' }, 400)
    const { mine } = await findPosting(db, userId, url, parsed.data.jdText)
    if (mine) return c.json({ job: toJob(mine), existing: true })
    const row = await saveJob(db, userId, { url, jdText: parsed.data.jdText, company: save.company, role: save.role, location: save.location ?? null, nextAt: save.deadline ? new Date(`${save.deadline}T12:00:00Z`) : null })
    return c.json({ job: toJob(row), existing: false })
  }
  // Never read LinkedIn: its postings sit behind a login.
  if (!parsed.data.jdText && url && isLinkedin(url)) return c.json({ error: 'LinkedIn pages cannot be read — paste the posting text instead.' }, 422)
  const { mine, shared, key } = await findPosting(db, userId, url, parsed.data.jdText)
  if (mine) return c.json({ job: toJob(mine), existing: true })
  return evaluateInto(c, { url, jdText: parsed.data.jdText, shared, key })
})

// Evaluates a saved posting in place; its deadline and notes stay.
app.post('/api/jobs/:id/evaluate', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const row = await findJob(db, c.req.param('id'), userId)
  if (!row) return c.json({ error: 'Posting not found' }, 404)
  if (row.evaluation) return c.json({ job: toJob(row), existing: true })
  if (!row.jdText && row.url && isLinkedin(row.url)) return c.json({ error: 'LinkedIn pages cannot be read — paste the posting text instead.' }, 422)
  const { shared, key } = await sharedPosting(db, row.url, row.jdText)
  return evaluateInto(c, { url: row.url, jdText: row.jdText, shared, key, savedId: row.id })
})

/** The charged half of POST /api/jobs and /evaluate: read the page when there is no text, one evaluation call, pin it. */
async function evaluateInto(c: Context<{ Bindings: Env; Variables: Variables }>, p: { url: string | null; jdText: string; savedId?: string; shared: Awaited<ReturnType<typeof sharedPosting>>['shared']; key: string | null }) {
  const db = c.get('db')
  const userId = c.get('userId')
  if (c.get('trial')) return c.json({ error: 'Checking and tailoring open once your account is approved. Save the role for now.' }, 403)
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const [profile, resumeText] = await Promise.all([loadProfile(db, userId), loadResumeText(db, userId)])
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  try {
    const jdText = p.jdText || p.shared?.jdText || (await fetchProfileText(c.env, p.url!, meter, db)).slice(0, JD_TEXT_LIMIT)
    if (jdText.length < 200) return c.json({ error: 'That page could not be read. Paste the posting text instead.' }, 422)
    const { evaluation } = await evaluateJob(c.env, jdText, profile, resumeText, meter, await userStyle(db, userId, 'agisse_job_evaluation'))
    const row = await insertJob(db, userId, { url: p.url, jdText, evaluation, shared: p.shared, key: p.key, savedId: p.savedId })
    meter.ref = row.id
    return c.json({ job: toJob(row), existing: false })
  } catch (err) {
    return c.json({ error: modelError(err, 'read the posting') }, 502)
  } finally {
    await charge(db, userId, 'job', meter)
  }
}

// Jev's quick verdict on pasted text before the full evaluation. Nothing is stored; its ~$0.00002 is booked like any call.
app.post('/api/jobs/quick-fit', async (c) => {
  const parsed = z.object({ jdText: z.string().trim().min(200).max(JD_TEXT_LIMIT) }).safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: 'Paste the whole job description first.' }, 400)
  const db = c.get('db')
  const userId = c.get('userId')
  const [profile, resumeText] = await Promise.all([loadProfile(db, userId), loadResumeText(db, userId)])
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  try {
    return c.json(await quickFit(c.env, parsed.data.jdText, cvText(profile, resumeText), meter, c.req.raw.signal))
  } catch {
    return c.json({ error: 'The quick check is unavailable right now. The full evaluation still works.' }, 502)
  } finally {
    await charge(db, userId, 'job', meter)
  }
})

app.patch('/api/jobs/:id', async (c) => {
  const parsed = JobPatch.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: 'Invalid update' }, 400)
  const set: PgUpdateSetSource<typeof schema.job> = { updatedAt: new Date() }
  if (parsed.data.status !== undefined) {
    set.status = parsed.data.status
    if (parsed.data.status === 'applied') set.appliedAt = new Date()
    if (parsed.data.status === 'saved' || parsed.data.status === 'evaluated' || parsed.data.status === 'discarded') set.appliedAt = null
    // The date means something else at the new status, so it goes unless this patch gives one.
    set.nextAt = null
    set.history = pushStatus(parsed.data.status)
  }
  if (parsed.data.offer !== undefined) set.offer = parsed.data.offer
  if (parsed.data.nextAt !== undefined) set.nextAt = parsed.data.nextAt ? new Date(parsed.data.nextAt) : null
  if (parsed.data.notes !== undefined) set.notes = parsed.data.notes
  if (parsed.data.coverLetter !== undefined) {
    set.coverLetter = parsed.data.coverLetter
    set.coverEdited = sql`${schema.job.coverEdited} or ${schema.job.coverLetter} is distinct from ${parsed.data.coverLetter}`
  }
  const [row] = await c
    .get('db')
    .update(schema.job)
    .set(set)
    .where(and(eq(schema.job.id, c.req.param('id')), eq(schema.job.userId, c.get('userId'))))
    .returning()
  if (!row) return c.json({ error: 'Posting not found' }, 404)
  return c.json({ job: toJob(row) })
})

app.delete('/api/jobs/:id', async (c) => {
  await c
    .get('db')
    .delete(schema.job)
    .where(and(eq(schema.job.id, c.req.param('id')), eq(schema.job.userId, c.get('userId'))))
  return c.json({ ok: true })
})

// Thumbs up or down on a generated output: rates the latest generation of that task for that job or person.
// Feeds model routing and the quality report (worker/lib/quality.ts), and the seeker's next drafts (userStyle).
const Feedback = z.object({ task: z.enum(RATED_TASKS), refId: z.string().min(1).max(100), good: z.boolean(), note: z.string().trim().max(500).optional() })

app.post('/api/feedback', async (c) => {
  const parsed = Feedback.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: 'Invalid feedback' }, 400)
  const { task, refId, good, note } = parsed.data
  const db = c.get('db')
  const latest = db
    .select({ id: schema.usage.id })
    .from(schema.usage)
    .where(and(eq(schema.usage.userId, c.get('userId')), eq(schema.usage.task, task), eq(schema.usage.refId, refId)))
    .orderBy(desc(schema.usage.createdAt))
    .limit(1)
  const [row] = await db
    .update(schema.usage)
    .set({ rating: good ? 1 : -1, note: note || null })
    .where(eq(schema.usage.id, sql`(${latest})`))
    .returning({ id: schema.usage.id })
  // Outputs from before the generation log have no row to rate.
  if (!row) return c.json({ error: 'Nothing to rate yet: this was written before ratings existed. Rewrite it to rate the new version.' }, 404)
  return c.json({ ok: true })
})

// Tailored CV and cover letter: written on demand and stored; ?rewrite=1 writes them again. Charged like the evaluation.
app.post('/api/jobs/:id/:doc{cv|cover}', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const doc = c.req.param('doc') as 'cv' | 'cover'
  const row = await findEvaluated(db, c.req.param('id'), userId)
  if (!row) return c.json({ error: 'Posting not found' }, 404)
  if ((doc === 'cv' ? row.cv : row.coverLetter) && c.req.query('rewrite') !== '1') return c.json({ job: toJob(row) })
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const [profile, resumeText, u] = await Promise.all([
    loadProfile(db, userId),
    loadResumeText(db, userId),
    db.query.user.findFirst({ where: eq(schema.user.id, userId), columns: { name: true } }),
  ])
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  meter.ref = row.id
  try {
    const set =
      doc === 'cv'
        ? { cv: (await tailorCv(c.env, row, profile, resumeText, meter, await userStyle(db, userId, 'agisse_cv', row.id))).cv }
        : { coverLetter: (await draftCover(c.env, row, profile, resumeText, u?.name ?? '', meter, await userStyle(db, userId, 'agisse_cover', row.id))).letter, coverEdited: false }
    const [updated] = await db.update(schema.job).set({ ...set, updatedAt: new Date() }).where(eq(schema.job.id, row.id)).returning()
    return c.json({ job: toJob(updated ?? row) })
  } catch (err) {
    return c.json({ error: modelError(err, doc === 'cv' ? 'tailor the CV' : 'write the cover letter') }, 502)
  } finally {
    await charge(db, userId, 'job', meter)
  }
})

const JobEmailInput = z.object({
  kind: z.enum(EMAIL_KINDS).exclude(['intro']),
  lang: z.enum(NOTE_LANGUAGES).default('en'),
  // Thank-you: who the seeker met and what came up. Follow-up: anything the seeker wants mentioned.
  notes: z.string().trim().max(1000).default(''),
})

// Follow-up on a silent application or thank-you after an interview. Returned, not stored. Charged like the cover letter.
app.post('/api/jobs/:id/email', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const parsed = JobEmailInput.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: 'Choose a follow-up or a thank-you email.' }, 400)
  const row = await findJob(db, c.req.param('id'), userId)
  if (!row) return c.json({ error: 'Posting not found' }, 404)
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const [profile, resumeText, u] = await Promise.all([
    loadProfile(db, userId),
    loadResumeText(db, userId),
    db.query.user.findFirst({ where: eq(schema.user.id, userId), columns: { name: true } }),
  ])
  const { kind, lang, notes } = parsed.data
  const context = `Company: ${row.company}
Role: ${row.role}
Status: ${row.status}${row.appliedAt ? `, applied ${row.appliedAt.toISOString().slice(0, 10)}` : ''}
Today: ${new Date().toISOString().slice(0, 10)}
NOTES: ${notes || 'none'}

POSTING
${row.jdText.slice(0, 6000)}`
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  meter.ref = row.id
  try {
    const { email } = await draftEmail(c.env, kind, context, profile, resumeText, u?.name ?? '', lang, meter)
    return c.json({ email })
  } catch (err) {
    return c.json({ error: modelError(err, 'write the email') }, 502)
  } finally {
    await charge(db, userId, 'job', meter)
  }
})

const FormAnswerInput = z.object({ question: z.string().trim().min(3).max(1000), maxChars: z.number().int().min(20).max(10_000).nullable().default(null) })

// One application-form question answered from the CV and this posting. Returned, not stored. Charged like the cover letter.
app.post('/api/jobs/:id/answer', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const parsed = FormAnswerInput.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: 'Paste the question from the form.' }, 400)
  const row = await findEvaluated(db, c.req.param('id'), userId)
  if (!row) return c.json({ error: 'Posting not found' }, 404)
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const [profile, resumeText] = await Promise.all([loadProfile(db, userId), loadResumeText(db, userId)])
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  meter.ref = row.id
  try {
    const { answer } = await answerQuestion(c.env, row, parsed.data.question, parsed.data.maxChars, profile, resumeText, meter)
    return c.json({ answer })
  } catch (err) {
    return c.json({ error: modelError(err, 'answer the question') }, 502)
  } finally {
    await charge(db, userId, 'job', meter)
  }
})

const CheckInput = z.object({ resume: z.string().max(20_000).optional(), cover: z.string().max(6000).optional() })

// Checks the seeker's résumé and cover letter against the posting and ATS screening. Not stored. Charged like the evaluation.
// No pasted résumé: the tailored CV, else the imported résumé, else the badge fields. No pasted letter: the stored one.
app.post('/api/jobs/:id/check', async (c) => {
  const parsed = CheckInput.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: 'The résumé or letter is too long.' }, 400)
  const db = c.get('db')
  const userId = c.get('userId')
  const row = await findEvaluated(db, c.req.param('id'), userId)
  if (!row) return c.json({ error: 'Posting not found' }, 404)
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const [profile, resumeText] = await Promise.all([loadProfile(db, userId), loadResumeText(db, userId)])
  const record = cvText(profile, resumeText)
  const pasted = parsed.data.resume?.trim()
  const [resume, source] = pasted ? [pasted, 'pasted' as const] : row.cv ? [cvPlain(row.cv), 'tailored' as const] : resumeText?.trim() ? [resumeText, 'imported' as const] : [record, 'badge' as const]
  if (resume.trim().length < 100) return c.json({ error: 'Paste your résumé first: there is nothing to check yet.' }, 422)
  const cover = parsed.data.cover?.trim() || row.coverLetter || ''
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  meter.ref = row.id
  try {
    const { check } = await checkApplication(c.env, row, { resume, cover }, source, record, meter)
    return c.json({ check })
  } catch (err) {
    return c.json({ error: modelError(err, 'check the application') }, 502)
  } finally {
    await charge(db, userId, 'job', meter)
  }
})

// ---- Assessment prep: the online assessment a posting leads to, and training for it ----

const toAssessment = (a: typeof schema.assessmentIntel.$inferSelect): CompanyAssessment => ({
  id: a.id,
  company: a.company,
  rolePattern: a.rolePattern,
  location: a.location,
  provider: a.provider,
  assessmentTypes: a.assessmentTypes,
  gameTypes: a.gameTypes,
  skills: a.skills,
  weightsEstimated: a.weightsEstimated,
  stages: a.stages,
  difficulty: a.difficulty,
  timeLimits: a.timeLimits,
  scoringDimensions: a.scoringDimensions,
  sources: a.sources,
  sourceDate: a.sourceDate,
  confidence: a.confidence,
  origin: a.origin,
  notes: a.notes,
})

const toReport = (r: typeof schema.assessmentReport.$inferSelect): AssessmentReport => ({ id: r.id, company: r.company, kind: r.kind, detail: r.detail, createdAt: r.createdAt.toISOString() })

const toSession = (s: typeof schema.trainingSession.$inferSelect): TrainingSession => ({ id: s.id, jobId: s.jobId, mode: s.mode, gameId: s.gameId, providerGameId: s.providerGameId, durationSec: s.durationSec, result: s.result, createdAt: s.createdAt.toISOString() })

// ponytail: all of a company's rows are ranked in JS; fine while a company has a handful of rows.
// Curated rows go first, so they win ties; a newer researched or reported row still beats them.
async function assessmentFor(db: Db, j: { company: string; role: string; location: string | null }): Promise<CompanyAssessment | null> {
  const rows = await db.query.assessmentIntel.findMany({ where: eq(schema.assessmentIntel.companyKey, companyKey(j.company)), orderBy: desc(schema.assessmentIntel.createdAt), limit: 50 })
  const curated = curatedFor(j.company).map(({ aliases: _, ...c }) => ({ ...c, id: `curated:${companyKey(c.company)}:${c.rolePattern ?? ''}` }))
  const best = bestMatch<CompanyAssessment>([...curated, ...rows.map(toAssessment)], j.role, j.location)
  // A researched row still gets the known interview format for its company.
  return best && { ...best, interview: best.interview ?? curated[0]?.interview ?? null }
}

// Shared across users: the intel for this posting's company, plus reports filed since its sources were checked.
app.get('/api/jobs/:id/assessment', async (c) => {
  const db = c.get('db')
  const row = await findJob(db, c.req.param('id'), c.get('userId'))
  if (!row) return c.json({ error: 'Posting not found' }, 404)
  const assessment = await assessmentFor(db, row)
  const reports = await db.query.assessmentReport.findMany({
    where: and(eq(schema.assessmentReport.companyKey, companyKey(row.company)), assessment ? gte(schema.assessmentReport.createdAt, new Date(assessment.sourceDate)) : undefined),
    orderBy: desc(schema.assessmentReport.createdAt),
    limit: assessment ? 50 : 10,
  })
  return c.json({ assessment, reports: reports.map(toReport) })
})

// Two web searches + one model call → a new shared intel row. Charged to the monthly budget.
app.post('/api/jobs/:id/assessment/research', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const row = await findJob(db, c.req.param('id'), userId)
  if (!row) return c.json({ error: 'Posting not found' }, 404)
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  meter.ref = row.id
  try {
    const { assessment } = await researchAssessment(c.env, { company: row.company, role: row.role, location: row.location, jdText: row.jdText }, meter, db)
    await db.insert(schema.assessmentIntel).values({ ...assessment, id: crypto.randomUUID(), company: row.company, companyKey: companyKey(row.company), createdBy: userId })
    return c.json({ assessment: await assessmentFor(db, row) })
  } catch (err) {
    return c.json({ error: modelError(err, 'research the assessment') }, 502)
  } finally {
    await charge(db, userId, 'assessment', meter)
  }
})

// ---- Selection process: how the company's hiring rounds run, researched from public reviews and forums ----

const toSelection = (r: typeof schema.selectionIntel.$inferSelect): SelectionProcess => ({
  id: r.id,
  company: r.company,
  rolePattern: r.rolePattern,
  location: r.location,
  stages: r.stages,
  questions: r.questions,
  values: r.values,
  timeline: r.timeline,
  difficulty: r.difficulty,
  advice: r.advice,
  pitfalls: r.pitfalls,
  sources: r.sources,
  sourceDate: r.sourceDate,
  confidence: r.confidence,
  notes: r.notes,
})

async function selectionFor(db: Db, j: { company: string; role: string; location: string | null }) {
  const rows = await db.query.selectionIntel.findMany({ where: eq(schema.selectionIntel.companyKey, companyKey(j.company)), orderBy: desc(schema.selectionIntel.createdAt), limit: 50 })
  const best = bestMatch(rows, j.role, j.location)
  return best ? toSelection(best) : null
}

app.get('/api/jobs/:id/selection', async (c) => {
  const db = c.get('db')
  const row = await findJob(db, c.req.param('id'), c.get('userId'))
  if (!row) return c.json({ error: 'Posting not found' }, 404)
  return c.json({ selection: await selectionFor(db, row) })
})

// Four web searches + one model call → a new shared row. Charged to the monthly budget.
app.post('/api/jobs/:id/selection/research', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const row = await findJob(db, c.req.param('id'), userId)
  if (!row) return c.json({ error: 'Posting not found' }, 404)
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  meter.ref = row.id
  try {
    const { selection } = await researchSelection(c.env, { company: row.company, role: row.role, location: row.location, jdText: row.jdText }, meter, db)
    await db.insert(schema.selectionIntel).values({ ...selection, id: crypto.randomUUID(), company: row.company, companyKey: companyKey(row.company), createdBy: userId })
    return c.json({ selection: await selectionFor(db, row) })
  } catch (err) {
    return c.json({ error: modelError(err, 'research the selection process') }, 502)
  } finally {
    await charge(db, userId, 'selection', meter)
  }
})

const AnswerInput = z.object({
  question: z.string().trim().min(1).max(ANSWER_QUESTION_LIMIT),
  answer: z.string().trim().min(20, 'Write a little more before asking for feedback').max(ANSWER_TEXT_LIMIT),
  source: z.enum(['text', 'mock']).default('text'),
  delivery: z
    .object({ durationSec: z.number().min(0).max(900), words: z.number().int().min(0).max(5000), wpm: z.number().min(0).max(600), fillers: z.number().int().min(0).max(1000), retakes: z.number().int().min(0).max(10), startDelaySec: z.number().min(0).max(900) })
    .nullable()
    .default(null),
})

const toPractice = (p: typeof schema.practiceAnswer.$inferSelect): PracticeAnswer => ({
  id: p.id,
  question: p.question,
  answer: p.answer,
  feedback: p.feedback,
  source: p.source,
  delivery: p.delivery ?? null,
  createdAt: p.createdAt.toISOString(),
})

/** The gaps flagged on this user's last few answers, any posting: fed back so feedback can say what improved. */
async function recentGaps(db: Db, userId: string) {
  const rows = await db.query.practiceAnswer.findMany({ where: eq(schema.practiceAnswer.userId, userId), orderBy: desc(schema.practiceAnswer.createdAt), limit: 5, columns: { feedback: true } })
  return [...new Set(rows.flatMap((r) => r.feedback.gaps))].slice(0, 5)
}

// The seeker's stored practice attempts for one posting, newest first.
app.get('/api/jobs/:id/practice', async (c) => {
  const rows = await c.get('db').query.practiceAnswer.findMany({
    where: and(eq(schema.practiceAnswer.jobId, c.req.param('id')), eq(schema.practiceAnswer.userId, c.get('userId'))),
    orderBy: desc(schema.practiceAnswer.createdAt),
    limit: 100,
  })
  return c.json({ answers: rows.map(toPractice) })
})

// Feedback on one practice answer: one model call, stored with the answer. The same answer again is served from the store for free.
app.post('/api/jobs/:id/answer-feedback', async (c) => {
  const parsed = AnswerInput.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid answer' }, 400)
  const db = c.get('db')
  const userId = c.get('userId')
  const row = await findJob(db, c.req.param('id'), userId)
  if (!row) return c.json({ error: 'Posting not found' }, 404)
  const { question, answer, source, delivery } = parsed.data
  const same = await db.query.practiceAnswer.findFirst({
    where: and(eq(schema.practiceAnswer.jobId, row.id), eq(schema.practiceAnswer.userId, userId), eq(schema.practiceAnswer.question, question), eq(schema.practiceAnswer.answer, answer)),
  })
  if (same) return c.json({ feedback: same.feedback, answer: toPractice(same) })
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const [profile, resumeText, gaps] = await Promise.all([loadProfile(db, userId), loadResumeText(db, userId), recentGaps(db, userId)])
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  meter.ref = row.id
  try {
    const feedback = await answerFeedback(c.env, row, cvText(profile, resumeText), question, answer, meter, gaps)
    const [saved] = await db.insert(schema.practiceAnswer).values({ id: crypto.randomUUID(), userId, jobId: row.id, question, answer, feedback, source, delivery }).returning()
    return c.json({ feedback, answer: toPractice(saved!) })
  } catch (err) {
    return c.json({ error: modelError(err, 'review the answer') }, 502)
  } finally {
    await charge(db, userId, 'interview', meter)
  }
})

// Feedback on a practice answer with no posting (the field question bank). One model call; not stored, since a stored attempt belongs to a posting.
const FieldAnswerInput = AnswerInput.extend({ field: z.string().trim().min(1).max(60) })

app.post('/api/interview/answer-feedback', async (c) => {
  const parsed = FieldAnswerInput.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid answer' }, 400)
  const db = c.get('db')
  const userId = c.get('userId')
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const [profile, resumeText, gaps] = await Promise.all([loadProfile(db, userId), loadResumeText(db, userId), recentGaps(db, userId)])
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  const { field, question, answer } = parsed.data
  try {
    const feedback = await answerFeedback(c.env, { company: 'an employer in this field', role: `graduate role in ${field}`, location: null, jdText: '' }, cvText(profile, resumeText), question, answer, meter, gaps)
    return c.json({ feedback })
  } catch (err) {
    return c.json({ error: modelError(err, 'review the answer') }, 502)
  } finally {
    await charge(db, userId, 'interview', meter)
  }
})

// The user's history across postings for the progress overview: answers (with feedback) and every CV review score.
app.get('/api/progress', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const [answers, cvLog] = await Promise.all([
    db.query.practiceAnswer.findMany({ where: eq(schema.practiceAnswer.userId, userId), orderBy: desc(schema.practiceAnswer.createdAt), limit: 100 }),
    db.query.cvReviewLog.findMany({ where: eq(schema.cvReviewLog.userId, userId), orderBy: desc(schema.cvReviewLog.createdAt), limit: 100 }),
  ])
  return c.json({
    answers: answers.map((a) => ({ ...toPractice(a), jobId: a.jobId })),
    cvLog: cvLog.map((r) => ({ score: r.score, failed: r.failed, at: r.createdAt.toISOString() })),
  } satisfies ProgressData)
})

// Mock video interview: the question set for this company and kind of role, generated once and shared by every user.
app.get('/api/jobs/:id/interview-questions', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const row = await findJob(db, c.req.param('id'), userId)
  if (!row) return c.json({ error: 'Posting not found' }, 404)
  const assessment = await assessmentFor(db, row)
  const format = assessment?.interview ?? { prepSec: 30, answerSec: 120, retakes: 1, questions: 5 }
  const key = { companyKey: companyKey(row.company), roleKey: roleKey(row.role) }
  const cached = await db.query.interviewQuestionSet.findFirst({ where: and(eq(schema.interviewQuestionSet.companyKey, key.companyKey), eq(schema.interviewQuestionSet.roleKey, key.roleKey)) })
  if (cached) return c.json({ questions: cached.questions, format })
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  meter.ref = row.id
  try {
    const reported = (await selectionFor(db, row))?.questions.map((q) => q.question) ?? []
    const questions: InterviewQuestion[] = await interviewQuestions(c.env, row, reported, Math.max(3, Math.min(8, format.questions)), meter)
    await db.insert(schema.interviewQuestionSet).values({ id: crypto.randomUUID(), ...key, questions }).onConflictDoNothing()
    return c.json({ questions, format })
  } catch (err) {
    return c.json({ error: modelError(err, 'prepare the interview questions') }, 502)
  } finally {
    await charge(db, userId, 'interview', meter)
  }
})

// Speech to text for browsers without speech recognition. The audio is sent on to the model and never stored.
const TranscribeInput = z.object({ audio: z.string().min(100).max(4_000_000), format: z.enum(['webm', 'ogg', 'mp4', 'wav']) })

app.post('/api/transcribe', async (c) => {
  const parsed = TranscribeInput.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: 'Recording too long or unreadable. Keep answers under 3 minutes.' }, 400)
  const db = c.get('db')
  const userId = c.get('userId')
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  try {
    const text = await transcribe({ apiKey: c.env.OPENROUTER_API_KEY, model: c.env.OPENROUTER_AUDIO_MODEL, ...parsed.data, meter })
    return c.json({ text })
  } catch (err) {
    return c.json({ error: modelError(err, 'transcribe the answer') }, 502)
  } finally {
    await charge(db, userId, 'interview', meter)
  }
})

// Salary search (1–2 Exa calls) + one model call → stored on the job. Charged to the monthly budget.
app.post('/api/jobs/:id/offer-brief', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const row = await findJob(db, c.req.param('id'), userId)
  if (!row) return c.json({ error: 'Posting not found' }, 404)
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  meter.ref = row.id
  try {
    const brief = await offerBrief(c.env, row, meter, db)
    const [updated] = await db.update(schema.job).set({ offerBrief: brief, updatedAt: new Date() }).where(eq(schema.job.id, row.id)).returning()
    return c.json({ job: toJob(updated ?? row) })
  } catch (err) {
    return c.json({ error: modelError(err, 'prepare the negotiation brief') }, 502)
  } finally {
    await charge(db, userId, 'offer', meter)
  }
})

// Salary expectation + company health for any posting: 2–3 Exa calls + one model call → stored on the job. Charged to the monthly budget.
app.post('/api/jobs/:id/pay-check', async (c) => {
  const db = c.get('db')
  const userId = c.get('userId')
  const row = await findEvaluated(db, c.req.param('id'), userId)
  if (!row) return c.json({ error: 'Posting not found' }, 404)
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  meter.ref = row.id
  try {
    // Wikidata facts only when a scout already cached them; no live lookup here.
    const domain = row.evaluation.role.domain
    const known = domain ? await db.query.company.findFirst({ where: eq(schema.company.domain, domain), columns: { facts: true } }) : undefined
    const check = await payCheck(c.env, row, known?.facts ?? null, meter, db)
    const [updated] = await db.update(schema.job).set({ payCheck: check, updatedAt: new Date() }).where(eq(schema.job.id, row.id)).returning()
    return c.json({ job: toJob(updated ?? row) })
  } catch (err) {
    return c.json({ error: modelError(err, 'check pay and company health') }, 502)
  } finally {
    await charge(db, userId, 'pay', meter)
  }
})

const ReportInput = z.object({
  jobId: z.string().min(1).max(100),
  kind: z.enum(REPORT_KINDS),
  detail: z.string().trim().max(500).nullable().optional(),
})

app.post('/api/assessments/reports', async (c) => {
  const parsed = ReportInput.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid report' }, 400)
  const db = c.get('db')
  const job = await findJob(db, parsed.data.jobId, c.get('userId'))
  if (!job) return c.json({ error: 'Posting not found' }, 404)
  const [report] = await db
    .insert(schema.assessmentReport)
    .values({ id: crypto.randomUUID(), userId: c.get('userId'), company: job.company, companyKey: companyKey(job.company), jobId: job.id, kind: parsed.data.kind, detail: parsed.data.detail || null })
    .returning()
  return c.json({ report: toReport(report!) })
})

const score100 = z.number().min(0).max(100)
const TrainingInput = z.strictObject({
  jobId: z.string().min(1).max(100).nullable(),
  mode: z.enum(TRAINING_MODES),
  gameId: z.enum(GAME_IDS),
  providerGameId: z.string().max(80).nullable().default(null),
  durationSec: z.number().int().min(0).max(4 * 60 * 60),
  result: z.strictObject({
    score: score100,
    accuracy: z.number().min(0).max(1),
    medianResponseTime: z.number().min(0).max(600_000),
    difficultyReached: z.number().min(0).max(100),
    errors: z.number().int().min(0).max(100_000),
    trials: z.number().int().min(0).max(100_000),
    skillMetrics: z.partialRecord(z.enum(COGNITIVE_SKILLS), score100),
    details: z.record(z.string().max(40), z.number()).refine((d) => Object.keys(d).length <= 30, 'Too many details'),
  }),
})

// Training is free (no model call), so it is not budget-checked.
app.get('/api/training', async (c) => {
  const jobId = c.req.query('jobId')
  const rows = await c.get('db').query.trainingSession.findMany({
    where: and(eq(schema.trainingSession.userId, c.get('userId')), jobId ? eq(schema.trainingSession.jobId, jobId) : undefined),
    orderBy: desc(schema.trainingSession.createdAt),
    limit: 500,
  })
  return c.json({ sessions: rows.map(toSession) })
})

app.post('/api/training', async (c) => {
  const parsed = TrainingInput.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid session' }, 400)
  const db = c.get('db')
  const userId = c.get('userId')
  const pgId = parsed.data.providerGameId
  if (pgId && providerGame(pgId)?.gameId !== parsed.data.gameId) return c.json({ error: 'Unknown test version' }, 400)
  if (parsed.data.jobId && !(await findJob(db, parsed.data.jobId, userId))) return c.json({ error: 'Posting not found' }, 404)
  const [row] = await db
    .insert(schema.trainingSession)
    .values({ id: crypto.randomUUID(), userId, ...parsed.data })
    .returning()
  return c.json({ session: toSession(row!) })
})

// Per skill: each user's average over the last 7 days. A percentile only once enough real users trained it.
// ponytail: one row per (user, skill) pulled into JS; move the ranking into SQL (percent_rank) past a few thousand users.
app.get('/api/training/benchmarks', async (c) => {
  const userId = c.get('userId')
  const { rows } = await c.get('db').execute<{ skill: string; user_id: string; avg: number }>(sql`
    select m.key as skill, t.user_id, avg(m.value::float) as avg
    from ${schema.trainingSession} t, jsonb_each_text(t.result->'skillMetrics') m
    where t.created_at >= now() - interval '7 days'
    group by m.key, t.user_id`)
  const benchmarks: SkillBenchmark[] = COGNITIVE_SKILLS.map((skill) => {
    const own = rows.filter((r) => r.skill === skill)
    const mine = own.find((r) => r.user_id === userId)
    const percentile = mine && own.length >= BENCHMARK_MIN_USERS ? percentileOf(Number(mine.avg), own.filter((r) => r.user_id !== userId).map((r) => Number(r.avg))) : null
    return { skill, users: own.length, percentile }
  })
  return c.json({ benchmarks })
})

// ---- Scout: companies worth targeting ----

const ScoutInputSchema = z
  .object({
    dream: z.array(z.string().trim().min(1).max(80)).max(5).default([]),
    description: z.string().trim().max(1000).default(''),
    location: z.string().trim().max(120).default(''),
    sizes: z.array(z.enum(COMPANY_SIZES)).max(4).default([]),
    useProfile: z.boolean().default(true),
    exclude: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  })
  .refine((v) => v.dream.length > 0 || v.description.length >= 10, { message: 'Add a dream company or describe the kind of company (a sentence is enough).' })

const toScout = (s: typeof schema.scout.$inferSelect): Scout => ({ id: s.id, input: s.input, result: s.result, model: s.model, createdAt: s.createdAt.toISOString() })

app.get('/api/scouts', async (c) => {
  const rows = await c
    .get('db')
    .select({ id: schema.scout.id, input: schema.scout.input, picks: sql<number>`jsonb_array_length(${schema.scout.result}->'picks')`.mapWith(Number), createdAt: schema.scout.createdAt })
    .from(schema.scout)
    .where(eq(schema.scout.userId, c.get('userId')))
    .orderBy(desc(schema.scout.createdAt))
    .limit(50)
  const scouts: ScoutSummary[] = rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
  return c.json({ scouts })
})

// Bubble map: companies like one company. Exa + Wikidata only, so a click answers in seconds. Charged to the monthly budget.
app.post('/api/scouts/similar', async (c) => {
  const parsed = z.object({ name: z.string().trim().min(1).max(80), domain: z.string().max(120).nullable().default(null) }).safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: 'Name a company.' }, 400)
  const db = c.get('db')
  const userId = c.get('userId')
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  try {
    const companies = await similarCompanies(c.env, { name: parsed.data.name, domain: normalizeDomain(parsed.data.domain ?? '') || null }, meter, db)
    return c.json({ companies })
  } catch (err) {
    console.error('similar companies failed', err)
    return c.json({ error: err instanceof NoAiKey ? err.message : 'Could not find similar companies. Try again in a moment.' }, 502)
  } finally {
    await charge(db, userId, 'scout', meter)
  }
})

// Saved bubble maps. The client picks the id, so one PUT both creates and updates.
const MapBubbleSchema = z.object({
  id: z.string().max(200),
  name: z.string().max(200),
  domain: z.string().max(200).nullable(),
  what: z.string().max(2000),
  why: z.string().max(2000).nullable(),
  unverified: z.boolean(),
  facts: z.object({ qid: z.string().max(40), industry: z.string().max(200).nullable(), country: z.string().max(200).nullable(), employees: z.number().nullable(), founded: z.string().max(40).nullable() }).nullable(),
  depth: z.number().int().min(0).max(100),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
})
const BubbleMapSchema = z.object({
  name: z.string().trim().min(1).max(80),
  domain: z.string().max(120).nullable(),
  data: z.object({ nodes: z.array(MapBubbleSchema).min(1).max(1000), links: z.array(z.tuple([z.string().max(200), z.string().max(200)])).max(5000), expanded: z.array(z.string().max(200)).max(1000) }),
})
const toMap = (r: typeof schema.bubbleMap.$inferSelect): SavedBubbleMap => ({ id: r.id, name: r.name, domain: r.domain, data: r.data, updatedAt: r.updatedAt.toISOString() })

app.get('/api/bubble-maps', async (c) => {
  const rows = await c
    .get('db')
    .select({ id: schema.bubbleMap.id, name: schema.bubbleMap.name, domain: schema.bubbleMap.domain, companies: sql<number>`jsonb_array_length(${schema.bubbleMap.data}->'nodes')`.mapWith(Number), updatedAt: schema.bubbleMap.updatedAt })
    .from(schema.bubbleMap)
    .where(eq(schema.bubbleMap.userId, c.get('userId')))
    .orderBy(desc(schema.bubbleMap.updatedAt))
    .limit(50)
  const maps: BubbleMapSummary[] = rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }))
  return c.json({ maps })
})

app.get('/api/bubble-maps/:id', async (c) => {
  const row = await c.get('db').query.bubbleMap.findFirst({ where: and(eq(schema.bubbleMap.id, c.req.param('id')), eq(schema.bubbleMap.userId, c.get('userId'))) })
  if (!row) return c.json({ error: 'Map not found' }, 404)
  return c.json({ map: toMap(row) })
})

app.put('/api/bubble-maps/:id', async (c) => {
  const id = c.req.param('id')
  const parsed = BubbleMapSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success || !z.uuid().safeParse(id).success) return c.json({ error: 'Could not read this map.' }, 400)
  const userId = c.get('userId')
  const { name, domain, data } = parsed.data
  // setWhere keeps one seeker from overwriting another's map by reusing its id.
  const [row] = await c
    .get('db')
    .insert(schema.bubbleMap)
    .values({ id, userId, name, domain, data })
    .onConflictDoUpdate({ target: schema.bubbleMap.id, set: { name, domain, data, updatedAt: new Date() }, setWhere: eq(schema.bubbleMap.userId, userId) })
    .returning()
  if (!row) return c.json({ error: 'Map not found' }, 404)
  return c.json({ map: toMap(row) })
})

app.delete('/api/bubble-maps/:id', async (c) => {
  await c
    .get('db')
    .delete(schema.bubbleMap)
    .where(and(eq(schema.bubbleMap.id, c.req.param('id')), eq(schema.bubbleMap.userId, c.get('userId'))))
  return c.json({ ok: true })
})

app.get('/api/scouts/:id', async (c) => {
  const row = await c.get('db').query.scout.findFirst({ where: and(eq(schema.scout.id, c.req.param('id')), eq(schema.scout.userId, c.get('userId'))) })
  if (!row) return c.json({ error: 'Scout not found' }, 404)
  return c.json({ scout: toScout(row) })
})

// Exa company search + Wikidata + one curation call. Charged to the monthly budget.
app.post('/api/scouts', async (c) => {
  const parsed = ScoutInputSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid scout' }, 400)
  const db = c.get('db')
  const userId = c.get('userId')
  const budget = await loadBudget(db, c.env, userId)
  if (budget.used >= budget.limit) return c.json({ error: budgetSpent(budget) }, 429)
  const input = parsed.data
  const profile = input.useProfile ? await loadProfile(db, userId) : null
  const meter = await newMeter(db, c.env, userId, !!c.get('trial'))
  try {
    const { picks, candidates, model } = await scoutCompanies(c.env, input, profile, meter, db)
    const [row] = await db.insert(schema.scout).values({ id: crypto.randomUUID(), userId, input, result: { picks, candidates }, model }).returning()
    meter.ref = row!.id
    return c.json({ scout: toScout(row!) })
  } catch (err) {
    return c.json({ error: modelError(err, 'scout companies') }, 502)
  } finally {
    await charge(db, userId, 'scout', meter)
  }
})

app.delete('/api/scouts/:id', async (c) => {
  await c
    .get('db')
    .delete(schema.scout)
    .where(and(eq(schema.scout.id, c.req.param('id')), eq(schema.scout.userId, c.get('userId'))))
  return c.json({ ok: true })
})

app.get('/api/shortlist', async (c) => {
  const rows = await c.get('db').query.savedCompany.findMany({ where: eq(schema.savedCompany.userId, c.get('userId')), orderBy: desc(schema.savedCompany.createdAt) })
  return c.json({ companies: rows.map(toSaved) })
})

app.post('/api/shortlist', async (c) => {
  const parsed = z.object(SavedCompanyInput).safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: 'A company needs a name.' }, 400)
  return c.json({ company: toSaved(await upsertSavedCompany(c.get('db'), c.get('userId'), parsed.data)) })
})

app.delete('/api/shortlist/:id', async (c) => {
  await c
    .get('db')
    .delete(schema.savedCompany)
    .where(and(eq(schema.savedCompany.id, c.req.param('id')), eq(schema.savedCompany.userId, c.get('userId'))))
  return c.json({ ok: true })
})

app.notFound(async (c) => {
  if (c.req.path.startsWith('/api/')) return c.json({ error: 'Not found' }, 404)
  const res = await c.env.ASSETS.fetch(c.req.raw)
  if (!res.headers.get('Content-Type')?.startsWith('text/html') || c.req.path.startsWith('/docs')) return res
  const home = c.req.path === '/'
  // index.html carries the homepage as plain HTML for crawlers; anyone else would see it flash before the app.
  const out = home && !/session_token=/.test(c.req.header('Cookie') ?? '') ? res : new HTMLRewriter().on('#root', { element: (el) => void el.setInnerContent('') }).transform(res)
  // Every app path falls back to the SPA shell with a 200; only the homepage should be indexed.
  if (home) return out
  const noindex = new Response(out.body, out)
  noindex.headers.set('X-Robots-Tag', 'noindex')
  return noindex
})

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: err.message || 'Something went wrong' }, 500)
})

export default {
  fetch: app.fetch,
  // Daily (wrangler.jsonc triggers): mark saved postings whose public board dropped them as closed.
  async scheduled(_event: ScheduledController, env: Env) {
    console.log('closed postings', await checkClosedPostings(createDb(env.DATABASE_URL)))
  },
} satisfies ExportedHandler<Env>
