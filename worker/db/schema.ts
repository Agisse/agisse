import { sql } from 'drizzle-orm'
import { boolean, customType, date, doublePrecision, halfvec, index, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import type { AiProvider, Goal, SharedGround, ContactValue, Profile, ReplyStatus, CallPrep, JobEvaluation, JobStatus, OfferTerms, StatusChange, TailoredCv, ScoutInput, ScoutResult, PostingFacts, CompanyFacts, BubbleMapData, MemoryKind } from '../../shared/types'
import type { AssessmentSource, AssessmentType, CompanyAssessment, Confidence, GameId, GameResult, ReportKind, SkillWeight, TrainingMode } from '../../shared/assessments'
import type { ReportedQuestion, SelectionStage, SourcedTip } from '../../shared/selection'
import type { SponsorCountry } from '../../shared/sponsors'
import type { AnswerDelivery, AnswerFeedback, InterviewQuestion, OfferBrief, PayCheck } from '../../shared/interview'
import type { HelperBriefing } from '../../shared/helper'
import type { CvReviewSummary } from '../../shared/cv-review'

// ---- Better Auth core tables (shape required by the drizzle adapter) ----

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  accessStatus: text('access_status').$type<'pending' | 'approved' | 'rejected'>().notNull().default('pending'),
  reviewedAt: timestamp('reviewed_at'),
  isAdmin: boolean('is_admin').notNull().default(false),
  // Monthly allowance in € set by the admin; null = MONTHLY_BUDGET_EUR.
  budgetEur: doublePrecision('budget_eur'),
  // One-time credit in € from an invite or an admin's ref link: granted once, never reset. Null = none.
  creditGrantedEur: doublePrecision('credit_granted_eur'),
  creditEur: doublePrecision('credit_eur'), // what's left of it
  // Admins only: the credit each friend who joins with this account's ref link gets.
  referralCreditEur: doublePrecision('referral_credit_eur'),
  // Their share link is /?ref=<referralCode>. Friends who join with it point back here via referredBy.
  referralCode: text('referral_code').unique(),
  referredBy: text('referred_by'),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// Admin-issued personal invites: each code opens one account, which skips the waitlist.
export const invite = pgTable('invite', {
  code: text('code').primaryKey(),
  // Who the admin meant it for; only the admin sees it.
  note: text('note').notNull(),
  creditEur: doublePrecision('credit_eur'), // one-time credit for the account it opens
  createdAt: timestamp('created_at').notNull().defaultNow(),
  usedAt: timestamp('used_at'),
  usedBy: text('used_by').references(() => user.id, { onDelete: 'set null' }),
  revokedAt: timestamp('revoked_at'),
  expiresAt: timestamp('expires_at'), // null = never
})

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_idx').on(t.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('account_user_idx').on(t.userId)],
)

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ---- Better Auth `jwt` + `mcp` (OAuth provider) plugin tables ----
// Shape derived from the installed @better-auth/mcp / @better-auth/oauth-provider / better-auth
// (jwt plugin) packages' schema declarations, matched field-for-field. No `.references()`: the
// adapter looks tables up by model/field name, not DB-level FK constraints, so getting a referenced
// table wrong here can't silently corrupt data — but this is new, unverified-in-production surface;
// review before running `db:migrate`.

export const jwks = pgTable('jwks', {
  id: text('id').primaryKey(),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
  alg: text('alg'),
  crv: text('crv'),
})

