// Daily cron: marks saved postings that their public ATS board no longer lists as closed (a ghost-job check, from
// career-ops `--verify`). Only postings not yet applied to, only boards with a public API; anything else is never touched.
import { and, asc, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { schema, type Db } from '../db'
import { postingBoard, postingOpen, type Listing } from '../../shared/listings'

// Free plan: 50 subrequests per invocation. 3 go to the database, so at most 40 boards are fetched per run.
const MAX_BOARDS = 40

export async function checkClosedPostings(db: Db) {
  const rows = await db
    .select({ id: schema.job.id, url: schema.job.url })
    .from(schema.job)
    .where(and(inArray(schema.job.status, ['saved', 'evaluated']), isNull(schema.job.closedAt), isNotNull(schema.job.url), sql`${schema.job.url} ~* '(greenhouse\\.io|lever\\.co|ashbyhq\\.com|recruitee\\.com|workable\\.com|smartrecruiters\\.com|personio\\.)'`))
    .orderBy(sql`${schema.job.openCheckedAt} asc nulls first`, asc(schema.job.createdAt))
    .limit(200)
  const cache = new Map<string, Promise<Listing[] | null>>()
  const boards = new Set<string>()
  const checked: string[] = []
  const closed: string[] = []
  for (const row of rows) {
    const hit = postingBoard(row.url!)
    if (!hit) continue
    const api = hit.board.api(encodeURIComponent(hit.slug))
    if (!boards.has(api) && boards.size >= MAX_BOARDS) continue
    boards.add(api)
    const open = await postingOpen(row.url!, cache)
    if (open === false) closed.push(row.id)
    else checked.push(row.id)
  }
  const now = new Date()
  if (closed.length) await db.update(schema.job).set({ closedAt: now, openCheckedAt: now }).where(inArray(schema.job.id, closed))
  if (checked.length) await db.update(schema.job).set({ openCheckedAt: now }).where(inArray(schema.job.id, checked))
  return { checked: checked.length, closed: closed.length }
}
