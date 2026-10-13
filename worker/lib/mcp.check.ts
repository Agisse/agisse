// Run: npx tsx worker/lib/mcp.check.ts
import { z } from 'zod'
import { drizzle } from 'drizzle-orm/pg-proxy'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import * as schema from '../db/schema'
import { AddJobInput, AddToShortlistInput, DraftOutreachInput, GetBoardItemInput, GetContactInput, GetSeekerBriefInput, ListBoardInput, ListContactedInput, ListSearchesInput, ListVacanciesInput, UpdateContactStatusInput, UpdateJobStatusInput, buildMcpServer, errorText, structured, text } from './mcp'
import { finalizeEvaluation } from './jobs'
import { decodeCursor, encodeCursor } from './shared'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}
const ok = (cond: boolean, what: string) => {
  if (!cond) throw new Error(`expected ${what}`)
}

eq(text('hi'), { content: [{ type: 'text', text: 'hi' }] }, 'text(string)')
eq(text({ id: 1 }), { content: [{ type: 'text', text: '{"id":1}' }] }, 'text(object) is JSON-stringified')
eq(structured({ a: 1 }), { content: [{ type: 'text', text: '{"a":1}' }], structuredContent: { a: 1 } }, 'structured carries both')
eq(errorText('nope'), { content: [{ type: 'text', text: 'nope' }], isError: true }, 'errorText carries isError')

const updateSchema = z.object(UpdateContactStatusInput)
ok(updateSchema.safeParse({ personId: 'p1' }).success, 'update_contact_status: personId alone is enough')
ok(updateSchema.safeParse({ personId: 'p1', status: 'replied', followedUp: true }).success, 'update_contact_status: valid status + followedUp')
ok(!updateSchema.safeParse({ personId: 'p1', status: 'ghosted' }).success, 'update_contact_status: rejects an unknown status')
ok(!updateSchema.safeParse({ status: 'replied' }).success, 'update_contact_status: personId is required')
ok(updateSchema.safeParse({ personId: 'p1', status: 'replied', expectedStatus: 'contacted' }).success, 'update_contact_status: valid expectedStatus')
ok(!updateSchema.safeParse({ personId: 'p1', expectedStatus: 'ghosted' }).success, 'update_contact_status: rejects an unknown expectedStatus')

ok(z.object(GetContactInput).safeParse({ personId: 'p1' }).success, 'get_contact: personId')
ok(!z.object(GetContactInput).safeParse({}).success, 'get_contact: personId is required')
ok(!z.object(GetBoardItemInput).safeParse({}).success, 'get_board_item: jobId is required')

const draftSchema = z.object(DraftOutreachInput)
ok(draftSchema.safeParse({ personId: 'p1' }).success, 'draft_outreach: personId alone is enough')
ok(draftSchema.safeParse({ personId: 'p1', rewrite: true, lang: 'nl' }).success, 'draft_outreach: valid rewrite + lang')
ok(!draftSchema.safeParse({ personId: 'p1', lang: 'xx' }).success, 'draft_outreach: rejects an unsupported language')

// Bring-your-own-model tools: inputs validated here, the evaluation shape end to end below.
const evaluation = {
  role: { title: 'PM', company: 'Acme', seniority: 'junior', remote: 'hybrid', location: 'Ghent', tldr: 'Runs the roadmap.', domain: 'acme.com' },
  workAuth: 'unstated',
  requirements: [{ requirement: 'SQL', importance: 'critical', evidenceTier: 'inferred', jdQuote: null, match: 'partial', cvEvidence: 'One course', mitigation: 'Show the project' }],
  dimensions: { cvMatch: 3, northStar: 4, comp: 3, culture: 3, redFlags: 5 },
  score: 3.72,
  comp: { advertisedVerbatim: null, reliability: 'unknown' },
  legitimacy: { tier: 'high_confidence', signals: [{ signal: 'Specific tools', finding: 'Names the stack', weight: 'positive' }] },
  cvChanges: ['Lead with SQL'],
  keywords: ['SQL', 'roadmap'],
}
const jdText = 'x'.repeat(200)
const addJob = z.object(AddJobInput)
ok(addJob.safeParse({ jdText, evaluation }).success, 'add_job: text + evaluation')
ok(addJob.safeParse({ jdText, url: 'https://acme.com/jobs/1', evaluation }).success, 'add_job: with url')
ok(!addJob.safeParse({ jdText: 'short', evaluation }).success, 'add_job: rejects a short posting')
ok(!addJob.safeParse({ jdText }).success, 'add_job: evaluation is required')
ok(!addJob.safeParse({ jdText, evaluation: { ...evaluation, score: 'high' } }).success, 'add_job: rejects a malformed evaluation')
ok(!addJob.safeParse({ jdText, url: 'not a link', evaluation }).success, 'add_job: rejects a bad url')
const fin = finalizeEvaluation(addJob.parse({ jdText, evaluation }).evaluation)
eq([fin.score, fin.recommendation, fin.requirements[0]!.importance, fin.hardStops], [3.7, 'do_not_apply', 'meaningful', []], 'add_job: finalizeEvaluation rounds, recommends, demotes an inferred critical')
ok(z.object(GetSeekerBriefInput).safeParse({}).success && z.object(GetSeekerBriefInput).safeParse({ jdText }).success, 'get_seeker_brief: jdText optional')
eq(z.object(AddToShortlistInput).parse({ name: ' Acme ' }), { name: 'Acme', domain: null, why: null }, 'add_to_shortlist: name alone, trimmed, nulls defaulted')
ok(!z.object(AddToShortlistInput).safeParse({ domain: 'acme.com' }).success, 'add_to_shortlist: name is required')

