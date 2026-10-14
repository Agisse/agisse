// Helpers shared between the HTTP API (worker/index.ts) and the MCP server (worker/lib/mcp.ts).
// Moved out of index.ts verbatim so both can reuse the same budget/query/mapping logic.
import { and, desc, eq, gt, gte, ilike, isNotNull, lt, sql } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import type { Db } from '../db'
import { schema } from '../db'
import { NoModelAvailable, type Meter } from './openrouter'
import { recommendationFor } from './jobs'
import { modelRanking } from './quality'
import { loadUserKey } from './byok'
import { EMPTY_PROFILE, type RatedTask, type Budget, type ContactedPerson, type Job, type JobSummary, type Memory, type Person, type Profile, type Search } from '../../shared/types'

export const toMemory = (m: typeof schema.memory.$inferSelect): Memory => ({ id: m.id, kind: m.kind, text: m.text, source: m.source, ref: m.ref, createdAt: m.createdAt.toISOString() })

export async function loadMemories(db: Db, userId: string): Promise<Memory[]> {
  const rows = await db.query.memory.findMany({ where: eq(schema.memory.userId, userId), orderBy: desc(schema.memory.createdAt) })
  return rows.map(toMemory)
}

/** Approved style and preference memories as a prompt block, for drafts written in the seeker's name. */
export function memoryBlock(memories: Pick<Memory, 'kind' | 'text'>[]) {
  const lines = memories.filter((m) => m.kind === 'style' || m.kind === 'preference').map((m) => `- ${m.text}`)
  return lines.length ? `\n\nTHE SEEKER'S STATED PREFERENCES (follow them; they add no facts about the seeker)\n${lines.join('\n')}` : ''
}

export async function loadResumeText(db: Db, userId: string) {
  const row = await db.query.profile.findFirst({ where: eq(schema.profile.userId, userId), columns: { resumeText: true } })
  return row?.resumeText ?? null
}

export async function loadProfile(db: Db, userId: string): Promise<Profile | null> {
  // Only `data`: the row also holds the full résumé text, which most callers don't need.
  const row = await db.query.profile.findFirst({ where: eq(schema.profile.userId, userId), columns: { data: true } })
  return row ? { ...EMPTY_PROFILE, ...row.data } : null
}

function monthStart() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

function nextMonthStart() {
  const from = monthStart()
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1))
}

type Spend = { tokens: number; costUsd: number; ourUsd: number; actions: number }

/** Provider spend and AI actions since the 1st, per user (one user, or everyone). Credit-paid rows count only toward `ourUsd` and `actions`, not the allowance. */
export async function spendThisMonth(db: Db, userId?: string) {
  const own = sql`where ${schema.usage.creditEur} is null`
  const rows = await db
    .select({
      userId: schema.usage.userId,
      tokens: sql<number>`sum(${schema.usage.tokens}) filter (${own})`.mapWith(Number),
      costUsd: sql<number>`sum(${schema.usage.costUsd}) filter (${own})`.mapWith(Number),
      ourUsd: sql<number>`sum(${schema.usage.costUsd})`.mapWith(Number),
      actions: sql<number>`count(*)`.mapWith(Number),
    })
    .from(schema.usage)
    .where(and(gte(schema.usage.createdAt, monthStart()), userId ? eq(schema.usage.userId, userId) : undefined))
    .groupBy(schema.usage.userId)
  return new Map<string, Spend>(rows.map((r) => [r.userId, r]))
}

/** Provider cost → what the user is charged in €: cost ÷ (1 − margin), so a margin of 1/3 charges cost × 1.5 (a 50% markup).
 *  Free OpenRouter models bill $0, so tokens also carry a small nominal price (TOKEN_EUR_PER_MILLION). */
