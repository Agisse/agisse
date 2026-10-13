import type { GameId, TrainingMode } from '../../../../shared/assessments'

export const MODE_LABEL: Record<TrainingMode, string> = { practice: 'Practice', simulation: 'Real conditions', drill: 'Daily drill' }
export const MODE_HINT: Record<TrainingMode, string> = {
  practice: 'No clock. You see right or wrong after every answer.',
  simulation: 'Timed like the real test. No feedback until the end, and no pause.',
  drill: 'A few minutes on your weakest skills, getting harder as you improve.',
}
/** games: drill ids or provider game ids from shared/assessment-catalog.ts. */
export const practiceHref = (jobId: string | null, mode: TrainingMode, games?: (GameId | string)[]) =>
  `${jobId ? `/jobs/${jobId}` : ''}/practice?${new URLSearchParams({ mode, ...(games?.length ? { games: games.join(',') } : {}) })}`