const jobStatus = z.object(UpdateJobStatusInput)
ok(jobStatus.safeParse({ jobId: 'j1', status: 'applied' }).success, 'update_job_status: jobId + status')
ok(jobStatus.safeParse({ jobId: 'j1', status: 'interview', expectedStatus: 'applied' }).success, 'update_job_status: valid expectedStatus')
ok(!jobStatus.safeParse({ jobId: 'j1' }).success, 'update_job_status: status is required')
ok(!jobStatus.safeParse({ jobId: 'j1', status: 'replied' }).success, 'update_job_status: rejects a reply status')
const vac = z.object(ListVacanciesInput)
eq(vac.parse({}), { sort: 'match' }, 'list_vacancies: no filters falls back to saved ones')
ok(vac.safeParse({ countries: ['be'], level: 'internship', languages: ['dutch'], remoteOnly: true, deadlineWithin: 14, sort: 'deadline', cursor: '30' }).success, 'list_vacancies: all filters')
ok(!vac.safeParse({ level: 'senior' }).success && !vac.safeParse({ languages: ['klingon'] }).success, 'list_vacancies: bad level/language rejected')

// Pagination cursor: base64url JSON of (Postgres timestamp text, id); garbage decodes to null.
const cur = ['2026-09-27 10:00:00.123456', 'id/+?'] as [string, string]
eq(decodeCursor(encodeCursor(cur)), cur, 'cursor roundtrip')
ok(/^[\w-]+$/.test(encodeCursor(cur)), 'cursor is base64url')
eq(decodeCursor('nope!'), null, 'garbage cursor')
eq(decodeCursor(encodeCursor(['yesterday', 'x'])), null, 'cursor with a non-timestamp sort key')

for (const [name, shape] of Object.entries({ list_board: ListBoardInput, list_searches: ListSearchesInput, list_contacted: ListContactedInput })) {
  const s = z.object(shape)
  eq(s.parse({}).limit, 50, `${name}: default limit`)
  ok(s.safeParse({ limit: 100, cursor: 'abc', company: 'acme', since: '2026-01-01', until: '2026-09-01T12:00:00Z' }).success, `${name}: all filters`)
  ok(!s.safeParse({ limit: 0 }).success && !s.safeParse({ limit: 101 }).success && !s.safeParse({ limit: 1.5 }).success, `${name}: bad limit rejected`)
  ok(!s.safeParse({ since: 'last week' }).success, `${name}: non-ISO since rejected`)
}
ok(z.object(ListBoardInput).safeParse({ status: 'interview' }).success, 'list_board: job status')
ok(!z.object(ListBoardInput).safeParse({ status: 'replied' }).success, 'list_board: rejects a reply status')
ok(z.object(ListContactedInput).safeParse({ status: 'replied' }).success, 'list_contacted: reply status')
ok(!z.object(ListContactedInput).safeParse({ status: 'interview' }).success, 'list_contacted: rejects a job status')

// Every tool carries annotations with readOnlyHint as intended. Handlers never run, so stub db/env are fine.
const server = buildMcpServer({} as any, {} as any, 'u1', false) as unknown as {
  _registeredTools: Record<string, { annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean }; _meta?: Record<string, unknown> }>
}
const tools = server._registeredTools
const writers = ['draft_outreach', 'update_contact_status', 'add_job', 'add_to_shortlist', 'update_job_status']
eq(Object.keys(tools).length, 18, 'registered tool count')
for (const [name, tool] of Object.entries(tools)) {
  eq(tool.annotations?.readOnlyHint, !writers.includes(name), `${name} readOnlyHint`)
}
eq(tools.draft_outreach.annotations?.destructiveHint, true, 'draft_outreach destructiveHint (rewrite discards the old draft)')
eq(tools.update_contact_status.annotations?.destructiveHint, false, 'update_contact_status destructiveHint')
for (const name of ['add_job', 'add_to_shortlist', 'update_job_status']) eq(tools[name]!.annotations?.destructiveHint, false, `${name} destructiveHint`)
for (const [name, tool] of Object.entries(tools)) ok(!!(tool as { outputSchema?: unknown }).outputSchema, `${name} outputSchema`)
eq(tools.get_profile._meta, { 'openai/profile': true }, 'get_profile _meta')

