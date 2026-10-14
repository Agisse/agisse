import { and, eq, gt, inArray, lt, notExists, sql } from 'drizzle-orm'
import { schema, type Db } from '../db'

// docs/privacy.md: waitlist sign-ups that never become active are deleted after 12 months of inactivity. Inactive means
// signed up over 12 months ago and no session used since. The erasure matches Delete account: rows cascade from user,
// the CV PDF and the MCP OAuth rows (no foreign key) are removed by hand (eraseAccounts). ponytail: 500 a day keeps one cron run short.
export async function deleteStaleWaitlist(db: Db, files: Pick<R2Bucket, 'delete'>) {
  const cutoff = sql`now() - interval '12 months'`
  const recent = db.select({ id: schema.session.id }).from(schema.session).where(and(eq(schema.session.userId, schema.user.id), gt(schema.session.updatedAt, cutoff)))
  const stale = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(and(inArray(schema.user.accessStatus, ['pending', 'rejected']), lt(schema.user.createdAt, cutoff), notExists(recent)))
    .limit(500)
  const ids = stale.map((u) => u.id)
  if (!ids.length) return 0
  await eraseAccounts(db, files, ids)
  return ids.length
}

// What a user row's cascade misses: the CV PDF and the MCP OAuth rows (no foreign key). Delete account runs this in
// worker/auth.ts's beforeDelete; the cron and /admin run eraseAccounts.
export const eraseOutsideCascade = (db: Db, files: Pick<R2Bucket, 'delete'>, ids: string[]) =>
  Promise.all([
    ...ids.map((id) => files.delete(`resumes/${id}.pdf`)),
    ...[schema.oauthAccessToken, schema.oauthRefreshToken, schema.oauthConsent].map((t) => db.delete(t).where(inArray(t.userId, ids))),
  ])

export async function eraseAccounts(db: Db, files: Pick<R2Bucket, 'delete'>, ids: string[]) {
  await eraseOutsideCascade(db, files, ids)
  await db.delete(schema.user).where(inArray(schema.user.id, ids))
}
