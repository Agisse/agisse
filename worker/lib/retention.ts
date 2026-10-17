import { and, eq, gt, inArray, isNotNull, isNull, lt, notExists, or, sql, type SQL } from 'drizzle-orm'
import { schema, type Db } from '../db'
import { mails } from './email'

declare global {
  interface Env {
    /** PostHog personal API key with the person:write scope. With POSTHOG_API_URL, erasing an account also deletes its analytics. */
    POSTHOG_PERSONAL_API_KEY?: string
    /** The PostHog project's API URL, e.g. https://eu.posthog.com/api/projects/12345 */
    POSTHOG_API_URL?: string
  }
}

/** What erasing an account needs: the CV bucket, and PostHog's keys when analytics are on. */
type Eraser = Pick<Env, 'POSTHOG_PERSONAL_API_KEY' | 'POSTHOG_API_URL'> & { RESUMES: Pick<R2Bucket, 'delete'> }

// docs/privacy.md: declined accounts are deleted after 12 months of inactivity. Inactive means
// signed up over 12 months ago and no session used since. The erasure matches Delete account: rows cascade from user,
// the CV PDF and the MCP OAuth rows (no foreign key) are removed by hand (eraseAccounts). ponytail: 500 a day keeps one cron run short.
export async function deleteStaleDeclined(env: Eraser, db: Db) {
  const cutoff = sql`now() - interval '12 months'`
  const recent = db.select({ id: schema.session.id }).from(schema.session).where(and(eq(schema.session.userId, schema.user.id), gt(schema.session.updatedAt, cutoff)))
  const stale = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(and(eq(schema.user.accessStatus, 'rejected'), lt(schema.user.createdAt, cutoff), notExists(recent)))
    .limit(500)
  const ids = stale.map((u) => u.id)
  if (!ids.length) return 0
  await eraseAccounts(env, db, ids)
  return ids.length
}

// Approved accounts unused for 24 months get one email, then are deleted 30 days later unless they sign in again.
// Used = a session refreshed (daily while signed in), an MCP token issued, or the sign-up itself. Admins are never
// touched. Without RESEND_API_KEY or APP_URL nobody is warned, so nobody is deleted: no account goes without notice.
// ponytail: 50 warnings a day stays inside Resend's free 100 a day next to sign-up mail; raise it with a paid plan.
export async function deleteInactiveAccounts(env: Env, db: Db) {
  const usedSince = (since: SQL | typeof schema.user.inactiveWarnedAt) =>
    or(
      gt(schema.user.createdAt, since),
      sql`exists (select 1 from ${schema.session} where ${schema.session.userId} = ${schema.user.id} and ${schema.session.updatedAt} > ${since})`,
      sql`exists (select 1 from ${schema.oauthAccessToken} where ${schema.oauthAccessToken.userId} = ${schema.user.id} and ${schema.oauthAccessToken.createdAt} > ${since})`,
    )!
  const cutoff = sql`now() - interval '24 months'`
  const candidates = and(eq(schema.user.accessStatus, 'approved'), eq(schema.user.isAdmin, false))
  const due = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(and(candidates, lt(schema.user.inactiveWarnedAt, sql`now() - interval '30 days'`), sql`not ${usedSince(schema.user.inactiveWarnedAt)}`))
    .limit(500)
  if (due.length) await eraseAccounts(env, db, due.map((u) => u.id))
  if (!env.RESEND_API_KEY || !env.APP_URL) return { warned: 0, deleted: due.length }
  const stale = await db
    .select({ id: schema.user.id, email: schema.user.email, name: schema.user.name })
    .from(schema.user)
    .where(and(candidates, or(isNull(schema.user.inactiveWarnedAt), lt(schema.user.inactiveWarnedAt, cutoff)), sql`not ${usedSince(cutoff)}`))
    .limit(50)
  const deleteOn = new Date(Date.now() + 31 * 86_400_000)
  let warned = 0
  for (const u of stale) {
    // Marked only once the email went out: an account is deleted only after its warning was sent.
    if (!(await mails.inactive(env, u, env.APP_URL, deleteOn))) continue
    await db.update(schema.user).set({ inactiveWarnedAt: new Date() }).where(eq(schema.user.id, u.id))
    warned++
  }
  return { warned, deleted: due.length }
}

// Owner decision (#148, question 11): PostHog knows an account only by its id (posthog.identify in src/App.tsx), so ask it to
// delete that person and their events. Only the ids go out. A failure is logged with a count and never blocks the erasure.
async function forgetAnalytics(env: Eraser, ids: string[]) {
  if (!env.POSTHOG_PERSONAL_API_KEY || !env.POSTHOG_API_URL || !ids.length) return
  try {
    const res = await fetch(`${env.POSTHOG_API_URL.replace(/\/$/, '')}/persons/bulk_delete/`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.POSTHOG_PERSONAL_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ distinct_ids: ids, delete_events: true }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) console.error('posthog person delete failed', res.status, ids.length)
  } catch {
    console.error('posthog person delete failed', ids.length)
  }
}

// What a user row's cascade misses: the CV PDF, the MCP OAuth rows (no foreign key) and the analytics person. Delete account
// runs this in worker/auth.ts's beforeDelete; the cron and /admin run eraseAccounts.
export const eraseOutsideCascade = (env: Eraser, db: Db, ids: string[]) =>
  Promise.all([
    ...ids.map((id) => env.RESUMES.delete(`resumes/${id}.pdf`)),
    ...[schema.oauthAccessToken, schema.oauthRefreshToken, schema.oauthConsent].map((t) => db.delete(t).where(inArray(t.userId, ids))),
    forgetAnalytics(env, ids),
  ])

export async function eraseAccounts(env: Eraser, db: Db, ids: string[]) {
  await eraseOutsideCascade(env, db, ids)
  await db.delete(schema.user).where(inArray(schema.user.id, ids))
}

// Owner decision (#178): /admin's action log is kept 2 years, also after the account it names is deleted.
export const pruneAdminActions = (db: Db) => db.delete(schema.adminAction).where(lt(schema.adminAction.createdAt, sql`now() - interval '2 years'`))

// Owner decision (#148): a model's output and the seeker's note on it are kept 90 days for quality work (worker/lib/quality.ts
// reads 30 to 90 days). The row itself stays: budgets need its cost, and the rating counts without its note.
export const pruneModelOutput = (db: Db) =>
  db
    .update(schema.usage)
    .set({ output: null, note: null })
    .where(and(lt(schema.usage.createdAt, sql`now() - interval '90 days'`), or(isNotNull(schema.usage.output), isNotNull(schema.usage.note))))