// End to end through the SDK (input parsing, JSON Schema listing, outputSchema validation) on a fake database:
// every select returns `rows` (positional, as pg-proxy expects), every count returns 7.
let rows: unknown[][] = []
const fakeDb = drizzle(async (sql) => ({ rows: sql.startsWith('select count') ? [{ count: 7 }] : rows }), { schema, casing: 'snake_case' })
const client = new Client({ name: 'check', version: '0' })
const [a, b] = InMemoryTransport.createLinkedPair()
await buildMcpServer(fakeDb as any, {} as any, 'u1', false).connect(a)
await client.connect(b)
const listed = await client.listTools()
ok(listed.tools.every((t) => t.outputSchema?.type === 'object'), 'every listed tool has an object outputSchema')
// Objects that carry more fields than their schema names must not forbid extra properties.
for (const name of ['get_search', 'get_contact']) ok(listed.tools.find((t) => t.name === name)?.outputSchema?.additionalProperties !== false, `${name} allows extra fields`)

const ts = '2026-09-01 10:00:00.123456'
const job = (id: string) => [id, 'Acme', 'acme.com', 'PM', null, null, 80, 'applied', null, null, '[]', null, ts, id, ts]
rows = [job('j3'), job('j2'), job('j1')]
const page = await client.callTool({ name: 'list_board', arguments: { limit: 2, status: 'applied' } })
ok(!page.isError, `list_board ok: ${JSON.stringify(page.content)}`)
const sc = page.structuredContent as { items: { id: string; recommendation: string }[]; nextCursor: string | null; total: number }
eq([sc.items.map((i) => i.id), sc.total, decodeCursor(sc.nextCursor!)], [['j3', 'j2'], 7, [ts, 'j2']], 'list_board page + cursor')
rows = [job('j1')]
eq((await client.callTool({ name: 'list_board', arguments: { cursor: sc.nextCursor } })).structuredContent, { items: [{ ...sc.items[0], id: 'j1' }], nextCursor: null, total: 7 }, 'list_board last page')
const bad = await client.callTool({ name: 'list_board', arguments: { cursor: 'garbage' } })
ok(!!bad.isError, 'bad cursor is a tool error')
const badLimit = await client.callTool({ name: 'list_contacted', arguments: { limit: 500 } })
ok(!!badLimit.isError, 'limit 500 is rejected by the SDK')
rows = []
eq((await client.callTool({ name: 'list_due_followups', arguments: {} })).structuredContent, { items: [] }, 'list_due_followups wraps the array')

// add_job through the SDK: the evaluation schema survives JSON Schema conversion, and a posting already on the board writes nothing.
// Every job column in table order: id, userId, postingId, company, role, url, location, jdText, evaluation, score, status, cv, coverLetter, coverEdited, offerBrief, payCheck, notes, appliedAt, nextAt, history, offer, closedAt, openCheckedAt, createdAt, updatedAt.
rows = [['j1', 'u1', null, 'Acme', 'PM', 'https://acme.com/jobs/1', 'Ghent', jdText, fin, 3.7, 'evaluated', null, null, false, null, null, null, null, null, [], null, null, null, ts, ts]]
const dup = await client.callTool({ name: 'add_job', arguments: { jdText, url: 'https://acme.com/jobs/1', evaluation } })
ok(!dup.isError, `add_job ok: ${JSON.stringify(dup.content)}`)
eq([(dup.structuredContent as { existing: boolean; job: { id: string } }).existing, (dup.structuredContent as { job: { id: string } }).job.id], [true, 'j1'], 'add_job returns the existing job')
ok(!!(await client.callTool({ name: 'add_job', arguments: { jdText, evaluation: { role: {} } } })).isError, 'add_job rejects a malformed evaluation at the SDK')


// update_job_status: expectedStatus guards the write; the fake db returns the same job row for the read.
const wrong = await client.callTool({ name: 'update_job_status', arguments: { jobId: 'j1', status: 'applied', expectedStatus: 'interview' } })
ok(!!wrong.isError && JSON.stringify(wrong.content).includes('Nothing was changed'), 'update_job_status: expectedStatus mismatch writes nothing')
const moved = await client.callTool({ name: 'update_job_status', arguments: { jobId: 'j1', status: 'evaluated', expectedStatus: 'evaluated' } })
ok(!moved.isError, `update_job_status ok: ${JSON.stringify(moved.content)}`)
eq((moved.structuredContent as { before: { id: string } }).before.id, 'j1', 'update_job_status returns before')

// list_shortlist: id, userId, companyKey, name, domain, why, createdAt.
rows = [['c1', 'u1', 'acme', 'Acme', 'acme.com', 'Dream list', ts]]
const short = await client.callTool({ name: 'list_shortlist', arguments: {} })
ok(!short.isError, `list_shortlist ok: ${JSON.stringify(short.content)}`)
eq((short.structuredContent as { items: { name: string }[] }).items.map((c) => c.name), ['Acme'], 'list_shortlist items')
ok(!!(await client.callTool({ name: 'list_vacancies', arguments: { cursor: 'x' } })).isError, 'list_vacancies: bad cursor is a tool error')

console.log('mcp.check.ts OK')
