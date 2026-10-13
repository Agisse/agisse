// The MCP tool catalog: thin wrappers around existing queries/business logic (worker/lib/shared.ts,
// worker/lib/pipeline.ts) so an AI client (Claude Desktop, Claude Code, ...) connected over `/mcp`
// can read and act on one signed-in user's Agisse data. See worker/index.ts for the auth/transport wiring.
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { and, desc, eq, notInArray } from 'drizzle-orm'
import type { PgUpdateSetSource } from 'drizzle-orm/pg-core'
import type { Db } from '../db'
import { schema } from '../db'
import { draftOutreach } from './pipeline'
import { EvaluationOutput, cvText, evaluationBrief, evaluationSchema, finalizeEvaluation, findPosting, insertJob, pushStatus } from './jobs'
import { SavedCompanyInput, toSaved, upsertSavedCompany } from './companies'
import { PAGE, searchVacancies } from './vacancies'
import { dueItems } from '../../src/lib/followup'
import { budgetSpent, charge, decodeCursor, loadBudget, loadContactedPeople, loadJobSummaries, loadMemories, loadProfile, loadResumeText, loadSearchList, loadSearchWithPeople, modelError, newMeter, toJob, userStyle, toPerson, type Page, type PageQuery } from './shared'
import { EMPTY_FEED_PREFS, FEED_LEVELS, SPOKEN_LANGUAGES } from '../../shared/listings'
import { JD_TEXT_LIMIT, JOB_STATUSES, NOTE_LANGUAGES, REPLY_STATUSES, type NoteLanguage, type Person } from '../../shared/types'

export const text = (value: unknown) => ({ content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value) }] })
export const errorText = (value: string) => ({ ...text(value), isError: true as const })
/** JSON text for clients that ignore outputSchema, plus the same object as structuredContent (checked by the SDK against outputSchema). */
export const structured = (value: Record<string, unknown>) => ({ ...text(value), structuredContent: value })

// Exported (rather than inlined in registerTool) so worker/lib/mcp.check.ts can validate them directly.
export const DraftOutreachInput = { personId: z.string(), rewrite: z.boolean().optional(), lang: z.enum(NOTE_LANGUAGES).optional() }
export const UpdateContactStatusInput = {
  personId: z.string(),
  status: z.enum(REPLY_STATUSES).optional(),
  followedUp: z.boolean().optional(),
  expectedStatus: z.enum(REPLY_STATUSES).optional(),
}
export const GetContactInput = { personId: z.string() }
export const GetBoardItemInput = { jobId: z.string() }
export const GetSeekerBriefInput = { jdText: z.string().trim().max(JD_TEXT_LIMIT).optional().describe('The posting text. When given, the evaluation rubric and output schema for it come back too.') }
export const AddJobInput = {
  jdText: z.string().trim().min(200, 'Paste the whole posting: that is too little text to judge.').max(JD_TEXT_LIMIT),
  url: z.string().trim().url().max(500).optional().describe('The posting link; used to spot a posting already on the board.'),
  evaluation: EvaluationOutput.describe('Your evaluation of the posting, in the outputSchema get_seeker_brief returned for it.'),
}
export const AddToShortlistInput = SavedCompanyInput
export const UpdateJobStatusInput = {
  jobId: z.string(),
  status: z.enum(JOB_STATUSES),
  expectedStatus: z.enum(JOB_STATUSES).optional(),
}
// Same filters as GET /api/vacancies; anything left out falls back to the seeker's saved feed filters.
const saved = ' Omit to use the seeker\'s saved feed filter.'
export const ListVacanciesInput = {
  q: z.string().max(120).optional().describe('Keywords.' + saved),
  countries: z.array(z.string().max(4)).max(40).optional().describe('ISO country codes, e.g. BE, NL; remote-in-Europe roles always show.' + saved),
  level: z.enum(FEED_LEVELS).optional().describe(saved.trim()),
  functions: z.array(z.string().max(20)).max(20).optional().describe('Function keys, e.g. m&a, marketing.' + saved),
  industries: z.array(z.string().max(30)).max(20).optional().describe(saved.trim()),
  languages: z.array(z.enum(SPOKEN_LANGUAGES)).max(16).optional().describe('Languages the seeker speaks; hides postings requiring others.' + saved),
  remoteOnly: z.boolean().optional().describe(saved.trim()),
  deadlineWithin: z.number().int().min(1).max(365).optional().describe('Only roles with a stated deadline in the next N days.'),
  sort: z.enum(['match', 'new', 'deadline']).default('match'),
  cursor: z.string().optional().describe('nextCursor from the previous page, passed back unchanged.'),
}

