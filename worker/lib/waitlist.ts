import { and, eq, sql } from 'drizzle-orm'
import type { Db } from '../db'
import { schema } from '../db'

/** Friends an approved member can bring straight in; after that their link still moves friends' referrers up. */
export const REFERRAL_INVITES = 3

// 8 chars from an unambiguous alphabet (no 0/O/1/l): short enough to say out loud.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
export const newReferralCode = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => ALPHABET[b % ALPHABET.length]).join('')

export const readCookie = (header: string | null | undefined, name: string) =>
  header?.split(/;\s*/).find((p) => p.startsWith(`${name}=`))?.slice(name.length + 1).trim() || undefined

const referralCount = async (db: Db, userId: string) =>
  (await db.select({ n: sql<number>`count(*)::int` }).from(schema.user).where(eq(schema.user.referredBy, userId)))[0]?.n ?? 0

/** Who a new account points back to, and whether that friend's invite lets it skip the waitlist. */
export async function resolveReferral(db: Db, code: string | undefined, email: string) {
  if (!code) return null
  const referrer = await db.query.user.findFirst({ where: eq(schema.user.referralCode, code), columns: { id: true, email: true, name: true, accessStatus: true, isAdmin: true } })
  if (!referrer || referrer.email.toLowerCase() === email.toLowerCase()) return null
  // ponytail: count-then-insert can let a 4th friend in under a race; a unique slot table fixes it if that ever matters.
  const admits = referrer.isAdmin || (referrer.accessStatus === 'approved' && (await referralCount(db, referrer.id)) < REFERRAL_INVITES)
  return { referrer, admits }
}

/** Waitlist rank: more referrals first, then earliest sign-up. 1-based; null once approved. */
export async function waitlistPosition(db: Db, userId: string) {
  const { rows } = await db.execute<{ position: number; total: number }>(sql`
    with r as (
      select u.id, u.created_at, (select count(*) from "user" f where f.referred_by = u.id) as refs
      from "user" u where u.access_status = 'pending'
    ), me as (select * from r where id = ${userId})
    select (select count(*) from r, me where r.refs > me.refs or (r.refs = me.refs and r.created_at < me.created_at))::int + 1 as position,
           (select count(*) from r)::int as total
    from me`)
  return rows[0] ?? null
}

export async function referralStatus(db: Db, userId: string) {
  const u = await db.query.user.findFirst({ where: eq(schema.user.id, userId), columns: { referralCode: true, accessStatus: true, isAdmin: true } })
  if (!u) return null
  let code = u.referralCode
  if (!code) {
    code = newReferralCode()
    await db.update(schema.user).set({ referralCode: code }).where(and(eq(schema.user.id, userId), sql`${schema.user.referralCode} is null`))
  }
  const referrals = await referralCount(db, userId)
  const approved = u.accessStatus === 'approved' || u.isAdmin
  return {
    code,
    referrals,
    invitesLeft: approved ? (u.isAdmin ? null : Math.max(0, REFERRAL_INVITES - referrals)) : 0,
    waitlist: approved ? null : await waitlistPosition(db, userId),
  }
}
