import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { captcha, jwt } from 'better-auth/plugins'
import { eq, and, gt, isNull, or, sql } from 'drizzle-orm'
import { mails } from './lib/email'
import { eraseOutsideCascade } from './lib/retention'
import { newReferralCode, readCookie, resolveReferral, waitlistPosition } from './lib/waitlist'
import { mcp } from '@better-auth/mcp'
import type { Db } from './db'
import { schema } from './db'

// The one admin account, set as a secret so the address stays out of the source. Unset means no admin.
/** An invite past its expiry date opens nothing (no expiry = never). */
export const unexpired = () => or(isNull(schema.invite.expiresAt), gt(schema.invite.expiresAt, sql`now()`))
export const isAdminEmail = (env: Env, email?: string | null) => !!env.ADMIN_EMAIL && email?.toLowerCase() === env.ADMIN_EMAIL.trim().toLowerCase()

// Workers Free allows ~10 ms CPU per request; Better Auth's default scrypt blows past that.
// WebCrypto PBKDF2 runs natively. 100k iterations is Cloudflare's own ceiling for PBKDF2.
const PBKDF2_ITERATIONS = 100_000
const enc = new TextEncoder()

const toB64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256)
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const bits = await derive(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toB64(salt)}$${toB64(bits)}`
}

export async function verifyPassword({ hash, password }: { hash: string; password: string }) {
  const [scheme, iter, salt, expected] = hash.split('$')
  if (scheme !== 'pbkdf2' || !iter || !salt || !expected) return false
  const bits = new Uint8Array(await derive(password, fromB64(salt), Number(iter)))
  const want = fromB64(expected)
  if (bits.length !== want.length) return false
  let diff = 0
  for (let i = 0; i < bits.length; i++) diff |= bits[i]! ^ want[i]!
  return diff === 0
}

export type Auth = ReturnType<typeof createAuth>

declare global {
  interface Env {
    ADMIN_EMAIL?: string
    GOOGLE_CLIENT_ID?: string
    GOOGLE_CLIENT_SECRET?: string
    TURNSTILE_SECRET_KEY?: string
    GROUP_INVITE?: string
  }
}

// The landing page drops these cookies from ?ref= / ?invite=, so they survive the round trip through Google.
type Ctx = { headers?: Headers; request?: Request } | null
const requestCookies = (ctx: Ctx) => (ctx?.request?.headers ?? ctx?.headers)?.get('cookie')
// The email form sends its code as x-invite; Google sign-ups carry it in the cookie.
const inviteCode = (ctx: Ctx) => (ctx?.request?.headers ?? ctx?.headers)?.get('x-invite')?.trim() || readCookie(requestCookies(ctx), 'agisse_invite')

export function createAuth(env: Env, db: Db, origin: string) {
  return betterAuth({
    appName: 'Agisse',
    baseURL: origin,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    databaseHooks: {
      user: {
        create: {
          before: async (user, ctx) => {
            if (isAdminEmail(env, user.email)) throw new Error('This address is reserved. Sign in to the existing account.')
            const cookies = requestCookies(ctx)
            const ref = await resolveReferral(db, readCookie(cookies, 'agisse_ref'), user.email)
            const invite = inviteCode(ctx)
            const group = !!invite && !!env.GROUP_INVITE?.trim() && invite === env.GROUP_INVITE.trim()
            // A personal invite from the admin skips the waitlist. The email route has already claimed it (usedAt set, usedBy not yet).
            const personal = invite && !group ? await db.query.invite.findFirst({ where: and(eq(schema.invite.code, invite), isNull(schema.invite.usedBy), isNull(schema.invite.revokedAt), unexpired()), columns: { creditEur: true } }) : undefined
            const approved = ref?.admits || group || !!personal
            // One-time credit: the invite's, else the admin's ref link's.
            const credit = personal?.creditEur || (ref?.referrer.isAdmin && ref.referrer.referralCreditEur) || null
            return { data: { ...user, referralCode: newReferralCode(), referredBy: ref?.referrer.id ?? null, ...(approved ? { accessStatus: 'approved', reviewedAt: new Date() } : {}), ...(credit ? { creditGrantedEur: credit, creditEur: credit } : {}) } }
          },
          after: async (user, ctx) => {
            const u = user as typeof user & { accessStatus?: string; referralCode?: string; referredBy?: string | null }
            // Google sign-ups skip the email form's x-invite claim, so a one-off invite in the cookie is claimed here.
            const invite = inviteCode(ctx)
            if (invite) await db.update(schema.invite).set({ usedAt: new Date(), usedBy: user.id }).where(and(eq(schema.invite.code, invite), isNull(schema.invite.usedAt), isNull(schema.invite.revokedAt), unexpired()))
            const approved = u.accessStatus === 'approved'
            if (approved) await mails.approved(env, user, origin)
            else {
              const pos = await waitlistPosition(db, user.id)
              await mails.waitlisted(env, user, origin, u.referralCode ?? '', pos?.position ?? 1)
            }
            if (u.referredBy) {
              const referrer = await db.query.user.findFirst({ where: eq(schema.user.id, u.referredBy), columns: { email: true, name: true } })
              if (referrer) await mails.friendJoined(env, referrer, user.name, origin, approved)
            }
          },
        },
        update: { before: async (user) => {
          if (isAdminEmail(env, user.email)) throw new Error('This address is reserved.')
          return { data: user }
        } },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      password: { hash: hashPassword, verify: verifyPassword },
      sendResetPassword: async ({ user, url }) => { await mails.resetPassword(env, user, url) },
    },
    socialProviders: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, prompt: 'select_account' } }
      : {},
    // Google verifies the address, so an email/password account with the same address links instead of failing.
    account: { accountLinking: { enabled: true, trustedProviders: ['google'] } },
    user: {
      // Profile › Your data. Rows cascade from user; the CV PDF lives in R2 and goes here.
      deleteUser: {
        enabled: true,
        // Every other table cascades from user; the MCP OAuth tables have no foreign key, so their tokens and consents go here, with the PDF and the analytics person.
        beforeDelete: async (user) => {
          await eraseOutsideCascade(env, db, [user.id])
        },
      },
      additionalFields: {
      accessStatus: { type: 'string', required: false, input: false },
      referralCode: { type: 'string', required: false, input: false },
      referredBy: { type: 'string', required: false, input: false },
      creditGrantedEur: { type: 'number', required: false, input: false },
      creditEur: { type: 'number', required: false, input: false },
      reviewedAt: { type: 'date', required: false, input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    trustedOrigins: [origin],
    plugins: [
      // Turnstile (Cloudflare's free CAPTCHA) on the forms bots hit; Google sign-in needs none.
      ...(env.TURNSTILE_SECRET_KEY ? [captcha({ provider: 'cloudflare-turnstile', secretKey: env.TURNSTILE_SECRET_KEY, endpoints: ['/sign-up/email', '/sign-in/email', '/request-password-reset'] })] : []),
      jwt(),
      // Lets an MCP client (Claude Desktop/Code, etc.) connect as this user over OAuth instead of a cookie.
      // Dynamic client registration is open because a fresh MCP client has no prior session or admin-issued token.
      mcp({
        loginPage: '/sign-in',
        consentPage: '/consent',
        resource: `${origin}/mcp`,
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
      }),
    ],
  })
}