const IsoDate = z.union([z.iso.date(), z.iso.datetime({ offset: true })])
const ListInput = {
  limit: z.number().int().min(1).max(100).default(50).describe('Page size, 1-100.'),
  cursor: z.string().optional().describe('nextCursor from the previous page, passed back unchanged.'),
  company: z.string().max(200).optional().describe('Case-insensitive substring of the company name.'),
  since: IsoDate.optional().describe('ISO date or datetime (UTC); inclusive lower bound.'),
  until: IsoDate.optional().describe('ISO date or datetime (UTC); exclusive upper bound.'),
}
export const ListBoardInput = { ...ListInput, status: z.enum(JOB_STATUSES).optional() }
export const ListSearchesInput = ListInput
export const ListContactedInput = { ...ListInput, status: z.enum(REPLY_STATUSES).optional() }

/** Decode the cursor, run one keyset page, return it structured. */
async function listPage<T>({ cursor, ...q }: Omit<PageQuery, 'after'> & { cursor?: string }, load: (q: PageQuery) => Promise<Page<T>>) {
  const after = cursor === undefined ? undefined : decodeCursor(cursor)
  if (after === null) return errorText('Invalid cursor: pass nextCursor from the previous page unchanged.')
  return structured(await load({ ...q, after }))
}

// Output schemas: exact on the top-level fields, loose (passthrough) below them.
const Str = z.string()
const Nullable = z.string().nullable()
const PersonOut = z.looseObject({
  id: Str,
  searchId: Nullable,
  name: Str,
  title: Str,
  company: Str,
  profileUrl: Str,
  sharedGround: z.array(z.looseObject({ kind: Str, detail: Str })),
  outreach: Str,
  contactedAt: Nullable,
  status: z.enum(REPLY_STATUSES).nullable(),
  followedUpAt: Nullable,
})
const SearchOut = z.looseObject({ id: Str, number: z.number(), company: Str, domain: Nullable, role: Str, location: Nullable, status: Str, peopleCount: z.number(), createdAt: Str })
const JobSummaryOut = z.looseObject({ id: Str, company: Str, domain: Nullable, role: Str, location: Nullable, url: Nullable, score: z.number().nullable(), status: z.enum(JOB_STATUSES), appliedAt: Nullable, nextAt: Nullable, createdAt: Str, recommendation: Str.nullable() })
const JobOut = {
  ...JobSummaryOut.omit({ recommendation: true }).shape,
  jdText: Str,
  history: z.any(),
  offer: z.any(),
  evaluation: z.any(),
  cv: z.any(),
  coverLetter: Nullable,
  offerBrief: z.any(),
  payCheck: z.any(),
  notes: Nullable,
  closedAt: Nullable,
}
const SavedOut = z.looseObject({ id: Str, name: Str, domain: Nullable, why: Nullable, createdAt: Str })
const BudgetOut = z.looseObject({ used: z.number(), limit: z.number(), cost: z.number(), tokens: z.number(), resetsOn: Str })
const pageOf = (item: z.ZodType) => ({ items: z.array(item), nextCursor: Nullable, total: z.number() })
export const OutputSchemas = {
  list_board: pageOf(JobSummaryOut),
  get_board_item: JobOut,
  list_searches: pageOf(SearchOut),
  // Loose at the top too: these carry more fields than named here.
  get_search: SearchOut.extend({ people: z.array(PersonOut) }),
  list_contacted: pageOf(PersonOut.extend({ search: z.looseObject({ id: Str, company: Str, role: Str }).nullable() })),
  get_contact: PersonOut,
  get_profile: { id: Str, name: Nullable, email: Nullable },
  get_memory: { items: z.array(z.looseObject({ kind: Str, text: Str })) },
  get_usage: { ...BudgetOut.shape, remaining: z.number() },
  list_due_followups: {
    items: z.array(z.looseObject({ kind: z.enum(['person', 'job']), label: Str, person: z.looseObject({ id: Str }).optional(), job: z.looseObject({ id: Str }).optional() })),
  },
  draft_outreach: {
    person: PersonOut,
    charged: z.boolean(),
    model: Str.optional(),
    charLimit: z.number().optional().describe('Character limit the draft was held to (only when a new draft was written).'),
    research: z
      .object({
        performed: z.boolean().describe('Always false: no live web research is done while drafting.'),
        note: Str,
        sources: z.array(z.object({ label: Str, value: Str })),
      })
      .optional(),
    budgetBefore: BudgetOut.optional(),
    budgetAfter: BudgetOut.optional(),
  },
  update_contact_status: { before: PersonOut, after: PersonOut },
  get_seeker_brief: {
    cv: Str.describe("The seeker's CV text (imported résumé, else the profile fields)."),
    targetIndustries: z.array(Str),
    evaluation: z.object({ instructions: Str, outputSchema: z.any() }).optional().describe('Only with jdText: the rubric to evaluate that posting by, and the JSON schema add_job expects.'),
  },
  add_job: { job: z.object(JobOut), existing: z.boolean().describe('True when the posting was already on the board; nothing was written.') },
  add_to_shortlist: { company: SavedOut },
  list_vacancies: {
    items: z.array(z.looseObject({ url: Str, title: Str, company: Str, location: Nullable, fit: z.number().describe('0-100 match for this seeker.'), reasons: z.array(Str), deadline: Nullable })),
    nextCursor: Nullable,
    profiled: z.boolean().describe('False until the seeker\'s profile is embedded; the fit is then only freshness and function.'),
  },
  update_job_status: { before: z.object(JobOut), after: z.object(JobOut) },
  list_shortlist: { items: z.array(SavedOut) },
}

