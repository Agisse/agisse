import { eq } from 'drizzle-orm'
import { schema, type Db } from '../db'

// GDPR Art. 20: everything a seeker saved, as JSON. export.check.ts fails when a table with a user_id is in neither list.
export const EXPORTED = {
  profile: schema.profile,
  searches: schema.search,
  people: schema.person,
  jobs: schema.job,
  stories: schema.story,
  memories: schema.memory,
  practiceAnswers: schema.practiceAnswer,
  assessmentReports: schema.assessmentReport,
  trainingSessions: schema.trainingSession,
  cvReviews: schema.cvReviewLog,
  scouts: schema.scout,
  savedCompanies: schema.savedCompany,
  bubbleMaps: schema.bubbleMap,
  usage: schema.usage,
}

/** Tables with a user_id that stay out, and why. */
export const SKIPPED: Record<string, string> = {
  account: 'password hash and OAuth tokens',
  session: 'sign-in sessions',
  ai_key: 'sealed key; provider, model and last four are in `aiKey`',
  oauth_client: 'MCP client secrets',
  oauth_access_token: 'MCP tokens',
  oauth_refresh_token: 'MCP tokens',
  oauth_consent: 'MCP consents',
  vacancy_fit: 'scores the feed provider derives from the profile',
  profile_embedding: 'vector the feed provider derives from the profile',
}

// What we paid the provider is billing, not the seeker's data.
export const withoutCost = (rows: (typeof schema.usage.$inferSelect)[]) => rows.map(({ costUsd: _, ...u }) => u)

export async function exportUserData(db: Db, userId: string) {
  const [user, aiKey, ...rows] = await Promise.all([
    db.query.user.findFirst({
      where: eq(schema.user.id, userId),
      columns: { id: true, name: true, email: true, emailVerified: true, accessStatus: true, referralCode: true, image: true, createdAt: true },
    }),
    db.query.aiKey.findFirst({ where: eq(schema.aiKey.userId, userId), columns: { provider: true, model: true, last4: true, createdAt: true } }),
    ...Object.values(EXPORTED).map((t) => db.select().from(t).where(eq(t.userId, userId))),
  ])
  const { usage, ...tables } = Object.fromEntries(Object.keys(EXPORTED).map((k, i) => [k, rows[i]]))
  return { exportedAt: new Date().toISOString(), user, aiKey: aiKey ?? null, ...tables, usage: withoutCost(usage as (typeof schema.usage.$inferSelect)[]) }
}