export function toBudget(env: Env, spend: Spend | undefined, budgetEur: number | null | undefined): Budget {
  const cost = (spend?.ourUsd ?? 0) * Number(env.USD_TO_EUR)
  const tokenCharge = ((spend?.tokens ?? 0) / 1e6) * (Number(env.TOKEN_EUR_PER_MILLION) || 0)
  return { used: (spend?.costUsd ?? 0) * eurPerUsd(env) + tokenCharge, limit: budgetEur ?? Number(env.MONTHLY_BUDGET_EUR), cost, tokens: spend?.tokens ?? 0, resetsOn: nextMonthStart().toISOString() }
}

/** What one provider dollar costs the seeker in €, margin included. */
type Money = Partial<Record<'USD_TO_EUR' | 'PRICE_MARGIN' | 'OPENROUTER_CREDIT_MODELS', string>>

export function eurPerUsd(env: Money) {
  const margin = Math.min(0.95, Math.max(0, Number(env.PRICE_MARGIN)))
  return Number(env.USD_TO_EUR) / (1 - margin)
}

/** A one-time credit puts OPENROUTER_CREDIT_MODELS first on Agisse's key until it's spent. Own keys and trial accounts never touch it. */
export function creditFor(env: Money, creditEur: number | null | undefined, ownKey: boolean, trial: boolean): Meter['credit'] {
  const models = (env.OPENROUTER_CREDIT_MODELS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return !ownKey && !trial && (creditEur ?? 0) > 0 && models.length ? { models, eurPerUsd: eurPerUsd(env) } : undefined
}

type Today = { usd: number; actions: number; mine: number; ownKey: boolean; credit: boolean }

/** Since UTC midnight: provider USD spent by everyone, and free actions on this server's key (rows with tokens and no credit drawn;
 *  own-key rows book none), by everyone and by this user. */
export async function spendToday(db: Db, userId: string): Promise<Today> {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const u = schema.usage
  const [row] = await db
    .select({
      usd: sql<number>`coalesce(sum(${u.costUsd}), 0)`.mapWith(Number),
      actions: sql<number>`count(*) filter (where ${u.tokens} > 0 and ${u.creditEur} is null)`.mapWith(Number),
      mine: sql<number>`count(*) filter (where ${u.tokens} > 0 and ${u.creditEur} is null and ${u.userId} = ${userId})`.mapWith(Number),
      ownKey: sql<boolean>`exists (select 1 from ${schema.aiKey} where ${schema.aiKey.userId} = ${userId})`,
      credit: sql<boolean>`exists (select 1 from ${schema.user} where ${schema.user.id} = ${userId} and ${schema.user.creditEur} > 0)`,
    })
    .from(u)
    .where(gte(u.createdAt, today))
  return row ?? { usd: 0, actions: 0, mine: 0, ownKey: false, credit: false }
}

/** Per account, the days in the last 30 on which it reached the free daily actions on this server's key (a count only, for /admin). */
export async function freeLimitDays(db: Db, limit: number) {
  if (!limit) return new Map<string, number>()
  const u = schema.usage
  const days = db
    .select({ userId: u.userId })
    .from(u)
    .where(and(sql`${u.tokens} > 0 and ${u.creditEur} is null`, sql`${u.createdAt} >= current_date - 29`))
    .groupBy(u.userId, sql`${u.createdAt}::date`)
    .having(sql`count(*) >= ${limit}`)
    .as('days')
  const rows = await db.select({ userId: days.userId, days: sql<number>`count(*)::int` }).from(days).groupBy(days.userId)
  return new Map(rows.map((r) => [r.userId, r.days]))
}

/** Why AI is paused for this user until midnight UTC, if it is. The USD cap stops everyone; the free-action limits
 *  (OpenRouter's free models allow a fixed number of requests per day per account, shared by every seeker on this key)
 *  skip seekers with their own key or one-time credit left. */
export function pauseFor(env: Partial<Record<'GLOBAL_DAILY_USD_CAP' | 'FREE_DAILY_ACTIONS' | 'FREE_DAILY_ACTIONS_ALL', string>>, t: Today): Budget['paused'] {
  const cap = Number(env.GLOBAL_DAILY_USD_CAP) || 0
  const all = Number(env.FREE_DAILY_ACTIONS_ALL) || 0
  const mine = Number(env.FREE_DAILY_ACTIONS) || 0
  if (cap && t.usd >= cap) return 'cap'
  if (t.ownKey || t.credit) return undefined
  if (all && t.actions >= all) return 'free'
  if (mine && t.mine >= mine) return 'you'
  return undefined
}

/** The user's allowance, plus the daily limits: past one, the account reads as spent (paused) until midnight UTC.
 *  Pass `budgetEur` when the caller already has the user row (the session guard does), to skip one query. */
export async function loadBudget(db: Db, env: Env, userId: string, budgetEur?: number | null): Promise<Budget> {
  const limited = [env.GLOBAL_DAILY_USD_CAP, env.FREE_DAILY_ACTIONS, env.FREE_DAILY_ACTIONS_ALL].some((v) => Number(v) > 0)
  const [spend, u, today] = await Promise.all([
    spendThisMonth(db, userId),
    budgetEur !== undefined ? { budgetEur } : db.query.user.findFirst({ where: eq(schema.user.id, userId), columns: { budgetEur: true } }),
    limited ? spendToday(db, userId) : null,
  ])
  const budget = toBudget(env, spend.get(userId), u?.budgetEur)
  const paused = today ? pauseFor(env, today) : undefined
  return paused ? { ...budget, used: Math.max(budget.used, budget.limit), paused } : budget
}

const ownKey = 'Connect your own OpenRouter key in Profile to keep going, or come back after midnight UTC.'

export const budgetSpent = (b: Budget) =>
  b.paused === 'cap'
    ? 'Agisse has hit its AI limit for today while the beta grows. It reopens at midnight UTC.'
    : b.paused === 'free'
      ? `Agisse's free AI is used up for today. ${ownKey}`
      : b.paused === 'you'
        ? `Free limit reached for today. ${ownKey}`
        : `You have used your €${b.limit.toFixed(2)} budget for this month. It resets on the 1st, or ask the administrator for more.`

/** Fresh spend meter; carries the user's Smart model choice (trial accounts stay on Standard). */
export async function newMeter(db: Db, env: Env, userId: string, trial: boolean): Promise<Meter> {
  const [rank, byok, u] = await Promise.all([
    modelRanking(db),
    trial ? null : loadUserKey(db, env, userId),
    trial ? null : db.query.user.findFirst({ where: eq(schema.user.id, userId), columns: { creditEur: true } }),
  ])
  const meter: Meter = { tokens: 0, costUsd: 0, rank, byok: byok ?? undefined, credit: creditFor(env, u?.creditEur, !!byok, trial) }
  if (trial || (await loadProfile(db, userId))?.smartModel === false) return meter
  const preferred = (env.OPENROUTER_SMART_MODELS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return { ...meter, smart: { preferred, maxUsdPerM: Number(env.SMART_MAX_USD_PER_M) || 2 } }
}

/** Books whatever the providers billed, including failed attempts: those were paid for too. */
/** Also the generation log: which task, model and prompt version answered, the raw output and what the verifiers dropped. */
export async function charge(db: Db, userId: string, kind: typeof schema.usage.$inferInsert.kind, meter: Meter) {
  if (meter.tokens <= 0 && meter.costUsd <= 0 && !meter.gen) return
  const g = meter.gen
  // Paid calls draw the one-time credit; free models bill $0, so they don't. It stops at 0 and never resets.
  const draw = meter.credit && meter.costUsd > 0 ? meter.costUsd * meter.credit.eurPerUsd : 0
  await Promise.all([
    draw && db.update(schema.user).set({ creditEur: sql`greatest(0, ${schema.user.creditEur} - ${draw})` }).where(and(eq(schema.user.id, userId), gt(schema.user.creditEur, 0))),
    db.insert(schema.usage).values({
      id: crypto.randomUUID(),
      userId,
      kind,
      tokens: meter.tokens,
      costUsd: meter.costUsd,
      creditEur: draw || null,
      task: g?.task,
      model: g?.model,
      prompt: g?.prompt,
      failed: g?.failed,
      refId: meter.ref,
      output: g?.output,
      flags: meter.flags,
    }),
  ])
}

/** The seeker's own style and objections as a prompt block: notes or letters they edited or thumbed up (outreach, cover),
 *  and their last thumbs-down notes for this task. Appended to the user message; still one model call, no new facts. */
export async function userStyle(db: Db, userId: string, task: RatedTask, exceptId?: string): Promise<string> {
  const liked = sql`select ref_id from usage where user_id = ${userId} and task = ${task} and rating = 1`
  const [examples, objections, memories] = await Promise.all([
    task === 'agisse_outreach'
      ? db.execute<{ text: string }>(sql`
          select outreach as text from person
          where user_id = ${userId} and outreach <> '' and id is distinct from ${exceptId ?? null}
            and (outreach_edited or id in (${liked}))
          order by created_at desc limit 2`)
      : task === 'agisse_cover'
        ? db.execute<{ text: string }>(sql`
            select cover_letter as text from job
            where user_id = ${userId} and cover_letter is not null and id is distinct from ${exceptId ?? null}
              and (cover_edited or id in (${liked}))
            order by updated_at desc limit 1`)
        : { rows: [] },
    db.execute<{ note: string }>(sql`
      select left(note, 300) as note from usage
      where user_id = ${userId} and task = ${task} and rating = -1 and note is not null
      order by created_at desc limit 3`),
    loadMemories(db, userId),
  ])
  return (
    styleBlock(
      examples.rows.map((r) => r.text),
      objections.rows.map((r) => r.note),
    ) + memoryBlock(memories)
  )
}

/** Words kept from a style example: enough for tone and length, not a template to copy. */
const STYLE_WORDS = 250

export function styleBlock(examples: string[], objections: string[]) {
  let out = ''
  if (examples.length) {
    const cut = (t: string) => t.split(/(\s+)/).slice(0, STYLE_WORDS * 2).join('').trim()
    out += `\n\nSEEKER'S OWN STYLE (written or approved by the seeker earlier, for other people or postings; match their tone and length only, take no facts from them)\n${examples.map((e) => `---\n${cut(e)}`).join('\n')}`
  }
  if (objections.length) out += `\n\nTHE SEEKER OBJECTED TO EARLIER DRAFTS (their words; avoid repeating these problems, but never add facts to do so)\n${objections.map((o) => `- ${o}`).join('\n')}`
  return out
}

/** Turn model availability failures into a user-facing action error. */
export function modelError(err: unknown, what: string) {
  if (err instanceof NoModelAvailable) return `Could not ${what}: no model answered in time. Try again later.`
  return err instanceof Error ? err.message : `Could not ${what}`
}

export const toSearch = (s: typeof schema.search.$inferSelect, number: number): Search => ({
  id: s.id,
  number,
  company: s.company,
  domain: s.domain,
  role: s.role,
  location: s.location,
  goal: s.goal,
  contactTypes: s.contactTypes,
  sharedOnly: s.sharedOnly,
  status: s.status,
  error: s.error,
  model: s.model,
  peopleCount: s.peopleCount,
  rounds: s.rounds,
  createdAt: s.createdAt.toISOString(),
})

/** Booth number: 1 + the user's searches created strictly before this one
 *  (strict, because Postgres keeps microseconds the JS Date cannot round-trip). */
export async function boothNumber(db: Db, userId: string, createdAt: Date) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.search)
    .where(and(eq(schema.search.userId, userId), lt(schema.search.createdAt, createdAt)))
  return (row?.n ?? 0) + 1
}