/** What drafting drew on. draftOutreach makes no web calls: it only sees the facts stored on the contact when the booth search ran. */
const researchFor = (p: Person) => ({
  performed: false,
  note: 'No live web research. The note is written from facts stored on the contact when the booth search ran (summary, reason, shared ground) and your profile.',
  sources: [
    ...p.sharedGround.map((g) => ({ label: `Shared ground (${g.kind}), stored on the contact`, value: g.detail })),
    { label: 'Profile URL stored on the contact (not fetched while drafting)', value: p.profileUrl },
    ...p.sourceUrls.map((u) => ({ label: 'Source found by the booth search (not re-fetched while drafting)', value: u })),
  ],
})

const READ = { readOnlyHint: true, openWorldHint: false } as const

export function buildMcpServer(db: Db, env: Env, userId: string, trial: boolean) {
  const server = new McpServer({ name: 'agisse', version: '1.0.0' })

  server.registerTool(
    'list_board',
    {
      title: 'List job board',
      description: "List the user's tracked job applications (the Board), newest first, one page at a time. Filter by status, company, or createdAt (since/until).",
      inputSchema: ListBoardInput,
      outputSchema: OutputSchemas.list_board,
      annotations: READ,
    },
    async (args) => listPage(args, (q) => loadJobSummaries(db, userId, q)),
  )

  server.registerTool(
    'get_board_item',
    { title: 'Get one job', description: 'Get one tracked job application in full: evaluation, tailored CV, cover letter, notes.', inputSchema: GetBoardItemInput, outputSchema: OutputSchemas.get_board_item, annotations: READ },
    async ({ jobId }) => {
      const row = await db.query.job.findFirst({ where: and(eq(schema.job.id, jobId), eq(schema.job.userId, userId)) })
      return row ? structured(toJob(row)) : errorText('Job not found')
    },
  )

  server.registerTool(
    'list_searches',
    {
      title: 'List booths',
      description: "List the user's people searches (booths on the Map), newest first, one page at a time. Filter by company or createdAt (since/until).",
      inputSchema: ListSearchesInput,
      outputSchema: OutputSchemas.list_searches,
      annotations: READ,
    },
    async (args) => listPage(args, (q) => loadSearchList(db, userId, q)),
  )

  server.registerTool(
    'get_search',
    { title: 'Get one booth', description: 'Get one booth (a company/role search) and the ranked people found for it.', inputSchema: { searchId: z.string() }, outputSchema: OutputSchemas.get_search, annotations: READ },
    async ({ searchId }) => {
      const found = await loadSearchWithPeople(db, userId, searchId)
      return found ? structured(found.search) : errorText('Search not found')
    },
  )

  server.registerTool(
    'list_contacted',
    {
      title: 'List contacted people',
      description: 'List the people the user has marked as contacted, newest first, one page at a time. Filter by reply status, company, or contactedAt (since/until).',
      inputSchema: ListContactedInput,
      outputSchema: OutputSchemas.list_contacted,
      annotations: READ,
    },
    async (args) => listPage(args, (q) => loadContactedPeople(db, userId, q)),
  )

  server.registerTool(
    'get_contact',
    { title: 'Get one contact', description: 'Get one person (from a booth or added by hand), including their outreach draft and reply status.', inputSchema: GetContactInput, outputSchema: OutputSchemas.get_contact, annotations: READ },
    async ({ personId }) => {
      const row = await db.query.person.findFirst({ where: and(eq(schema.person.id, personId), eq(schema.person.userId, userId)) })
      return row ? structured(toPerson(row)) : errorText('Person not found')
    },
  )

  server.registerTool(
    'get_profile',
    { title: 'Get profile', description: 'Get the signed-in user: a stable opaque id, name and email.', outputSchema: OutputSchemas.get_profile, annotations: READ, _meta: { 'openai/profile': true } },
    async () => {
      const u = await db.query.user.findFirst({ where: eq(schema.user.id, userId), columns: { name: true, email: true } })
      return structured({ id: userId, name: u?.name ?? null, email: u?.email ?? null })
    },
  )

  server.registerTool(
    'get_memory',
    {
      title: 'Get memory',
      description: "What the user told Agisse's assistant about themselves beyond the CV: goals, preferences, constraints, background and writing style. Respect these when advising or drafting.",
      outputSchema: OutputSchemas.get_memory,
      annotations: READ,
    },
    async () => structured({ items: (await loadMemories(db, userId)).map(({ kind, text }) => ({ kind, text })) }),
  )

  server.registerTool(
    'get_usage',
    { title: 'Get AI budget', description: "Get this month's AI budget in EUR: used, limit, remaining, and when it resets.", outputSchema: OutputSchemas.get_usage, annotations: READ },
    async () => {
      const b = await loadBudget(db, env, userId)
      return structured({ ...b, remaining: Math.max(0, b.limit - b.used) })
    },
  )

  server.registerTool(
    'list_due_followups',
    { title: 'List follow-ups due', description: 'List what is due today: contacted people due a follow-up (7-day cadence, one follow-up only), silent applications, and near application deadlines, tests, interviews and offer replies.', outputSchema: OutputSchemas.list_due_followups, annotations: READ },
    async () => {
      const [people, jobs] = await Promise.all([
        db
          .select({ id: schema.person.id, name: schema.person.name, company: schema.person.company, status: schema.person.status, contactedAt: schema.person.contactedAt, followedUpAt: schema.person.followedUpAt })
          .from(schema.person)
          .where(and(eq(schema.person.userId, userId), eq(schema.person.status, 'contacted'))),
        db
          .select({ id: schema.job.id, company: schema.job.company, role: schema.job.role, status: schema.job.status, appliedAt: schema.job.appliedAt, nextAt: schema.job.nextAt })
          .from(schema.job)
          .where(and(eq(schema.job.userId, userId), notInArray(schema.job.status, ['rejected', 'discarded']))),
      ])
      const iso = (d: Date | null) => d?.toISOString() ?? null
      const due = dueItems(
        jobs.map((j) => ({ ...j, appliedAt: iso(j.appliedAt), nextAt: iso(j.nextAt) })),
        people.map((p) => ({ ...p, contactedAt: iso(p.contactedAt), followedUpAt: iso(p.followedUpAt) })),
      )
      return structured({ items: due })
    },
  )

  server.registerTool(
    'draft_outreach',
    {
      title: 'Draft outreach note',
      description:
        'Draft (or, with rewrite=true, replace) the personalized outreach note for one contact and store it on the contact. ' +
        "Consumes the user's monthly AI budget and sends the contact's and user's profile data to an external AI model. " +
        'It only drafts: it never sends the note or contacts anyone. Returns the existing draft free of charge when one exists and rewrite is not set. ' +
        'Does no live web research: a new draft reports the character limit it was held to (charLimit) and the stored facts it drew on (research).',
      inputSchema: DraftOutreachInput,
      outputSchema: OutputSchemas.draft_outreach,
      // rewrite=true discards the previous draft, hence destructive.
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ personId, rewrite, lang }) => {
      const row = await db.query.person.findFirst({ where: and(eq(schema.person.id, personId), eq(schema.person.userId, userId)) })
      if (!row) return errorText('Person not found')
      // Existing draft, no rewrite: no model call, nothing charged.
      if (row.outreach && !rewrite) return structured({ person: toPerson(row), charged: false })
      if (!row.searchId) return errorText('Added by hand, so there is no search to draft from.')

      const [srch, profile, u] = await Promise.all([
        db.query.search.findFirst({ where: eq(schema.search.id, row.searchId) }),
        loadProfile(db, userId),
        db.query.user.findFirst({ where: eq(schema.user.id, userId), columns: { name: true } }),
      ])
      if (!srch) return errorText('Search not found')
      const budgetBefore = await loadBudget(db, env, userId)
      if (budgetBefore.used >= budgetBefore.limit) return errorText(budgetSpent(budgetBefore))
      const meter = await newMeter(db, env, userId, trial)
      meter.ref = row.id
      let result: { person: Person; model: string; charLimit: number }
      try {
        const { outreach, model, charLimit } = await draftOutreach(
          env,
          row,
          { company: srch.company, role: srch.role, location: srch.location, goal: srch.goal },
          profile,
          u?.name ?? 'the seeker',
          meter,
          { lang: (lang ?? 'en') as NoteLanguage, kind: 'note', style: await userStyle(db, userId, 'agisse_outreach', row.id) },
        )
        const [updated] = await db.update(schema.person).set({ outreach, outreachEdited: false }).where(eq(schema.person.id, row.id)).returning()
        result = { person: toPerson(updated ?? row), model, charLimit }
      } catch (err) {
        return errorText(modelError(err, 'write the note'))
      } finally {
        await charge(db, userId, 'outreach', meter)
      }
      return structured({ ...result, charged: true, research: researchFor(result.person), budgetBefore, budgetAfter: await loadBudget(db, env, userId) })
    },
  )

  server.registerTool(
    'update_contact_status',
    {
      title: 'Update contact status',
      description:
        "Update a contacted person's reply status, or mark a follow-up sent. Pass expectedStatus to only write when the current status still matches. Returns { before, after }.",
      inputSchema: UpdateContactStatusInput,
      outputSchema: OutputSchemas.update_contact_status,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ personId, status, followedUp, expectedStatus }) => {
      const mine = and(eq(schema.person.id, personId), eq(schema.person.userId, userId))
      const before = await db.query.person.findFirst({ where: mine })
      if (!before) return errorText('Person not found')
      if (expectedStatus !== undefined && before.status !== expectedStatus)
        return errorText(`Status is "${before.status}", not the expected "${expectedStatus}". Nothing was changed.`)
      const set: Partial<typeof schema.person.$inferInsert> = {}
      if (status !== undefined) set.status = status
      if (followedUp !== undefined) set.followedUpAt = followedUp ? new Date() : null
      if (!Object.keys(set).length) return structured({ before: toPerson(before), after: toPerson(before) })
      const [after] = await db
        .update(schema.person)
        .set(set)
        .where(expectedStatus === undefined ? mine : and(mine, eq(schema.person.status, expectedStatus)))
        .returning()
      // Only reachable when a concurrent write changed the status between the read and the update.
      if (!after) return errorText(`Status changed concurrently from "${expectedStatus}". Nothing was changed; re-read and retry.`)
      return structured({ before: toPerson(before), after: toPerson(after) })
    },
  )

  // ---- Bring your own model: the client does research, ideation and evaluation itself; these only hand over inputs and take results. ----

  server.registerTool(
    'get_seeker_brief',
    {
      title: 'Get seeker brief',
      description:
        "The seeker's CV and target industries, for research and company ideation done by you (do your own web research; the server makes no model call for this). " +
        'Pass jdText to also get the evaluation rubric and the exact output schema: evaluate the posting yourself by that rubric, then call add_job with the result. Costs nothing from the AI budget.',
      inputSchema: GetSeekerBriefInput,
      outputSchema: OutputSchemas.get_seeker_brief,
      annotations: READ,
    },
    async ({ jdText }) => {
      const [profile, resumeText] = await Promise.all([loadProfile(db, userId), loadResumeText(db, userId)])
      const brief = { cv: cvText(profile, resumeText), targetIndustries: profile?.targetIndustries ?? [] }
      if (!jdText) return structured(brief)
      return structured({ ...brief, evaluation: { instructions: evaluationBrief(jdText, profile, resumeText).system, outputSchema: evaluationSchema } })
    },
  )

  server.registerTool(
    'add_job',
    {
      title: 'Add job to board',
      description:
        'Pin a posting on the Board with an evaluation you produced (see get_seeker_brief). No model call, nothing charged. ' +
        'A posting already on the board (same link or same text) is returned with existing: true and nothing is written.',
      inputSchema: AddJobInput,
      outputSchema: OutputSchemas.add_job,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ jdText, url, evaluation }) => {
      const { mine, shared, key } = await findPosting(db, userId, url ?? null, jdText)
      if (mine) return structured({ job: toJob(mine), existing: true })
      const row = await insertJob(db, userId, { url: url ?? null, jdText, evaluation: finalizeEvaluation(evaluation), shared, key })
      return structured({ job: toJob(row), existing: false })
    },
  )

  server.registerTool(
    'add_to_shortlist',
    {
      title: 'Add company to shortlist',
      description: "Save a company the seeker should target, with why. Saving the same name again updates it. Use after company ideation done with the seeker's brief.",
      inputSchema: AddToShortlistInput,
      outputSchema: OutputSchemas.add_to_shortlist,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (input) => structured({ company: toSaved(await upsertSavedCompany(db, userId, input)) }),
  )

  server.registerTool(
    'list_shortlist',
    { title: 'List shortlist', description: "List the companies the seeker saved to target (their shortlist), newest first, each with why.", outputSchema: OutputSchemas.list_shortlist, annotations: READ },
    async () => {
      const rows = await db.query.savedCompany.findMany({ where: eq(schema.savedCompany.userId, userId), orderBy: desc(schema.savedCompany.createdAt) })
      return structured({ items: rows.map(toSaved) })
    },
  )

  // ---- Discover → track: the feed to pick from, then add_job and update_job_status as the application moves. ----

  server.registerTool(
    'list_vacancies',
    {
      title: 'List jobs for you',
      description:
        "The seeker's feed of open European early-career postings (\"Jobs for you\"), ranked by fit to their profile, 30 per page. " +
        "Filters default to the seeker's saved feed filters. reasons says why each role fits, Jev's verdict first when one exists. No model call, nothing charged. " +
        'To track one, read the posting at its url, evaluate it (get_seeker_brief) and call add_job.',
      inputSchema: ListVacanciesInput,
      outputSchema: OutputSchemas.list_vacancies,
      annotations: READ,
    },
    async ({ cursor, sort, ...f }) => {
      const offset = cursor === undefined ? 0 : Number(cursor)
      if (!Number.isInteger(offset) || offset < 0 || offset > 3000) return errorText('Invalid cursor: pass nextCursor from the previous page unchanged.')
      const profile = await loadProfile(db, userId)
      const p = { ...EMPTY_FEED_PREFS, ...profile?.jobFeed }
      const { vacancies, more, profiled } = await searchVacancies(
        db,
        userId,
        { q: f.q ?? p.query, countries: f.countries?.map((x) => x.toUpperCase()) ?? p.countries, level: f.level ?? p.level, functions: f.functions ?? p.functions, industries: f.industries ?? p.industries, languages: f.languages ?? p.languages, remoteOnly: f.remoteOnly ?? p.remoteOnly, deadlineWithin: f.deadlineWithin ?? null, sort, offset, blocked: p.blocked, sponsorsOnly: p.sponsorsOnly },
        [...(profile?.skills ?? []), ...(profile?.targetIndustries ?? [])],
      )
      const items = vacancies.map((x) => ({ url: x.url, title: x.title, company: x.company, location: x.location, fit: x.score, reasons: x.reasons, deadline: x.deadline, visaSponsor: x.sponsors }))
      return structured({ items, nextCursor: more ? String(offset + PAGE) : null, profiled })
    },
  )

  server.registerTool(
    'update_job_status',
    {
      title: 'Update job status',
      description:
        "Move a tracked application to another status (e.g. applied, interview, offer), as the web board does. Pass expectedStatus to only write when the current status still matches. Returns { before, after }.",
      inputSchema: UpdateJobStatusInput,
      outputSchema: OutputSchemas.update_job_status,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ jobId, status, expectedStatus }) => {
      const mine = and(eq(schema.job.id, jobId), eq(schema.job.userId, userId))
      const before = await db.query.job.findFirst({ where: mine })
      if (!before) return errorText('Job not found')
      if (expectedStatus !== undefined && before.status !== expectedStatus)
        return errorText(`Status is "${before.status}", not the expected "${expectedStatus}". Nothing was changed.`)
      // Mirrors PATCH /api/jobs/:id: applied stamps appliedAt, back to saved, evaluated or discarded clears it; the status date goes.
      const set: PgUpdateSetSource<typeof schema.job> = { status, nextAt: null, history: pushStatus(status), updatedAt: new Date() }
      if (status === 'applied') set.appliedAt = new Date()
      if (status === 'saved' || status === 'evaluated' || status === 'discarded') set.appliedAt = null
      const [after] = await db
        .update(schema.job)
        .set(set)
        .where(expectedStatus === undefined ? mine : and(mine, eq(schema.job.status, expectedStatus)))
        .returning()
      if (!after) return errorText(`Status changed concurrently from "${expectedStatus}". Nothing was changed; re-read and retry.`)
      return structured({ before: toJob(before), after: toJob(after) })
    },
  )

  return server
}
