// Assessment prep: which online assessment an application likely faces, and practice versions of its games.
// Agisse recreates each provider's game mechanics for practice; it never uses their branding, assets or copied question banks.

export const COGNITIVE_SKILLS = [
  'numerical-speed',
  'numerical-accuracy',
  'estimation',
  'working-memory',
  'spatial-memory',
  'attention',
  'reaction-time',
  'inhibition',
  'cognitive-flexibility',
  'logical-reasoning',
  'probabilistic-reasoning',
  'emotion-recognition',
  'planning',
  'visual-scanning',
  'verbal-reasoning',
  'situational-judgement',
] as const
export type CognitiveSkill = (typeof COGNITIVE_SKILLS)[number]

export const SKILL_LABEL: Record<CognitiveSkill, string> = {
  'numerical-speed': 'Numerical speed',
  'numerical-accuracy': 'Numerical accuracy',
  estimation: 'Mental estimation',
  'working-memory': 'Working memory',
  'spatial-memory': 'Spatial memory',
  attention: 'Attention',
  'reaction-time': 'Reaction time',
  inhibition: 'Reaction control',
  'cognitive-flexibility': 'Task switching',
  'logical-reasoning': 'Logical reasoning',
  'probabilistic-reasoning': 'Risk & probability',
  'emotion-recognition': 'Reading emotions',
  planning: 'Planning',
  'visual-scanning': 'Visual scanning',
  'verbal-reasoning': 'Verbal reasoning',
  'situational-judgement': 'Situational judgement',
}

export const GAME_IDS = [
  'numerical-speed',
  'working-memory',
  'n-back',
  'go-no-go',
  'task-switching',
  'sequence-reasoning',
  'spatial-memory',
  'risk-reward',
  'attention-tracking',
  'estimation',
  'numerosity',
  'disconumbers',
  'pathfinder',
  'image-puzzle',
  'shape-match',
  'emotions',
  'balloons',
  'cards',
  'easy-hard',
  'keypresses',
  'flanker',
  'lengths',
  'towers',
  'money-exchange',
  'security-dial',
  'predict',
  'team-sales',
  'balance',
  'order',
  'token-search',
  'grid-challenge',
  'switch-challenge',
  'digit-challenge',
  'motion-challenge',
  'gap-challenge',
  'grid-lock',
  'numbubbles',
  'proof-it',
  'tally-up',
  'sea-wolf',
  'redrock',
  'numerical-data',
  'verbal-tfc',
  'sjt',
  'critical-reasoning',
  'diagrammatic',
] as const
export type GameId = (typeof GAME_IDS)[number]

/** The original skill drills. Plans fall back to these; provider games (shared/assessment-catalog.ts) run only when a process names them. */
export const DRILL_IDS: GameId[] = [
  'numerical-speed',
  'working-memory',
  'n-back',
  'go-no-go',
  'task-switching',
  'sequence-reasoning',
  'spatial-memory',
  'risk-reward',
  'attention-tracking',
  'estimation',
  'numerical-data',
  'verbal-tfc',
  'critical-reasoning',
  'diagrammatic',
  'sjt',
]

/**
 * Reference distribution of Agisse's 0–100 score per game, used only until BENCHMARK_MIN_USERS real users exist: a normal curve
 * centred where a first-time practiser lands by the scoring rule (about 60% accuracy at level 3–4 → ~50) with SD 15.
 * Not a norm and not an employer's distribution; always shown as "vs. reference (estimated)".
 */
export const REFERENCE_SCORE: { mean: number; sd: number } = { mean: 50, sd: 15 }

/** Percentile of a score under REFERENCE_SCORE, 1–99. Abramowitz–Stegun erf approximation (error < 1.5e-7). */
export function referencePercentile(score: number): number {
  const z = (score - REFERENCE_SCORE.mean) / (REFERENCE_SCORE.sd * Math.SQRT2)
  const t = 1 / (1 + 0.3275911 * Math.abs(z))
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z)
  const cdf = 0.5 * (1 + Math.sign(z) * erf)
  return Math.min(99, Math.max(1, Math.round(cdf * 100)))
}

/** Which drill trains each skill, first choice first. Plans and daily drills pick games through this. */
export const SKILL_GAMES: Record<CognitiveSkill, GameId[]> = {
  'numerical-speed': ['numerical-speed', 'numerosity', 'numbubbles', 'tally-up'],
  'numerical-accuracy': ['numerical-speed', 'estimation', 'numerical-data', 'digit-challenge', 'redrock'],
  estimation: ['estimation'],
  'working-memory': ['working-memory', 'n-back', 'disconumbers', 'grid-challenge', 'token-search'],
  'spatial-memory': ['spatial-memory', 'image-puzzle', 'grid-challenge'],
  attention: ['attention-tracking', 'go-no-go', 'flanker', 'proof-it'],
  'reaction-time': ['go-no-go', 'keypresses', 'security-dial'],
  inhibition: ['go-no-go', 'flanker'],
  'cognitive-flexibility': ['task-switching', 'flanker'],
  'logical-reasoning': ['sequence-reasoning', 'critical-reasoning', 'diagrammatic', 'switch-challenge', 'gap-challenge', 'order', 'balance', 'sea-wolf'],
  'probabilistic-reasoning': ['risk-reward', 'balloons', 'cards', 'predict', 'lengths', 'easy-hard', 'team-sales', 'money-exchange'],
  'emotion-recognition': ['emotions'],
  planning: ['towers', 'pathfinder', 'motion-challenge', 'grid-lock'],
  'visual-scanning': ['shape-match', 'proof-it'],
  'verbal-reasoning': ['verbal-tfc', 'critical-reasoning'],
  'situational-judgement': ['sjt'],
}

