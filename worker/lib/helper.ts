import { z } from 'zod'
import type { Db } from '../db'
import { schema } from '../db'
import { and, desc, eq } from 'drizzle-orm'
import type { HelperMessage, HelperProposal } from '../../shared/helper'
import { JOB_STATUSES, MEMORY_KINDS, REPLY_STATUSES, type Memory } from '../../shared/types'
import type { Meter } from './openrouter'
import { generateStructured } from './openrouter'
import { preferredModels, profileText } from './pipeline'
import { loadMemories, loadSearchWithPeople } from './shared'

// Proposals are flat (every field nullable) so free models can fill the schema; parseProposals turns them into the union.
const RawProposal = z.object({
  type: z.enum(['remember', 'job_update', 'person_update']),
  kind: z.string().nullable(),
  text: z.string().nullable(),
  jobId: z.string().nullable(),
  personId: z.string().nullable(),
  status: z.string().nullable(),
  nextAt: z.string().nullable(),
  note: z.string().nullable(),
})
type RawProposal = z.infer<typeof RawProposal>

const ReplySchema = z.object({
  answer: z.string().trim().min(1).max(4000),
  actions: z.array(z.object({
    label: z.string().trim().min(1).max(72),
    reason: z.string().trim().min(1).max(220),
    href: z.string().trim().min(1).max(240),
  })).max(3),
  proposals: z.array(RawProposal).max(3).catch([]),
  suggestions: z.array(z.string().trim().min(1).max(120)).min(2).max(4),
})

const nullable = (type: string, description: string, extra: object = {}) => ({ type: [type, 'null'], description, ...extra })

const schemaJson = {
  type: 'object',
  additionalProperties: false,
  required: ['answer', 'actions', 'proposals', 'suggestions'],
  properties: {
    answer: { type: 'string', description: 'A concise, grounded plain-text answer. Use short paragraphs; do not use Markdown. Never repeat the action cards.' },
    actions: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'reason', 'href'],
        properties: {
          label: { type: 'string', description: 'A specific action, starting with a verb' },
          reason: { type: 'string', description: 'Why this is the best next move now' },
          href: { type: 'string', description: 'One exact internal path supplied in the context' },
        },
      },
    },
    proposals: {
      type: 'array',
      maxItems: 3,
      description: 'Changes the seeker can apply with one click. Usually none. Fill only the fields the type uses; null the rest.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'kind', 'text', 'jobId', 'personId', 'status', 'nextAt', 'note'],
        properties: {
          type: { type: 'string', enum: ['remember', 'job_update', 'person_update'] },
          kind: nullable('string', 'remember only: what sort of fact', { enum: [...MEMORY_KINDS, null] }),
          text: nullable('string', 'remember only: one short sentence in the second person, e.g. "You want to stay in Amsterdam."'),
          jobId: nullable('string', 'job_update only: an id from jobs'),
          personId: nullable('string', 'person_update only: an id from contacts'),
          status: nullable('string', `job_update: one of ${JOB_STATUSES.join(', ')}; person_update: one of ${REPLY_STATUSES.join(', ')}; null to keep it`),
          nextAt: nullable('string', 'job_update only: next step date YYYY-MM-DD, or null'),
          note: nullable('string', 'job_update/person_update: one line to add to the notes, or null'),
        },
      },
    },
    suggestions: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string' }, description: 'Useful follow-up questions the seeker can ask next' },
  },
} as const

// The desk's scripted first question; expensive (8 queries + a model call), so it's run only on
// request and cached on the profile row, not on every page load.
export const OPENING_QUESTION = 'Read my whole job-search workspace and give me a concise briefing: what deserves my attention first, what may be stalled, and the three most useful next moves.'