export const oauthClient = pgTable(
  'oauth_client',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id').notNull().unique(),
    clientSecret: text('client_secret'),
    clientDiscoveryId: text('client_discovery_id'),
    disabled: boolean('disabled').notNull().default(false),
    skipConsent: boolean('skip_consent'),
    enableEndSession: boolean('enable_end_session'),
    subjectType: text('subject_type'),
    scopes: jsonb('scopes').$type<string[]>(),
    clientCredentialsScopes: jsonb('client_credentials_scopes').$type<string[]>().default([]),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    name: text('name'),
    uri: text('uri'),
    icon: text('icon'),
    contacts: jsonb('contacts').$type<string[]>(),
    tos: text('tos'),
    policy: text('policy'),
    softwareId: text('software_id'),
    softwareVersion: text('software_version'),
    softwareStatement: text('software_statement'),
    redirectUris: jsonb('redirect_uris').$type<string[]>().notNull(),
    postLogoutRedirectUris: jsonb('post_logout_redirect_uris').$type<string[]>(),
    backchannelLogoutUri: text('backchannel_logout_uri'),
    backchannelLogoutSessionRequired: boolean('backchannel_logout_session_required'),
    tokenEndpointAuthMethod: text('token_endpoint_auth_method'),
    applicationType: text('application_type'),
    jwks: text('jwks'),
    jwksUri: text('jwks_uri'),
    grantTypes: jsonb('grant_types').$type<string[]>(),
    responseTypes: jsonb('response_types').$type<string[]>(),
    requirePKCE: boolean('require_pkce'),
    dpopBoundAccessTokens: boolean('dpop_bound_access_tokens').default(false),
    referenceId: text('reference_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  },
  (t) => [index('oauth_client_user_idx').on(t.userId)],
)

export const oauthResource = pgTable('oauth_resource', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull().unique(),
  name: text('name').notNull(),
  accessTokenTtl: integer('access_token_ttl'),
  refreshTokenTtl: integer('refresh_token_ttl'),
  signingAlgorithm: text('signing_algorithm'),
  signingKeyId: text('signing_key_id'),
  allowedScopes: jsonb('allowed_scopes').$type<string[]>(),
  customClaims: jsonb('custom_claims').$type<Record<string, unknown>>(),
  dpopBoundAccessTokensRequired: boolean('dpop_bound_access_tokens_required').default(false),
  disabled: boolean('disabled').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  policyVersion: integer('policy_version'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
})

export const oauthClientResource = pgTable(
  'oauth_client_resource',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id').notNull(),
    resourceId: text('resource_id').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [index('oauth_client_resource_client_idx').on(t.clientId), index('oauth_client_resource_resource_idx').on(t.resourceId), uniqueIndex('oauth_client_resource_pair_idx').on(t.clientId, t.resourceId)],
)

export const oauthRefreshToken = pgTable(
  'oauth_refresh_token',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    clientId: text('client_id').notNull(),
    sessionId: text('session_id'),
    userId: text('user_id').notNull(),
    referenceId: text('reference_id'),
    authorizationCodeId: text('authorization_code_id'),
    resources: jsonb('resources').$type<string[]>(),
    requestedUserInfoClaims: jsonb('requested_user_info_claims').$type<string[]>(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    revoked: timestamp('revoked'),
    rotatedAt: timestamp('rotated_at'),
    rotationReplayResponse: text('rotation_replay_response'),
    rotationReplayExpiresAt: timestamp('rotation_replay_expires_at'),
    authTime: timestamp('auth_time'),
    confirmation: jsonb('confirmation').$type<Record<string, unknown>>(),
    scopes: jsonb('scopes').$type<string[]>().notNull(),
  },
  (t) => [index('oauth_refresh_token_client_idx').on(t.clientId), index('oauth_refresh_token_session_idx').on(t.sessionId), index('oauth_refresh_token_user_idx').on(t.userId), index('oauth_refresh_token_code_idx').on(t.authorizationCodeId)],
)

export const oauthAccessToken = pgTable(
  'oauth_access_token',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    clientId: text('client_id').notNull(),
    sessionId: text('session_id'),
    userId: text('user_id'),
    referenceId: text('reference_id'),
    authorizationCodeId: text('authorization_code_id'),
    resources: jsonb('resources').$type<string[]>(),
    requestedUserInfoClaims: jsonb('requested_user_info_claims').$type<string[]>(),
    refreshId: text('refresh_id'),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    revoked: timestamp('revoked'),
    confirmation: jsonb('confirmation').$type<Record<string, unknown>>(),
    scopes: jsonb('scopes').$type<string[]>().notNull(),
  },
  (t) => [index('oauth_access_token_client_idx').on(t.clientId), index('oauth_access_token_session_idx').on(t.sessionId), index('oauth_access_token_user_idx').on(t.userId), index('oauth_access_token_code_idx').on(t.authorizationCodeId), index('oauth_access_token_refresh_idx').on(t.refreshId)],
)