export const TRAINING_MODES = ['practice', 'simulation', 'drill'] as const
/** practice: untimed, feedback after every answer. simulation: fixed time, no pause, feedback only at the end, mixed difficulty. drill: 5–10 min on the weakest skills. */
export type TrainingMode = (typeof TRAINING_MODES)[number]

export const ASSESSMENT_TYPES = ['game-based', 'numerical', 'logical', 'verbal', 'situational judgement', 'personality', 'video interview', 'mental arithmetic', 'coding'] as const
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number]

export const CONFIDENCES = ['high', 'medium', 'low'] as const
export type Confidence = (typeof CONFIDENCES)[number]

export type AssessmentSource = { url: string; title: string; kind: 'official' | 'provider' | 'university' | 'candidate report' | 'forum' }

export type SkillWeight = { skill: CognitiveSkill; weight: number }

/** One known recruitment process. Rows are shared across users; the most specific match (role, location) wins. */
export type CompanyAssessment = {
  id: string
  company: string
  /** Case-insensitive substring of the role title, e.g. "graduate" or "trading"; null = any role. */
  rolePattern: string | null
  location: string | null
  /** A PROVIDERS id, a free-text provider name, or null when unknown. */
  provider: string | null
  assessmentTypes: AssessmentType[]
  /** The Agisse drills that train what the process tests; empty when there is nothing game-like to practise. */
  gameTypes: GameId[]
  /** Training allocation. Sums to 1; empty when unknown. */
  skills: SkillWeight[]
  /** True when the weights are an estimate rather than taken from a source. */
  weightsEstimated: boolean
  stages: string[]
  difficulty: string | null
  timeLimits: string | null
  scoringDimensions: string[]
  sources: AssessmentSource[]
  /** ISO date the sources were last checked. */
  sourceDate: string
  confidence: Confidence
  origin: 'research' | 'user report' | 'curated'
  notes: string | null
  /** One-way video interview format when known (curated rows only). */
  interview?: { prepSec: number; answerSec: number; retakes: number; questions: number } | null
}

// 'test reported' is the one-tap "Which test?" answer (shared/test-reports.ts), not a correction filed in the form.
export const REPORT_KINDS = ['assessment changed', 'test no longer used', 'new game encountered', 'provider changed', 'test reported'] as const
export type ReportKind = (typeof REPORT_KINDS)[number]
export type AssessmentReport = { id: string; company: string; kind: ReportKind; detail: string | null; createdAt: string }

/** What one finished game produced. Scores are Agisse-internal 0–100 and never map to an employer's score. */
export type GameResult = {
  score: number
  accuracy: number
  /** ms */
  medianResponseTime: number
  difficultyReached: number
  errors: number
  trials: number
  /** Skill → 0–100 for the skills this game trains. */
  skillMetrics: Partial<Record<CognitiveSkill, number>>
  /** Game-specific raw measures, e.g. switchCostMs, falsePositives, misses, lowVarianceRate. */
  details: Record<string, number>
}

export type TrainingSession = {
  id: string
  jobId: string | null
  mode: TrainingMode
  gameId: GameId
  /** The publisher's version played (PROVIDER_GAMES id); null for Agisse's own drill. */
  providerGameId: string | null
  durationSec: number
  result: GameResult
  createdAt: string
}

/** Percentile among Agisse users, only when enough real users trained that skill. Never invented. */
export type SkillBenchmark = { skill: CognitiveSkill; users: number; percentile: number | null }

/** Minimum distinct users before a percentile is shown. */
export const BENCHMARK_MIN_USERS = 30

/**
 * What each provider's public material says it measures, mapped onto Agisse skills. Coarse and marked estimated:
 * processes vary by employer, country and year, so a company row with sources always wins over this.
 */
export type ProviderProfile = { id: string; name: string; url: string; assessmentTypes: AssessmentType[]; skills: SkillWeight[]; note: string }