const HELPER_RULES = `You are the Agisse assistant: a candid, practical thinking partner for an early-career job seeker. You can see their current Agisse workspace below. Synthesize across it; do not merely summarize one page.

Rules:
- Use only facts in the workspace. Say when information is missing. Never invent dates, replies, skills, companies, or progress.
- currentPage is what the seeker is looking at right now. When the question could be about it ("this job", "here", "should I apply?"), answer about it first.
- memories are things the seeker told you or approved. Respect them (goals, preferences, constraints, style) without repeating them back.
- Prioritize the few actions that improve the search now: strong-fit applications, warm outreach, overdue follow-ups, interview preparation, or widening a stalled search.
- Treat low-fit jobs (score below 4) as do-not-apply unless the user explicitly asks to inspect one.
- Do not automate outreach or imply a message was sent. The seeker stays in control.
- Proposals are optional one-click changes the seeker reviews. Propose "remember" only for a durable fact the seeker stated in this conversation (a goal, preference, constraint, background or writing style) that is not already in memories or the profile. Propose job_update/person_update only when the seeker said something happened (applied, got a reply, has an interview date) or asked you to note something. Never propose what they did not say.
- Be concise, specific, warm, and direct. Avoid generic encouragement and corporate language.
- Write plain text only, with short paragraphs and no Markdown formatting.
- In labels, call the sections Contacts, Companies, Jobs, Applications, Practice and Profile.
- Action hrefs must be copied exactly from allowedPaths. Return no action when there is no honest in-product next step.
- The first user request may ask for a briefing. Lead with the single clearest priority and explain why.`

export type Page =
  | { kind: 'job'; id: string; tab: string }
  | { kind: 'search'; id: string }
  | { kind: 'scout'; id: string }
  | { kind: 'cvReview' }
  | { kind: 'profile' }
  | { kind: 'practice' }
  | { kind: 'other'; path: string }

