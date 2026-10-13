// Interview practice and offer negotiation, per posting.

export const ANSWER_QUESTION_LIMIT = 500
export const ANSWER_TEXT_LIMIT = 4000

/** Feedback on one practice answer. */
export type AnswerFeedback = {
  /** Which STAR parts the answer covers. */
  star: { situation: boolean; task: boolean; action: boolean; result: boolean }
  strengths: string[]
  gaps: string[]
  /** The same answer, tighter, using only facts from the answer or the profile. */
  tighter: string
  /** Earlier gaps of this user that this answer now covers. Absent on feedback from before gap memory. */
  improved?: string[]
  /** One probing question an interviewer would ask next. Absent on older feedback. */
  followUp?: string
}

/** How a spoken mock-interview answer was delivered; computed in the browser, no model. */
export type AnswerDelivery = { durationSec: number; words: number; wpm: number; fillers: number; retakes: number; startDelaySec: number }

/** One stored practice attempt: the question, the answer as written and the feedback it got. */
export type PracticeAnswer = { id: string; question: string; answer: string; feedback: AnswerFeedback; source: 'text' | 'mock'; delivery: AnswerDelivery | null; createdAt: string }

export const QUESTION_THEMES = ['motivation', 'behavioural', 'situational', 'knowledge'] as const
/** One mock-interview question. Timings come from the company's known format, not from the model. */
export type InterviewQuestion = { text: string; theme: (typeof QUESTION_THEMES)[number]; tip: string }

// ponytail: no "like" or "actually": too often meant literally to count without context.
export const FILLERS = ['um', 'uh', 'erm', 'you know', 'basically', 'sort of', 'kind of', 'i mean']
/** Filler words in a transcript, whole words only. */
export const fillerCount = (text: string) => FILLERS.reduce((n, f) => n + (text.toLowerCase().match(new RegExp(`\\b${f}\\b`, 'g'))?.length ?? 0), 0)

/** Salary range as one search result states it. */
export type SalaryRange = { low: number; high: number; currency: string; basis: string; sourceUrl: string }

export type OfferBrief = {
  /** Null when no search result states a range. */
  range: SalaryRange | null
  levers: { lever: string; why: string }[]
  script: string
  /** Search-result URLs the brief draws on. */
  sources: string[]
}

export const HEALTH_SIGNAL_KINDS = ['funding', 'revenue', 'profit', 'layoffs', 'hiring', 'other'] as const

/** Financial-health read of the employer, every signal tied to a search result. 'unknown' when none survive. */
export type CompanyHealth = {
  verdict: 'healthy' | 'mixed' | 'at-risk' | 'unknown'
  signals: { kind: (typeof HEALTH_SIGNAL_KINDS)[number]; text: string; date: string | null; sourceUrl: string }[]
}

/** Salary expectation plus company health, for any posting before an offer. */
export type PayCheck = {
  range: SalaryRange | null
  /** One line the seeker can say when asked for their expectations; figures only from range. */
  ask: string
  health: CompanyHealth
  sources: string[]
  at: string
}