export const toPerson = (p: typeof schema.person.$inferSelect): Person => ({
  id: p.id,
  searchId: p.searchId,
  rank: p.rank,
  name: p.name,
  title: p.title,
  company: p.company,
  location: p.location,
  profileUrl: p.profileUrl,
  sourceUrls: p.sourceUrls,
  summary: p.summary,
  sharedGround: p.sharedGround,
  reason: p.reason,
  value: p.value,
  score: p.score,
  outreach: p.outreach,
  contactedAt: p.contactedAt?.toISOString() ?? null,
  status: p.status,
  followedUpAt: p.followedUpAt?.toISOString() ?? null,
  contactChannel: p.contactChannel,
  notes: p.notes,
  prep: p.prep,
  alsoContacted: null,
})

/** MCP list filters and page size; `after` is a decoded cursor. `since` is inclusive, `until` exclusive. */
export type PageQuery = { limit: number; after?: Cursor; company?: string; status?: string; since?: string; until?: string }
/** Keyset position: the sort timestamp as Postgres text (full microseconds, which a JS Date would lose) and the row id. */
export type Cursor = [sortKey: string, id: string]
export type Page<T> = { items: T[]; nextCursor: string | null; total: number }

export const encodeCursor = (c: Cursor) => btoa(JSON.stringify(c)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export function decodeCursor(s: string): Cursor | null {
  try {
    const c: unknown = JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')))
    return Array.isArray(c) && c.length === 2 && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(\.\d{1,6})?$/.test(c[0]) && typeof c[1] === 'string' ? (c as Cursor) : null
  } catch {
    return null
  }
}

/** Filters, keyset condition and ordering for a page over (sort desc, id desc). All undefined without a query (the web app's lists). */
function pageParts(q: PageQuery | undefined, k: { sort: PgColumn; id: PgColumn; company: PgColumn; status?: PgColumn }) {
  const filter =
    q &&
    and(
      q.company ? ilike(k.company, `%${q.company.replace(/[\\%_]/g, '\\$&')}%`) : undefined,
      q.status && k.status ? eq(k.status, q.status) : undefined,
      q.since ? gte(k.sort, new Date(q.since)) : undefined,
      q.until ? lt(k.sort, new Date(q.until)) : undefined,
    )
  const after = q?.after && sql`(${k.sort}, ${k.id}) < (${q.after[0]}::timestamp, ${q.after[1]})`
  return { filter, after, sortKey: sql<string>`${k.sort}::text`, orderBy: [desc(k.sort), desc(k.id)] }
}

function toPage<T>(rows: { sortKey: string; id: string }[], items: T[], q: PageQuery, total: number): Page<T> {
  const last = rows[q.limit - 1]
  return { items: items.slice(0, q.limit), nextCursor: rows.length > q.limit ? encodeCursor([last.sortKey, last.id]) : null, total }
}

/** All of a user's booths, newest first, numbered like the Map (oldest = 1). */
export function loadSearchList(db: Db, userId: string): Promise<Search[]>
export function loadSearchList(db: Db, userId: string, q: PageQuery): Promise<Page<Search>>
export async function loadSearchList(db: Db, userId: string, q?: PageQuery) {
  const p = pageParts(q, { sort: schema.search.createdAt, id: schema.search.id, company: schema.search.company })
  const where = and(eq(schema.search.userId, userId), p.filter)
  const [rows, total] = await Promise.all([
    db
      .select({
        search: schema.search,
        id: schema.search.id,
        sortKey: p.sortKey,
        // Counted over all the user's booths, so numbers hold across pages and filters (same rule as boothNumber).
        number: sql<number>`(select count(*)::int + 1 from ${schema.search} s2 where s2.user_id = ${schema.search}.user_id and s2.created_at < ${schema.search}.created_at)`,
      })
      .from(schema.search)
      .where(and(where, p.after))
      .orderBy(...p.orderBy)
      .limit(q ? q.limit + 1 : 100),
    q ? db.$count(schema.search, where) : 0,
  ])
  const items = rows.map((r) => toSearch(r.search, r.number))
  return q ? toPage(rows, items, q, total) : items
}

/** One booth and its people, unmapped for `alsoContacted` (that cross-search enrichment is a UI-only concern). */
export async function loadSearchWithPeople(db: Db, userId: string, searchId: string) {
  const row = await db.query.search.findFirst({ where: and(eq(schema.search.id, searchId), eq(schema.search.userId, userId)) })
  if (!row) return null
  const [people, number] = await Promise.all([
    db.query.person.findMany({ where: eq(schema.person.searchId, row.id), orderBy: schema.person.rank }),
    boothNumber(db, userId, row.createdAt),
  ])
  return { search: { ...toSearch(row, number), people: people.map(toPerson) } }
}

/** Every contacted person, newest first, with the booth they came from (null when added by hand). */
export function loadContactedPeople(db: Db, userId: string): Promise<ContactedPerson[]>
export function loadContactedPeople(db: Db, userId: string, q: PageQuery): Promise<Page<ContactedPerson>>
export async function loadContactedPeople(db: Db, userId: string, q?: PageQuery) {
  const p = pageParts(q, { sort: schema.person.contactedAt, id: schema.person.id, company: schema.person.company, status: schema.person.status })
  const where = and(eq(schema.person.userId, userId), isNotNull(schema.person.contactedAt), p.filter)
  const [rows, total] = await Promise.all([
    db
      .select({ person: schema.person, id: schema.person.id, sortKey: p.sortKey, search: { id: schema.search.id, company: schema.search.company, role: schema.search.role } })
      .from(schema.person)
      .leftJoin(schema.search, eq(schema.person.searchId, schema.search.id))
      .where(and(where, p.after))
      .orderBy(...p.orderBy)
      .limit(q ? q.limit + 1 : 200),
    q ? db.$count(schema.person, where) : 0,
  ])
  const items: ContactedPerson[] = rows.map((r) => ({ ...toPerson(r.person), search: r.search }))
  return q ? toPage(rows, items, q, total) : items
}

/** The Board: every tracked application, slim projection (no full evaluation/CV text). */
export function loadJobSummaries(db: Db, userId: string): Promise<JobSummary[]>
export function loadJobSummaries(db: Db, userId: string, q: PageQuery): Promise<Page<JobSummary>>
export async function loadJobSummaries(db: Db, userId: string, q?: PageQuery) {
  const p = pageParts(q, { sort: schema.job.createdAt, id: schema.job.id, company: schema.job.company, status: schema.job.status })
  const where = and(eq(schema.job.userId, userId), p.filter)
  const [rows, total] = await Promise.all([
    db
      .select({ job: { id: schema.job.id, company: schema.job.company, domain: sql<string | null>`${schema.job.evaluation}->'role'->>'domain'`, role: schema.job.role, location: schema.job.location, url: schema.job.url, score: schema.job.score, status: schema.job.status, appliedAt: schema.job.appliedAt, nextAt: schema.job.nextAt, history: schema.job.history, closedAt: schema.job.closedAt, createdAt: schema.job.createdAt }, id: schema.job.id, sortKey: p.sortKey })
      .from(schema.job)
      .where(and(where, p.after))
      .orderBy(...p.orderBy)
      .limit(q ? q.limit + 1 : 200),
    q ? db.$count(schema.job, where) : 0,
  ])
  const items: JobSummary[] = rows.map(({ job: j }) => ({ ...j, domain: j.domain || null, appliedAt: j.appliedAt?.toISOString() ?? null, nextAt: j.nextAt?.toISOString() ?? null, closedAt: j.closedAt?.toISOString() ?? null, createdAt: j.createdAt.toISOString(), recommendation: recommendationFor(j.score) }))
  return q ? toPage(rows, items, q, total) : items
}

export const toJob = (j: typeof schema.job.$inferSelect): Job => ({
  id: j.id,
  company: j.company,
  role: j.role,
  url: j.url,
  domain: j.evaluation?.role.domain || null,
  location: j.location,
  jdText: j.jdText,
  score: j.score,
  status: j.status,
  evaluation: j.evaluation,
  cv: j.cv,
  coverLetter: j.coverLetter,
  offerBrief: j.offerBrief,
  payCheck: j.payCheck,
  notes: j.notes,
  appliedAt: j.appliedAt?.toISOString() ?? null,
  nextAt: j.nextAt?.toISOString() ?? null,
  history: j.history,
  closedAt: j.closedAt?.toISOString() ?? null,
  offer: j.offer,
  createdAt: j.createdAt.toISOString(),
})