/** Which entity the seeker is looking at, from the app path alone (see src/App.tsx routes). */
export function parsePage(path: string): Page {
  const [p] = path.split(/[?#]/)
  let m: RegExpMatchArray | null
  if ((m = p.match(/^\/jobs\/([\w-]+)(?:\/(\w+))?\/?$/)) && m[1] !== 'map') return { kind: 'job', id: m[1], tab: m[2] ?? 'overview' }
  if ((m = p.match(/^\/s\/([\w-]+)\/?$/))) return { kind: 'search', id: m[1] }
  if ((m = p.match(/^\/scout\/([\w-]+)\/?$/)) && m[1] !== 'map') return { kind: 'scout', id: m[1] }
  if (p.startsWith('/prepare/cv')) return { kind: 'cvReview' }
  if (p === '/profile' || p === '/badge') return { kind: 'profile' }
  if (p === '/prepare' || p === '/prepare/tests' || p.startsWith('/prepare/interviews') || p === '/practice') return { kind: 'practice' }
  return { kind: 'other', path: p || '/' }
}

const clip = (s: string | null | undefined, n: number) => (s && s.length > n ? `${s.slice(0, n)}…` : (s ?? null))

/** The page in full enough detail to answer "this job / these people"; loaded by id, always scoped to the seeker. */
async function pageContext(db: Db, userId: string, page: Page) {
  switch (page.kind) {
    case 'job': {
      const j = await db.query.job.findFirst({ where: and(eq(schema.job.id, page.id), eq(schema.job.userId, userId)) })
      if (!j) return { page: 'job (not found)' }
      const e = j.evaluation
      return {
        page: `job, ${page.tab} tab`,
        job: {
          id: j.id, company: j.company, role: j.role, location: j.location, url: j.url, score: j.score, status: j.status,
          appliedAt: j.appliedAt?.toISOString() ?? null, nextAt: j.nextAt?.toISOString().slice(0, 10) ?? null, notes: j.notes,
          history: j.history, offer: j.offer, hasTailoredCv: !!j.cv, hasCoverLetter: !!j.coverLetter,
          evaluation: e && {
            tldr: e.role.tldr, seniority: e.role.seniority, remote: e.role.remote, workAuth: e.workAuth, recommendation: e.recommendation,
            dimensions: e.dimensions, hardStops: e.hardStops, cvChanges: e.cvChanges, keywords: e.keywords,
            requirements: e.requirements.slice(0, 12),
            comp: e.comp.advertisedVerbatim,
          },
          jobDescription: clip(j.jdText, 3000),
        },
      }
    }
    case 'search': {
      const r = await loadSearchWithPeople(db, userId, page.id)
      if (!r) return { page: 'booth (not found)' }
      const s = r.search
      return {
        page: 'booth: people at one company',
        booth: { company: s.company, role: s.role, goal: s.goal, status: s.status },
        people: s.people.slice(0, 25).map((p) => ({ id: p.id, name: p.name, title: p.title, score: p.score, status: p.status, sharedGround: p.sharedGround.map((g) => g.detail), note: p.notes, hasOutreach: !!p.outreach })),
      }
    }
    case 'scout': {
      const s = await db.query.scout.findFirst({ where: and(eq(schema.scout.id, page.id), eq(schema.scout.userId, userId)) })
      return s ? { page: 'scout: companies picked for the seeker', input: s.input, picks: s.result.picks.slice(0, 15) } : { page: 'scout (not found)' }
    }
    case 'cvReview': {
      const p = await db.query.profile.findFirst({ where: eq(schema.profile.userId, userId), columns: { cvReview: true, resumeText: true } })
      return { page: 'CV review: recruiter checks on the seeker’s CV', cvReview: p?.cvReview ?? null, cvText: clip(p?.resumeText, 6000) }
    }
    case 'profile':
      return { page: 'Profile: the seeker’s badge, CV and memories' }
    case 'practice':
      return { page: 'Practice: assessment games and interview answers (see training and interviewPractice)' }
    case 'other':
      return { page: page.path }
  }
}

const sameText = (a: string, b: string) => a.trim().toLowerCase().replace(/[.!]+$/, '') === b.trim().toLowerCase().replace(/[.!]+$/, '')
const addNote = (notes: string | null, line: string) => (notes ? `${notes}\n${line}` : line).slice(-2000)

type Known = {
  jobs: Map<string, { label: string; notes: string | null }>
  people: Map<string, { label: string; notes: string | null }>
  memories: Pick<Memory, 'text'>[]
}

/** Keeps only proposals that touch the seeker's own rows and say something new; fills labels and final notes. */
export function parseProposals(raw: RawProposal[], known: Known): HelperProposal[] {
  const out: HelperProposal[] = []
  for (const p of raw) {
    const note = p.note?.trim().slice(0, 300) || null
    if (p.type === 'remember') {
      const text = p.text?.trim().slice(0, 300)
      const kind = MEMORY_KINDS.find((k) => k === p.kind)
      if (!text || !kind || known.memories.some((m) => sameText(m.text, text))) continue
      out.push({ type: 'remember', kind, text })
    } else if (p.type === 'job_update') {
      const job = p.jobId ? known.jobs.get(p.jobId) : undefined
      const status = JOB_STATUSES.find((s) => s === p.status) ?? null
      const nextAt = p.nextAt && /^\d{4}-\d{2}-\d{2}$/.test(p.nextAt) && !Number.isNaN(Date.parse(p.nextAt)) ? new Date(`${p.nextAt}T09:00:00Z`).toISOString() : null
      if (!job || (!status && !nextAt && !note)) continue
      out.push({ type: 'job_update', jobId: p.jobId!, label: job.label, status, nextAt, note, notes: note ? addNote(job.notes, note) : null })
    } else {
      const person = p.personId ? known.people.get(p.personId) : undefined
      const status = REPLY_STATUSES.find((s) => s === p.status) ?? null
      if (!person || (!status && !note)) continue
      out.push({ type: 'person_update', personId: p.personId!, label: person.label, status, note, notes: note ? addNote(person.notes, note) : null })
    }
  }
  return out
}

export async function askHelper(env: Env, db: Db, userId: string, messages: HelperMessage[], meter: Meter, path = '/') {
  const page = parsePage(path)
  const [profile, searches, jobs, people, scouts, shortlist, training, practice, memories, current] = await Promise.all([
    db.query.profile.findFirst({ where: eq(schema.profile.userId, userId), columns: { data: true } }),
    db.query.search.findMany({ where: eq(schema.search.userId, userId), orderBy: desc(schema.search.createdAt), limit: 12 }),
    db.query.job.findMany({ where: eq(schema.job.userId, userId), orderBy: desc(schema.job.updatedAt), limit: 20 }),
    db.query.person.findMany({ where: eq(schema.person.userId, userId), orderBy: desc(schema.person.createdAt), limit: 30 }),
    db.query.scout.findMany({ where: eq(schema.scout.userId, userId), orderBy: desc(schema.scout.createdAt), limit: 5 }),
    db.query.savedCompany.findMany({ where: eq(schema.savedCompany.userId, userId), orderBy: desc(schema.savedCompany.createdAt), limit: 20 }),
    db.query.trainingSession.findMany({ where: eq(schema.trainingSession.userId, userId), orderBy: desc(schema.trainingSession.createdAt), limit: 20 }),
    db.query.practiceAnswer.findMany({ where: eq(schema.practiceAnswer.userId, userId), orderBy: desc(schema.practiceAnswer.createdAt), limit: 12 }),
    loadMemories(db, userId),
    pageContext(db, userId, page),
  ])

  const allowedPaths = new Set<string>(['/', '/jobs', '/board', '/scout', '/profile', '/contacts', '/prepare', '/prepare/interviews', '/prepare/interviews/case', '/prepare/cv'])
  for (const row of searches) allowedPaths.add(`/s/${row.id}`)
  for (const row of jobs) {
    allowedPaths.add(`/jobs/${row.id}`)
    allowedPaths.add(`/jobs/${row.id}/apply`)
    allowedPaths.add(`/jobs/${row.id}/prepare`)
    allowedPaths.add(`/jobs/${row.id}/offer`)
    allowedPaths.add(`/jobs/${row.id}/practice`)
    allowedPaths.add(`/jobs/${row.id}/cv`)
  }
  for (const row of scouts) allowedPaths.add(`/scout/${row.id}`)

  // Rows the assistant may propose changes to: the recent ones plus whatever is open on the page.
  const known: Known = {
    jobs: new Map(jobs.map((j) => [j.id, { label: `${j.role} at ${j.company}`, notes: j.notes }])),
    people: new Map(people.map((p) => [p.id, { label: `${p.name}${p.company ? `, ${p.company}` : ''}`, notes: p.notes }])),
    memories,
  }
  if ('job' in current && current.job) {
    const j = current.job
    known.jobs.set(j.id, { label: `${j.role} at ${j.company}`, notes: j.notes })
    allowedPaths.add(`/jobs/${j.id}`)
  }
  if ('booth' in current && current.booth && current.people) for (const p of current.people) known.people.set(p.id, { label: `${p.name}, ${current.booth.company}`, notes: p.note })

  const context = {
    today: new Date().toISOString().slice(0, 10),
    currentPage: current,
    profile: profileText(profile?.data ?? null),
    memories: MEMORY_KINDS.map((kind) => ({ kind, items: memories.filter((m) => m.kind === kind).map((m) => m.text) })).filter((g) => g.items.length),
    searches: searches.map((s) => ({ path: `/s/${s.id}`, company: s.company, role: s.role, goal: s.goal, status: s.status, people: s.peopleCount, createdAt: s.createdAt.toISOString() })),
    jobs: jobs.map((j) => ({ id: j.id, path: `/jobs/${j.id}`, company: j.company, role: j.role, location: j.location, score: j.score, status: j.status, appliedAt: j.appliedAt?.toISOString() ?? null, nextAt: j.nextAt?.toISOString().slice(0, 10) ?? null, hasTailoredCv: !!j.cv, hasCoverLetter: !!j.coverLetter, hasOfferBrief: !!j.offerBrief, hasPayCheck: !!j.payCheck, note: j.notes })),
    contacts: people.map((p) => ({ id: p.id, company: p.company, name: p.name, title: p.title, score: p.score, status: p.status, contactedAt: p.contactedAt?.toISOString() ?? null, followedUpAt: p.followedUpAt?.toISOString() ?? null, sharedGround: p.sharedGround.map((g) => g.detail), note: p.notes })),
    scouts: scouts.map((s) => ({ path: `/scout/${s.id}`, input: s.input, picks: s.result.picks.slice(0, 8).map((p) => ({ name: p.name, why: p.why, profileFit: p.profileFit })) })),
    shortlist: shortlist.map((s) => ({ name: s.name, why: s.why })),
    training: training.map((t) => ({ path: t.jobId ? `/jobs/${t.jobId}/practice` : '/prepare', mode: t.mode, game: t.gameId, durationSec: t.durationSec, result: t.result, createdAt: t.createdAt.toISOString() })),
    interviewPractice: practice.map((p) => ({ path: `/jobs/${p.jobId}/prepare`, question: p.question, feedback: p.feedback, createdAt: p.createdAt.toISOString() })),
    allowedPaths: [...allowedPaths],
  }

  const conversation = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')
  const result = await generateStructured({
    apiKey: env.OPENROUTER_API_KEY,
    preferredModels: preferredModels(env),
    system: `${HELPER_RULES}

CURRENT WORKSPACE
${JSON.stringify(context)}`,
    // The workspace changes every call; version the prompt by its wording only.
    promptKey: HELPER_RULES,
    user: conversation,
    schemaName: 'job_search_helper_reply',
    schema: schemaJson,
    validate: (raw) => ReplySchema.parse(raw),
    meter,
    deadlineMs: 90_000,
    attemptMs: 45_000,
  })

  return {
    ...result.data,
    actions: result.data.actions.filter((a) => allowedPaths.has(a.href)),
    proposals: parseProposals(result.data.proposals, known),
    model: result.model,
  }
}
