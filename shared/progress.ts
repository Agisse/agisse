// One progress picture across games, interview answers and CV reviews. Pure: the profile page feeds it the user's history.
import type { PracticeAnswer } from './interview'

export type CvLogEntry = { score: number; failed: string[]; at: string }
export type ProgressData = { answers: (PracticeAnswer & { jobId: string })[]; cvLog: CvLogEntry[] }
export type NextStep = { area: 'games' | 'answers' | 'cv'; text: string; href: string }

/** Plain names for CV review check ids; unknown ids fall back to the id. */
export const CV_CHECK_LABEL: Record<string, string> = {
  quantified: 'results with numbers',
  'weak-verbs': 'strong opening verbs',
  duties: 'achievements, not duties',
  repetition: 'varied verbs',
  tense: 'verb tense',
  length: 'length',
  'bullet-length': 'bullet length',
  filler: 'filler words',
  bullets: 'bullet points',
  buzzwords: 'buzzwords',
  pronouns: 'personal pronouns',
  passive: 'active voice',
  dates: 'dates',
  contact: 'contact details',
  sections: 'standard sections',
  unnecessary: 'unnecessary details',
  summary: 'summary length',
  'badge-skills': 'skills from your profile',
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
const byTime = <T extends { createdAt: string }>(a: T, b: T) => a.createdAt.localeCompare(b.createdAt)

/** Share of the four STAR parts an answer covers, 0–100. */
export const starScore = (a: PracticeAnswer) => (Object.values(a.feedback.star).filter(Boolean).length / 4) * 100

// ponytail: keyword buckets for gap themes; an unmatched gap counts as "other". Add a bucket when "other" dominates.
const GAP_THEMES: { theme: string; re: RegExp }[] = [
  { theme: 'No measurable result', re: /result|outcome|impact|number|quantif|metric|measur/i },
  { theme: 'Unclear what you personally did', re: /your (own )?(role|part|contribution|action)|personal|\bI\b|you did/i },
  { theme: 'Not tied to this company or role', re: /company|firm|role|division|why|motivat|link|connect/i },
  { theme: 'Missing context', re: /context|situation|background|set(ting)? the scene/i },
  { theme: 'Too general', re: /specific|example|concrete|vague|generic|detail/i },
  { theme: 'Too long or unfocused', re: /long|concise|focus|ramble|shorter|structure/i },
]
const themeOf = (gap: string) => GAP_THEMES.find((t) => t.re.test(gap))?.theme ?? 'Other'

/** The gap themes flagged most often on the last `n` answers, most frequent first. */
export function recurringGaps(answers: PracticeAnswer[], n = 10): { theme: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const a of [...answers].sort(byTime).slice(-n)) for (const t of new Set(a.feedback.gaps.map(themeOf))) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts]
    .filter(([t, c]) => t !== 'Other' && c >= 2)
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count)
}

export function answerStats(answers: PracticeAnswer[]) {
  const sorted = [...answers].sort(byTime)
  const mock = sorted.filter((a) => a.delivery)
  return {
    count: sorted.length,
    /** STAR coverage per answer, oldest first. */
    trend: sorted.map(starScore).map(Math.round),
    star: sorted.length ? Math.round(avg(sorted.slice(-5).map(starScore))) : null,
    wpm: mock.length ? Math.round(avg(mock.slice(-5).map((a) => a.delivery!.wpm))) : null,
    fillersPerMin: mock.length ? Math.round(avg(mock.slice(-5).map((a) => (a.delivery!.fillers / Math.max(a.delivery!.durationSec, 1)) * 60)) * 10) / 10 : null,
    improved: sorted.reduce((n, a) => n + (a.feedback.improved?.length ?? 0), 0),
    gaps: recurringGaps(sorted),
  }
}

/** CV checks failed on each of the last `runs` reviews (needs that many reviews). */
export function persistentCvFails(log: CvLogEntry[], runs = 2): string[] {
  const last = [...log].sort((a, b) => a.at.localeCompare(b.at)).slice(-runs)
  if (last.length < runs) return []
  return last[0]!.failed.filter((id) => last.every((r) => r.failed.includes(id)))
}

/**
 * The three most useful things to do next, weakest first: an untrained or weak skill, a recurring answer gap,
 * a CV check that keeps failing. weakSkill is the lowest-scoring trained skill (0–100), if any.
 */
export function nextSteps(input: { weakSkill: { label: string; value: number; href: string } | null; answers: PracticeAnswer[]; cvLog: CvLogEntry[]; lastJobId: string | null }): NextStep[] {
  const steps: (NextStep & { urgency: number })[] = []
  const { weakSkill, answers, cvLog, lastJobId } = input
  if (weakSkill) steps.push({ area: 'games', text: `Drill ${weakSkill.label.toLowerCase()}: your weakest skill at ${weakSkill.value}/100.`, href: weakSkill.href, urgency: 100 - weakSkill.value })
  const gap = recurringGaps(answers)[0]
  const answersHref = lastJobId ? `/jobs/${lastJobId}/prepare` : '/jobs'
  if (gap) steps.push({ area: 'answers', text: `${gap.theme} came up in ${gap.count} of your recent answers. Practise one more with that in mind.`, href: answersHref, urgency: 40 + gap.count * 8 })
  else if (!answers.length) steps.push({ area: 'answers', text: 'Answer one practice interview question to get a baseline.', href: answersHref, urgency: 45 })
  const sortedCv = [...cvLog].sort((a, b) => a.at.localeCompare(b.at))
  const stuck = persistentCvFails(sortedCv)
  if (stuck.length) steps.push({ area: 'cv', text: `Your CV keeps failing on ${stuck.slice(0, 2).map((id) => CV_CHECK_LABEL[id] ?? id).join(' and ')}.`, href: '/prepare/cv', urgency: 50 + stuck.length * 5 })
  else if (!cvLog.length) steps.push({ area: 'cv', text: 'Run a CV review to get a score to improve on.', href: '/prepare/cv', urgency: 55 })
  else if (sortedCv.at(-1)!.score < 80) steps.push({ area: 'cv', text: `CV score ${sortedCv.at(-1)!.score}: fix the failing checks to pass 80.`, href: '/prepare/cv', urgency: 80 - sortedCv.at(-1)!.score + 30 })
  return steps
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, 3)
    .map(({ urgency: _, ...s }) => s)
}
