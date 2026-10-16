// Output quality, measured from the generation log in `usage` (see charge() in shared.ts).
// Feeds model routing (modelRanking → Meter.rank) and the admin report (npm run quality, GET /api/admin/quality).
import { sql } from 'drizzle-orm'
import type { Db } from '../db'
import type { StatusChange } from '../../shared/types'
import { calibrate, RANK_BUCKETS, scoreRows, SCORE_BUCKETS, type PromptRow, type QualityReport } from '../../shared/quality'

export type ModelStats = { task: string; model: string; answered: number; failed: number; flagged: number; down: number }

/** Minimum calls (answered + failed) before a model's score is trusted over the configured order. */
export const MIN_SAMPLES = 20

/** Score in 0..1 per task and model: share of calls answered, minus the share the verifiers had to correct or the seeker thumbed down. */
export function rankModels(rows: ModelStats[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {}
  for (const r of rows) {
    const calls = r.answered + r.failed
    if (calls < MIN_SAMPLES) continue
    const score = r.answered / calls - (r.answered ? (r.flagged + r.down) / r.answered / 2 : 0)
    ;(out[r.task] ??= {})[r.model] = Math.max(0, Math.min(1, score))
  }
  return out
}

/** Per task and model over the last 30 days: answers (with flags and thumbs-down) and failed attempts. */
export async function modelStats(db: Db): Promise<ModelStats[]> {
  const [answered, failed] = await Promise.all([
    db.execute<{ task: string; model: string; answered: number; flagged: number; down: number }>(sql`
      select task, model, count(*)::int as answered,
        count(*) filter (where flags is not null and flags::text <> '{}')::int as flagged,
        count(*) filter (where rating = -1)::int as down
      from usage where task is not null and model is not null and created_at > now() - interval '30 days'
      group by 1, 2`),
    db.execute<{ task: string; model: string; failed: number }>(sql`
      select task, m as model, count(*)::int as failed
      from usage, jsonb_array_elements_text(failed) as m
      where task is not null and created_at > now() - interval '30 days'
      group by 1, 2`),
  ])
  const key = (r: { task: string; model: string }) => `${r.task}\u0000${r.model}`
  const stats = new Map<string, ModelStats>()
  for (const r of answered.rows) stats.set(key(r), { ...r, failed: 0 })
  for (const r of failed.rows) {
    const s = stats.get(key(r))
    if (s) s.failed = r.failed
    else stats.set(key(r), { task: r.task, model: r.model, answered: 0, failed: r.failed, flagged: 0, down: 0 })
  }
  return [...stats.values()]
}

// ponytail: per-isolate cache; move to KV if isolates churn so much that the query runs on most requests.
let ranking: { at: number; data: Record<string, Record<string, number>> } | null = null
const RANKING_TTL = 60 * 60 * 1000

export async function modelRanking(db: Db) {
  if (ranking && Date.now() - ranking.at < RANKING_TTL) return ranking.data
  try {
    ranking = { at: Date.now(), data: rankModels(await modelStats(db)) }
  } catch (err) {
    // Routing is an optimisation: without it the configured order stands.
    console.warn('[quality] ranking failed', err)
    ranking = { at: Date.now(), data: {} }
  }
  return ranking.data
}

/** The admin quality report over the last `days` days; aggregates plus seekers' own thumbs-down notes, never CV or posting text. */
export async function qualityReport(db: Db, days = 90): Promise<QualityReport> {
  const now = new Date()
  const since = new Date(now.getTime() - days * 86_400_000)
  const [prompts, flags, jobs, people, complaints] = await Promise.all([
    db.execute<Omit<PromptRow, 'flags'>>(sql`
      select u.task, coalesce(u.prompt, '?') as prompt, u.model, count(*)::int as n,
        avg((jsonb_array_length(coalesce(u.failed, '[]'::jsonb)) > 0)::int)::float as failover,
        avg((u.flags is not null and u.flags::text <> '{}')::int)::float as flagged,
        (count(*) filter (where u.rating = 1))::int as up,
        (count(*) filter (where u.rating = -1))::int as down,
        (case when u.task = 'agisse_outreach' then avg(p.outreach_edited::int) when u.task = 'agisse_cover' then avg(j.cover_edited::int) end)::float as edited,
        (case when u.task = 'agisse_outreach' then avg((p.contacted_at is not null)::int) end)::float as contacted
      from usage u
      left join person p on u.task = 'agisse_outreach' and p.id = u.ref_id
      left join job j on u.task = 'agisse_cover' and j.id = u.ref_id
      where u.task is not null and u.model is not null and u.created_at > ${since}
      group by 1, 2, 3
      order by 1, n desc`),
    db.execute<{ task: string; prompt: string; model: string; flag: string; total: number }>(sql`
      select u.task, coalesce(u.prompt, '?') as prompt, u.model, f.key as flag, sum(f.value::int)::int as total
      from usage u, jsonb_each_text(u.flags) as f
      where u.task is not null and u.model is not null and u.created_at > ${since}
      group by 1, 2, 3, 4`),
    // ponytail: one row per scored application; aggregate in SQL if boards grow past tens of thousands.
    // Seekers who turned off "Count my tracker anonymously" (profile.shareOutcomes) never leave the database; scoreRows checks share again.
    db.execute<{ score: number; history: StatusChange[]; appliedAt: Date | null; share: boolean | null }>(sql`
      select j.score, j.history, j.applied_at as "appliedAt", (p.data->>'shareOutcomes')::boolean as share from job j
      left join profile p on p.user_id = j.user_id
      where j.score is not null and coalesce((p.data->>'shareOutcomes')::boolean, true)`),
    db.execute<{ rank: number; status: string | null }>(sql`
      select rank, status from person where search_id is not null and contacted_at < now() - interval '7 days'`),
    db.execute<{ task: string; prompt: string | null; model: string | null; note: string; at: Date }>(sql`
      select task, prompt, model, left(note, 200) as note, created_at as at
      from usage where rating = -1 and note is not null and task is not null
      order by created_at desc limit 20`),
  ])
  const key = (r: { task: string; prompt: string; model: string }) => `${r.task}\u0000${r.prompt}\u0000${r.model}`
  const flagsBy = new Map<string, Record<string, number>>()
  for (const f of flags.rows) flagsBy.set(key(f), { ...flagsBy.get(key(f)), [f.flag]: f.total })
  return {
    since: since.toISOString(),
    prompts: prompts.rows.map((p) => ({ ...p, flags: flagsBy.get(key(p)) ?? {} })),
    scoreCalibration: calibrate(scoreRows(jobs.rows, now), SCORE_BUCKETS),
    rankCalibration: calibrate(people.rows.map((p) => ({ value: p.rank, hit: p.status === 'replied' || p.status === 'call booked' || p.status === 'referred' })), RANK_BUCKETS),
    complaints: complaints.rows.map((c) => ({ ...c, at: new Date(c.at).toISOString() })),
  }
}