export const PROVIDERS: ProviderProfile[] = [
  {
    id: 'arctic-shores',
    name: 'Arctic Shores',
    url: 'https://www.arcticshores.com',
    assessmentTypes: ['game-based'],
    skills: [
      { skill: 'working-memory', weight: 0.25 },
      { skill: 'attention', weight: 0.2 },
      { skill: 'cognitive-flexibility', weight: 0.2 },
      { skill: 'inhibition', weight: 0.15 },
      { skill: 'probabilistic-reasoning', weight: 0.2 },
    ],
    note: 'Task-based behavioural assessment; there are no right answers to learn, so practise staying calm and consistent.',
  },
  {
    id: 'pymetrics',
    name: 'Pymetrics (Harver)',
    url: 'https://www.harver.com',
    assessmentTypes: ['game-based'],
    skills: [
      { skill: 'attention', weight: 0.2 },
      { skill: 'working-memory', weight: 0.2 },
      { skill: 'cognitive-flexibility', weight: 0.2 },
      { skill: 'probabilistic-reasoning', weight: 0.15 },
      { skill: 'inhibition', weight: 0.15 },
      { skill: 'numerical-speed', weight: 0.1 },
    ],
    note: 'Short behavioural games measuring traits rather than right answers.',
  },
  {
    id: 'aon',
    name: 'Aon (cut-e)',
    url: 'https://assessment.aon.com',
    assessmentTypes: ['numerical', 'logical', 'verbal', 'game-based'],
    skills: [
      { skill: 'numerical-accuracy', weight: 0.25 },
      { skill: 'logical-reasoning', weight: 0.25 },
      { skill: 'cognitive-flexibility', weight: 0.2 },
      { skill: 'working-memory', weight: 0.15 },
      { skill: 'numerical-speed', weight: 0.15 },
    ],
    note: 'Short timed ability scales; some employers add gamified versions.',
  },
  {
    id: 'shl',
    name: 'SHL',
    url: 'https://www.shl.com',
    assessmentTypes: ['numerical', 'logical', 'verbal', 'personality'],
    skills: [
      { skill: 'numerical-accuracy', weight: 0.35 },
      { skill: 'logical-reasoning', weight: 0.35 },
      { skill: 'numerical-speed', weight: 0.15 },
      { skill: 'working-memory', weight: 0.15 },
      { skill: 'verbal-reasoning', weight: 0.25 },
    ],
    note: 'Timed numerical, verbal, deductive and inductive reasoning; personality questionnaires have no answers to train.',
  },
  {
    id: 'hirevue',
    name: 'HireVue',
    url: 'https://www.hirevue.com',
    assessmentTypes: ['video interview', 'game-based'],
    skills: [
      { skill: 'working-memory', weight: 0.3 },
      { skill: 'logical-reasoning', weight: 0.3 },
      { skill: 'numerical-speed', weight: 0.2 },
      { skill: 'attention', weight: 0.2 },
    ],
    note: 'Mostly recorded video interviews; some employers add short games.',
  },
  {
    id: 'cappfinity',
    name: 'Cappfinity',
    url: 'https://www.cappfinity.com',
    assessmentTypes: ['numerical', 'verbal', 'situational judgement'],
    skills: [
      { skill: 'numerical-accuracy', weight: 0.3 },
      { skill: 'verbal-reasoning', weight: 0.25 },
      { skill: 'situational-judgement', weight: 0.25 },
      { skill: 'logical-reasoning', weight: 0.2 },
    ],
    note: 'Strengths-based situational questions plus numerical and verbal items.',
  },
  {
    id: 'sova',
    name: 'Sova',
    url: 'https://www.sovaassessment.com',
    assessmentTypes: ['numerical', 'logical', 'verbal', 'situational judgement', 'personality'],
    skills: [
      { skill: 'numerical-accuracy', weight: 0.3 },
      { skill: 'logical-reasoning', weight: 0.25 },
      { skill: 'verbal-reasoning', weight: 0.25 },
      { skill: 'situational-judgement', weight: 0.2 },
    ],
    note: 'One combined assessment mixing ability, situational and personality items.',
  },

  {
    id: 'criteria',
    name: 'Criteria (Cognify, Emotify)',
    url: 'https://www.criteriacorp.com',
    assessmentTypes: ['game-based'],
    skills: [
      { skill: 'planning', weight: 0.25 },
      { skill: 'numerical-speed', weight: 0.2 },
      { skill: 'attention', weight: 0.2 },
      { skill: 'spatial-memory', weight: 0.15 },
      { skill: 'working-memory', weight: 0.2 },
    ],
    note: 'Six short timed puzzles (Cognify); Emotify adds emotion-reading games.',
  },
  {
    id: 'mckinsey-solve',
    name: 'McKinsey Solve',
    url: 'https://www.mckinsey.com/careers/interviewing',
    assessmentTypes: ['game-based'],
    skills: [
      { skill: 'logical-reasoning', weight: 0.4 },
      { skill: 'numerical-accuracy', weight: 0.4 },
      { skill: 'planning', weight: 0.2 },
    ],
    note: 'Scenario simulations scored on outcome and on how you got there.',
  },
]

export function providerProfile(provider: string | null): ProviderProfile | null {
  if (!provider) return null
  const p = provider.toLowerCase()
  return PROVIDERS.find((x) => x.id === p || p.includes(x.id.replace('-', ' ')) || x.name.toLowerCase().startsWith(p)) ?? null
}