export const oauthConsent = pgTable(
  'oauth_consent',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id').notNull(),
    userId: text('user_id'),
    referenceId: text('reference_id'),
    resources: jsonb('resources').$type<string[]>(),
    requestedUserInfoClaims: jsonb('requested_user_info_claims').$type<string[]>(),
    scopes: jsonb('scopes').$type<string[]>().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('oauth_consent_client_idx').on(t.clientId), index('oauth_consent_user_idx').on(t.userId)],
)

// Single-use guard for `private_key_jwt` assertion replay: `id` is a digest of the assertion, so a
// replayed/concurrent assertion collides on the primary key and the insert fails atomically.
export const oauthClientAssertion = pgTable('oauth_client_assertion', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
})

// ---- Agisse tables ----

export const profile = pgTable('profile', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  data: jsonb('data').$type<Profile>().notNull(),
  // Full résumé text from the last import; what CVs and cover letters are tailored from.
  resumeText: text('resume_text'),
  // Desk's opening briefing, written on demand; null until requested, replaced on each manual refresh.
  briefing: jsonb('briefing').$type<HelperBriefing>(),
  // Last CV review score, computed in the browser from rule checks; the CV text it scored is not kept here.
  cvReview: jsonb('cv_review').$type<CvReviewSummary>(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// The seeker's own AI key (bring your own key); sealed with AES-GCM, see worker/lib/byok.ts.
export const aiKey = pgTable('ai_key', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  provider: text('provider').$type<AiProvider>().notNull(),
  model: text('model').notNull(),
  sealed: text('sealed').notNull(),
  last4: text('last4').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const search = pgTable(
  'search',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    company: text('company').notNull(),
    domain: text('domain'),
    role: text('role').notNull(),
    location: text('location'),
    goal: text('goal').$type<Goal>(),
    contactTypes: jsonb('contact_types').$type<ContactValue[]>().notNull().default([]),
    sharedOnly: boolean('shared_only').notNull().default(false),
    status: text('status').$type<'running' | 'done' | 'failed'>().notNull().default('running'),
    error: text('error'),
    model: text('model'),
    peopleCount: integer('people_count').notNull().default(0),
    // Discovery rounds run for this booth ("Find more people" adds one); each counts as a search.
    rounds: integer('rounds').notNull().default(1),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('search_user_created_idx').on(t.userId, t.createdAt)],
)

export const person = pgTable(
  'person',
  {
    id: text('id').primaryKey(),
    // null for a contact added by hand, outside any search.
    searchId: text('search_id').references(() => search.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull(),
    name: text('name').notNull(),
    title: text('title').notNull(),
    company: text('company').notNull(),
    location: text('location'),
    profileUrl: text('profile_url').notNull(),
    sourceUrls: jsonb('source_urls').$type<string[]>().notNull().default([]),
    summary: text('summary').notNull(),
    sharedGround: jsonb('shared_ground').$type<SharedGround[]>().notNull().default([]),
    reason: text('reason').notNull(),
    value: text('value').$type<ContactValue>().notNull(),
    score: integer('score').notNull(),
    // Written on demand when the user opens the badge's message side; '' until then.
    outreach: text('outreach').notNull().default(''),
    // The seeker changed the drafted note; the draft itself stays in usage.output.
    outreachEdited: boolean('outreach_edited').notNull().default(false),
    contactedAt: timestamp('contacted_at'),
    // 'contacted' whenever contactedAt is set; null otherwise.
    status: text('status').$type<ReplyStatus>(),
    followedUpAt: timestamp('followed_up_at'),
    contactChannel: text('contact_channel'),
    notes: text('notes'),
    // Call prep sheet, written on demand once they replied; null until then.
    prep: jsonb('prep').$type<CallPrep>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('person_search_rank_idx').on(t.searchId, t.rank), index('person_user_contacted_idx').on(t.userId, t.contactedAt)],
)

// One row per paid request (models + Exa); a user's monthly spend is the sum since the 1st.
export const usage = pgTable(
  'usage',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<'search' | 'outreach' | 'resume' | 'job' | 'assessment' | 'scout' | 'selection' | 'interview' | 'offer' | 'pay' | 'helper' | 'cv'>().notNull(),
    tokens: integer('tokens').notNull(),
    // Provider cost as billed to us (OpenRouter usage.cost + Exa costDollars), before margin.
    costUsd: doublePrecision('cost_usd').notNull(),
    // € drawn from the account's one-time credit; those rows stay out of the monthly allowance and the daily free limits.
    creditEur: doublePrecision('credit_eur'),
    // Generation log, for measuring quality (worker/lib/quality.ts); null on rows without a successful model call.
    task: text('task'), // schemaName of the call, e.g. agisse_cv
    model: text('model'),
    prompt: text('prompt'), // promptVersion() of the system prompt
    failed: jsonb('failed').$type<string[]>(), // models that failed before the one that answered
    refId: text('ref_id'), // the job, person or search the output belongs to
    // ponytail: kept forever; prune output past 90 days if Neon's 0.5 GB gets tight.
    output: jsonb('output'), // exactly as generated, before the seeker's edits
    flags: jsonb('flags').$type<Record<string, number>>(), // what the code verifiers dropped
    rating: smallint('rating'), // seeker's thumbs: 1 or -1
    note: text('note'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('usage_user_created_idx').on(t.userId, t.createdAt), index('usage_task_ref_idx').on(t.task, t.refId)],
)

// Feed pages (and MCP list_vacancies calls) served per account per day, for the daily cap in worker/lib/vacancies.ts. Counts only.
export const feedDay = pgTable(
  'feed_day',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    pages: integer('pages').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
)

// What an admin did to an account in /admin (export, delete): who, what, when. No content. The target has no foreign key,
// so the line outlives a deleted account.
export const adminAction = pgTable('admin_action', {
  id: text('id').primaryKey(),
  adminId: text('admin_id').references(() => user.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  targetId: text('target_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Live switches an admin sets in /admin (worker/lib/settings.ts): each row overrides the env var of the same name; no row = the
// env default. Who changed it last is kept; no content.
export const setting = pgTable('setting', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// Every Exa response (people, web, contents, company), keyed by `${kind}:${request body}`. Rows older than 7 days are
// refetched but never deleted: the table doubles as the corpus of everything Exa ever returned.
// The seeker's story bank (shared/stories.ts): STAR stories reused across applications and interviews.
export const story = pgTable(
  'story',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    text: text('text').notNull(),
    tags: text('tags').array().notNull().default([]),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('story_user_idx').on(t.userId, t.createdAt)],
)

// Recognised visa sponsors from the public NL (IND) and UK registers, keyed by shared/sponsors.ts sponsorKey.
// Filled by scripts/import-sponsors.ts; replaced per country on each import.
export const sponsor = pgTable(
  'sponsor',
  {
    key: text('key').notNull(),
    country: text('country').$type<SponsorCountry>().notNull(),
    name: text('name').notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.country] })],
)

export const exaCache = pgTable('exa_cache', {
  key: text('key').primaryKey(),
  results: jsonb('results').$type<unknown>().notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// One posting, shared across users: what two seekers' pastes of the same job match on. Grows into the jobs corpus.
export const posting = pgTable('posting', {
  id: text('id').primaryKey(),
  // Normalized URL, or 'text:' + sha-256 of the pasted text when there is no link (see postingKey).
  key: text('key').notNull().unique(),
  url: text('url'),
  jdText: text('jd_text').notNull(),
  company: text('company').notNull(),
  role: text('role').notNull(),
  location: text('location'),
  domain: text('domain'),
  // The posting-only half of the first evaluation: role, workAuth, requirements (without the CV match), comp, legitimacy, keywords.
  facts: jsonb('facts').$type<PostingFacts>().notNull(),
  seenCount: integer('seen_count').notNull().default(1),
  firstSeenAt: timestamp('first_seen_at').notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
})

// A company by website, fed by jobs (name) and scouts (Wikidata facts). Not the same as companyKey, which intel rows match on.
export const company = pgTable('company', {
  domain: text('domain').primaryKey(),
  name: text('name').notNull(),
  // Wikidata's answer, or null when it has no item for this site; factsAt says when we last asked (re-asked after 30 days).
  facts: jsonb('facts').$type<CompanyFacts & { dissolved: boolean }>(),
  factsAt: timestamp('facts_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' })

// Early-career European vacancies, written only by a feed provider (upsert on url; docs/feed-contract.md).
// Not tied to any user; the feed ranks them per seeker (worker/lib/vacancies.ts).
export const vacancy = pgTable(
  'vacancy',
  {
    url: text('url').primaryKey(),
    source: text('source').notNull(),
    company: text('company').notNull(),
    domain: text('domain'),
    title: text('title').notNull(),
    location: text('location'),
    country: text('country'),
    city: text('city'),
    remote: boolean('remote').notNull().default(false),
    description: text('description'),
    postedAt: date('posted_at'),
    // Last day to apply; null when the source gives none.
    deadline: date('deadline'),
    // explicit (stated), rolling (reviewed as they come), unknown. Never inferred from the post date.
    deadlineType: text('deadline_type').notNull().default('unknown'),
    firstSeen: date('first_seen').notNull(),
    // A vacancy not seen on its source for a while has likely closed.
    lastSeen: date('last_seen').notNull(),
    // Set when the employer's board stopped listing it; pruned 30 days later.
    closedAt: date('closed_at'),
    // FeedLevel: 'internship' | 'entry'.
    level: text('level'),
    // internship | off_cycle | summer | insight | graduate_programme | junior
    program: text('program'),
    // Keys of VACANCY_FUNCTIONS (shared/listings.ts): ib, m&a, ..., software, engineering, legal, science, healthcare, ...
    functions: text('functions').array().notNull().default(sql`'{}'::text[]`),
    // Keys of VACANCY_INDUSTRIES: banking, consulting, law, engineering, pharma, research, government, ...; null when unknown
    industry: text('industry'),
    // Languages the posting asks for (lowercase English names, e.g. 'german'); a seeker must speak all of them.
    langsRequired: text('langs_required').array().notNull().default(sql`'{}'::text[]`),
    // multilingual-e5-small passage embedding; profile_embedding holds the matching query side.
    embedding: halfvec('embedding', { dimensions: 384 }),
    search: tsvector('search').generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(company, '') || ' ' || coalesce(left(description, 2000), ''))`,
    ),
    // Source-specific extras (seniority, min years, company stage/headcount/growth, ...).
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    index('vacancy_deadline_idx').on(t.deadline),
    index('vacancy_domain_idx').on(t.domain),
    index('vacancy_country_level_idx').on(t.country, t.level),
    index('vacancy_first_seen_idx').on(t.firstSeen),
    index('vacancy_functions_idx').using('gin', t.functions),
    index('vacancy_search_idx').using('gin', t.search),
  ],
)

// Jev's 0..1 judgement of how well a vacancy fits a seeker, written by the feed provider for each
// seeker's top cosine matches; the feed prefers it over cosine where present.
export const vacancyFit = pgTable(
  'vacancy_fit',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    url: text('url')
      .notNull()
      .references(() => vacancy.url, { onDelete: 'cascade' }),
    score: doublePrecision('score').notNull(),
    // profile.updated_at at scoring time; rescored when the profile is newer.
    profileAt: timestamp('profile_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.url] })],
)

// A seeker's profile + résumé embedded by the feed provider (same model as vacancy.embedding).
export const profileEmbedding = pgTable('profile_embedding', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  embedding: halfvec('embedding', { dimensions: 384 }).notNull(),
  // profile.updated_at at embedding time; re-embedded when the profile is newer.
  updatedAt: timestamp('updated_at').notNull(),
})

// A job posting the seeker pasted, evaluated against their CV; the tracker row for that application.
export const job = pgTable(
  'job',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // Null for rows from before the shared posting store.
    postingId: text('posting_id').references(() => posting.id, { onDelete: 'set null' }),
    company: text('company').notNull(),
    role: text('role').notNull(),
    url: text('url'),
    location: text('location'),
    jdText: text('jd_text').notNull(),
    // Both null while the posting is only saved.
    evaluation: jsonb('evaluation').$type<JobEvaluation>(),
    score: doublePrecision('score'),
    status: text('status').$type<JobStatus>().notNull().default('evaluated'),
    // Written on demand; null until then.
    cv: jsonb('cv').$type<TailoredCv>(),
    coverLetter: text('cover_letter'),
    // The seeker changed the drafted letter; the draft itself stays in usage.output.
    coverEdited: boolean('cover_edited').notNull().default(false),
    // Negotiation brief once the seeker has an offer; null until requested.
    offerBrief: jsonb('offer_brief').$type<OfferBrief>(),
    // Salary expectation + company health, any stage; null until requested.
    payCheck: jsonb('pay_check').$type<PayCheck>(),
    notes: text('notes'),
    appliedAt: timestamp('applied_at'),
    // The date that matters at this status (NEXT_AT_LABEL); cleared on a status change.
    nextAt: timestamp('next_at'),
    // Every status change, oldest first, appended by PATCH and the MCP tool.
    history: jsonb('history').$type<StatusChange[]>().notNull().default([]),
    offer: jsonb('offer').$type<OfferTerms>(),
    // Set by the daily check when the posting's public board no longer lists it; openCheckedAt is the last check.
    closedAt: timestamp('closed_at'),
    openCheckedAt: timestamp('open_checked_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('job_user_created_idx').on(t.userId, t.createdAt), index('job_posting_idx').on(t.postingId, t.userId)],
)

// One practice attempt on a reported interview question, with the feedback it got; shown again instead of re-asked.
export const practiceAnswer = pgTable(
  'practice_answer',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    jobId: text('job_id')
      .notNull()
      .references(() => job.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    feedback: jsonb('feedback').$type<AnswerFeedback>().notNull(),
    // 'mock' = spoken in the video mock interview; delivery holds its pace and filler stats.
    source: text('source').$type<'text' | 'mock'>().notNull().default('text'),
    delivery: jsonb('delivery').$type<AnswerDelivery>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('practice_answer_job_idx').on(t.jobId, t.createdAt), index('practice_answer_user_idx').on(t.userId, t.createdAt)],
)

// Mock-interview questions per company and kind of role, shared across users so each set is generated once.
export const interviewQuestionSet = pgTable(
  'interview_question_set',
  {
    id: text('id').primaryKey(),
    companyKey: text('company_key').notNull(),
    // Lowercased role title with seniority words kept: "graduate analyst", "summer intern".
    roleKey: text('role_key').notNull(),
    questions: jsonb('questions').$type<InterviewQuestion[]>().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('interview_question_set_key').on(t.companyKey, t.roleKey)],
)

// Every CV review score, so progress shows over time (profile.cvReview keeps only the latest).
export const cvReviewLog = pgTable(
  'cv_review_log',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    score: integer('score').notNull(),
    failed: jsonb('failed').$type<string[]>().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('cv_review_log_user_idx').on(t.userId, t.createdAt)],
)

// ---- Assessment prep ----

// Known recruitment processes, shared across users. The most specific row for a job wins (see bestMatch).
export const assessmentIntel = pgTable(
  'assessment_intel',
  {
    id: text('id').primaryKey(),
    company: text('company').notNull(),
    // Lowercased, trimmed company name: what lookups match on.
    companyKey: text('company_key').notNull(),
    rolePattern: text('role_pattern'),
    location: text('location'),
    provider: text('provider'),
    assessmentTypes: jsonb('assessment_types').$type<AssessmentType[]>().notNull().default([]),
    gameTypes: jsonb('game_types').$type<GameId[]>().notNull().default([]),
    skills: jsonb('skills').$type<SkillWeight[]>().notNull().default([]),
    weightsEstimated: boolean('weights_estimated').notNull().default(true),
    stages: jsonb('stages').$type<string[]>().notNull().default([]),
    difficulty: text('difficulty'),
    timeLimits: text('time_limits'),
    scoringDimensions: jsonb('scoring_dimensions').$type<string[]>().notNull().default([]),
    sources: jsonb('sources').$type<AssessmentSource[]>().notNull().default([]),
    sourceDate: date('source_date').notNull(),
    confidence: text('confidence').$type<Confidence>().notNull(),
    origin: text('origin').$type<CompanyAssessment['origin']>().notNull(),
    notes: text('notes'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('assessment_intel_company_idx').on(t.companyKey)],
)

// "The process changed": shown next to the intel so the next user re-verifies (and re-researches).
export const assessmentReport = pgTable(
  'assessment_report',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    company: text('company').notNull(),
    companyKey: text('company_key').notNull(),
    jobId: text('job_id').references(() => job.id, { onDelete: 'set null' }),
    kind: text('kind').$type<ReportKind>().notNull(),
    detail: text('detail'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('assessment_report_company_idx').on(t.companyKey, t.createdAt)],
)

export const trainingSession = pgTable(
  'training_session',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    jobId: text('job_id').references(() => job.id, { onDelete: 'set null' }),
    mode: text('mode').$type<TrainingMode>().notNull(),
    gameId: text('game_id').$type<GameId>().notNull(),
    // The publisher's version played (PROVIDER_GAMES id, e.g. pymetrics-stop); null for Agisse's own drill. Several share one gameId.
    providerGameId: text('provider_game_id'),
    durationSec: integer('duration_sec').notNull(),
    result: jsonb('result').$type<GameResult>().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('training_session_user_created_idx').on(t.userId, t.createdAt)],
)

// ---- Scout ----

// One company scout: what the seeker asked for and the curated list it returned.
export const scout = pgTable(
  'scout',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    input: jsonb('input').$type<ScoutInput>().notNull(),
    result: jsonb('result').$type<ScoutResult>().notNull(),
    model: text('model'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('scout_user_created_idx').on(t.userId, t.createdAt)],
)

// What the assistant knows about the seeker beyond the CV: written by the seeker, or proposed by the
// assistant and approved by them. Never saved without a click (see /api/memory, worker/lib/helper.ts).
export const memory = pgTable(
  'memory',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<MemoryKind>().notNull(),
    text: text('text').notNull(),
    source: text('source').$type<'user' | 'assistant'>().notNull(),
    // The page it came from, e.g. /jobs/abc.
    ref: text('ref'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('memory_user_idx').on(t.userId, t.createdAt)],
)

// The seeker's shortlist of companies, one row per company (matched on companyKey).
export const savedCompany = pgTable(
  'saved_company',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    companyKey: text('company_key').notNull(),
    name: text('name').notNull(),
    domain: text('domain'),
    why: text('why'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('saved_company_user_key_idx').on(t.userId, t.companyKey)],
)

// A bubble map the seeker saved, named after the company it started from.
export const bubbleMap = pgTable(
  'bubble_map',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    domain: text('domain'),
    data: jsonb('data').$type<BubbleMapData>().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('bubble_map_user_updated_idx').on(t.userId, t.updatedAt)],
)

// ---- Selection process ----

// How a company's hiring rounds run, shared across users like assessment_intel. The most specific row for a job wins (see bestMatch).
export const selectionIntel = pgTable(
  'selection_intel',
  {
    id: text('id').primaryKey(),
    company: text('company').notNull(),
    companyKey: text('company_key').notNull(),
    rolePattern: text('role_pattern'),
    location: text('location'),
    stages: jsonb('stages').$type<SelectionStage[]>().notNull().default([]),
    questions: jsonb('questions').$type<ReportedQuestion[]>().notNull().default([]),
    values: jsonb('values').$type<string[]>().notNull().default([]),
    timeline: text('timeline'),
    difficulty: text('difficulty'),
    advice: jsonb('advice').$type<SourcedTip[]>().notNull().default([]),
    pitfalls: jsonb('pitfalls').$type<SourcedTip[]>().notNull().default([]),
    sources: jsonb('sources').$type<AssessmentSource[]>().notNull().default([]),
    sourceDate: date('source_date').notNull(),
    confidence: text('confidence').$type<Confidence>().notNull(),
    notes: text('notes'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('selection_intel_company_idx').on(t.companyKey)],
)
