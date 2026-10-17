// Types shared by the Worker API and the React client.

import type { OfferBrief, PayCheck } from './interview'
import { EMPTY_FEED_PREFS, type FeedPrefs } from './listings'
import { EMPTY_ANSWERS, type Answers } from './answer-bank'

export const GOALS = ['referral', 'role advice', 'recruiter insight'] as const
export type Goal = (typeof GOALS)[number]

export type Profile = {
  headline: string
  university: string
  degree: string
  gradYear: string
  employers: string[]
  internships: string[]
  organizations: string[]
  interests: string[]
  targetIndustries: string[]
  /** Tools, languages, methods — matched against candidate text as shared ground. */
  skills: string[]
  /** A few dense sentences on experience and projects, usually lifted from a résumé; context for ranking and the note. */
  background: string
  /** Languages the seeker speaks, as SPOKEN_LANGUAGES keys; the feed moves roles asking for others down. */
  languages: string[]
  /** Premium accounts get 300 characters per connection note, free ones 200. */
  linkedinPremium: boolean
  /** Smart = paid models within a price cap, only on the seeker's own OpenRouter key; Agisse's key uses OPENROUTER_MODELS (Mistral Small 4, then free models). */
  smartModel: boolean
  /** Tracker status changes may count, anonymised and only with 10+ others, towards response figures other users see. */
  shareOutcomes: boolean
  /** Dealbreakers for the "For you" job feed, saved each time the seeker runs it. */
  jobFeed: FeedPrefs
  /** Standard answers to application-form fields (notice, salary…), shown by the extension to copy. */
  answers: Answers
}

export const EMPTY_PROFILE: Profile = {
  headline: '',
  university: '',
  degree: '',
  gradYear: '',
  employers: [],
  internships: [],
  organizations: [],
  interests: [],
  targetIndustries: [],
  skills: [],
  background: '',
  languages: [],
  linkedinPremium: false,
  smartModel: true,
  shareOutcomes: true,
  jobFeed: EMPTY_FEED_PREFS,
  answers: EMPTY_ANSWERS,
}

export type SharedGround = {
  kind: 'university' | 'employer' | 'internship' | 'organization' | 'interest' | 'industry' | 'skill' | 'location' | 'other'
  detail: string
}

export const CONTACT_VALUES = ['referral', 'advice', 'recruiter', 'peer', 'hiring manager'] as const
export type ContactValue = (typeof CONTACT_VALUES)[number]

export const CONTACT_VALUE_LABEL: Record<ContactValue, string> = {
  referral: 'Referral',
  advice: 'Role advice',
  recruiter: 'Recruiter',
  peer: 'Peer',
  'hiring manager': 'Hiring manager',
}

/** "https://www.Google.com/en" → "google.com"; null when it is not a plausible domain. */
export function normalizeDomain(input: string): string | null {
  const raw = input.trim().toLowerCase()
  if (!raw) return null
  try {
    const host = new URL(/^[a-z]+:\/\//.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./, '')
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null
  } catch {
    return null
  }
}

/** Languages a note can be drafted in; per rewrite, never stored. */
/** Short emails drafted on demand: application follow-up, post-interview thank-you, first networking email. */
export const EMAIL_KINDS = ['followup', 'thankyou', 'intro'] as const
export type EmailKind = (typeof EMAIL_KINDS)[number]
export type DraftedEmail = { subject: string; body: string }

/** Outputs the seeker can rate with a thumb, by their task name in the generation log (usage.task). */
export const RATED_TASKS = ['agisse_job_evaluation', 'agisse_cv', 'agisse_cover', 'agisse_outreach', 'agisse_bullet'] as const
export type RatedTask = (typeof RATED_TASKS)[number]

export const NOTE_LANGUAGES = ['en', 'nl', 'fr', 'de'] as const
export type NoteLanguage = (typeof NOTE_LANGUAGES)[number]
export const NOTE_LANGUAGE_LABEL: Record<NoteLanguage, string> = { en: 'English', nl: 'Nederlands', fr: 'Français', de: 'Deutsch' }

export const REPLY_STATUSES = ['contacted', 'replied', 'call booked', 'referred', 'no reply'] as const
export type ReplyStatus = (typeof REPLY_STATUSES)[number]

export type Person = {
  id: string
  /** null for a contact added by hand. */
  searchId: string | null
  rank: number
  name: string
  title: string
  company: string
  location: string | null
  profileUrl: string
  sourceUrls: string[]
  summary: string
  sharedGround: SharedGround[]
  reason: string
  value: ContactValue
  score: number
  outreach: string
  contactedAt: string | null
  status: ReplyStatus | null
  followedUpAt: string | null
  contactChannel: string | null
  notes: string | null
  /** Call prep sheet, written on demand once they replied. */
  prep: CallPrep | null
  /** The same profile, already contacted from another of your booths. Only filled when a booth is opened. */
  alsoContacted: { searchId: string | null; company: string; number: number | null; contactedAt: string } | null
}

export type CallPrep = { questions: string[]; talkingPoints: string[]; createdAt: string }

export type SearchStatus = 'running' | 'done' | 'failed'

export type Search = {
  id: string
  company: string
  /** Company website host, e.g. "google.com"; null on searches made before it was required. */
  domain: string | null
  role: string
  location: string | null
  goal: Goal | null
  /** Contact types the user narrowed to; empty = everyone. */
  contactTypes: ContactValue[]
  /** Keep only people with verified shared ground. */
  sharedOnly: boolean
  status: SearchStatus
  error: string | null
  model: string | null
  peopleCount: number
  rounds: number
  /** Position in the user's own booth index, oldest = 1. */
  number: number
  createdAt: string
}

export type SearchWithPeople = Search & { people: Person[] }

/** Monthly allowance in €. `used` is what the user was charged (provider cost plus margin); `cost` is our provider cost in €. */
export type AiProvider = 'openrouter' | 'openai' | 'anthropic' | 'gemini' | 'mistral' | 'chatgpt'
/** The seeker's own AI key as the browser sees it: never the key itself. */
/** last4: the key's last four characters; for ChatGPT, the account's name. */
export type AiKeyInfo = { provider: AiProvider; model: string; last4: string }

export type Budget = { used: number; limit: number; cost: number; tokens: number; resetsOn: string; paused?: 'cap' | 'free' | 'you' }

export type ContactedPerson = Person & { search: Pick<Search, 'id' | 'company' | 'role'> | null }

/** LinkedIn's connection-note cap for this seeker. Old profiles lack the flag, so they get the free 200. */
export function noteLimit(profile: Pick<Profile, 'linkedinPremium'> | null | undefined) {
  return profile?.linkedinPremium ? 300 : 200
}

/** Most résumé text the extractor will read (≈ 6 pages); the client trims before sending. */
export const RESUME_TEXT_LIMIT = 24_000

/** Largest résumé PDF kept on the server. */
export const RESUME_PDF_LIMIT = 10 * 1024 * 1024

/** Résumé reads a pending account gets on its free try (a read can fail and need a retry). */
export const TRIAL_RESUME_READS = 3

// ---- Job board: postings evaluated against the seeker's CV (ported from career-ops) ----

/** Most posting text one evaluation reads. */
export const JD_TEXT_LIMIT = 20_000

export const JOB_STATUSES = ['saved', 'evaluated', 'applied', 'responded', 'assessment', 'interview', 'offer', 'rejected', 'discarded'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export const IMPORTANCES = ['critical', 'high', 'meaningful', 'preferred', 'low_signal'] as const
export type Importance = (typeof IMPORTANCES)[number]

export type Requirement = {
  requirement: string
  importance: Importance
  /** stated = the posting says it (jdQuote holds the words); structural = implied by its layout; inferred = estimated. */
  evidenceTier: 'stated' | 'structural' | 'inferred'
  jdQuote: string | null
  match: 'strong' | 'partial' | 'missing' | 'na'
  cvEvidence: string
  mitigation: string | null
}

/** apply_now ≥ 4.5, apply ≥ 4.0, below that do_not_apply. Derived from `score`, never taken from the model. */
export type Recommendation = 'apply_now' | 'apply' | 'do_not_apply'

export type JobEvaluation = {
  role: { title: string; company: string; seniority: string; remote: 'full' | 'hybrid' | 'onsite' | 'unknown'; location: string; tldr: string; domain?: string }
  workAuth: 'sponsors' | 'not_needed' | 'unstated' | 'no_sponsorship'
  requirements: Requirement[]
  dimensions: { cvMatch: number; northStar: number; comp: number; culture: number; redFlags: number }
  score: number
  recommendation: Recommendation
  comp: { advertisedVerbatim: string | null; reliability: 'high' | 'medium' | 'low' | 'unknown' }
  legitimacy: { tier: 'high_confidence' | 'proceed_with_caution' | 'suspicious'; signals: { signal: string; finding: string; weight: 'positive' | 'neutral' | 'concerning' }[] }
  cvChanges: string[]
  keywords: string[]
  hardStops: string[]
}

/** What a posting says about itself, independent of any seeker: the shared half of an evaluation. */
export type PostingFacts = Pick<JobEvaluation, 'role' | 'workAuth' | 'comp' | 'legitimacy' | 'keywords'> & {
  requirements: Pick<Requirement, 'requirement' | 'importance' | 'evidenceTier' | 'jdQuote'>[]
}

export type TailoredCv = {
  name: string
  contact: string[]
  /** No longer written or rendered; kept for CVs tailored before the template layout. */
  summary: string
  competencies: string[]
  /** Second header line, e.g. "Open to relocation", "Portfolio: example.com". */
  contactLine2?: string[]
  experience: { org: string; title: string; dates: string; location?: string; bullets: string[] }[]
  /** Boards, societies, extracurriculars. */
  leadership?: { org: string; title: string; dates: string; location?: string; bullets: string[] }[]
  projects: { name: string; title?: string; dates?: string; url?: string; bullets: string[] }[]
  /** Bullets written "Label: text" (Grade, Exchange, Thesis) render with a bold label. */
  education: { org: string; degree: string; dates: string; location?: string; bullets?: string[] }[]
  /** Flat list of every skill, for the ATS text. */
  skills: string[]
  /** Labelled skill lines: Languages, Technical, Interests. Absent on CVs tailored before the template layout. */
  skillGroups?: { label: string; items: string[] }[]
  /** JD requirements the CV cannot back; shown to the seeker, never written into the CV. */
  gaps: string[]
  /** What was changed from the source résumé and why; absent on CVs tailored before this was added. */
  changes?: { change: string; why: string }[]
  createdAt: string
}

/** One mistake in the seeker's résumé or letter. `quote` is verbatim from that document (checked in code). */
export type CheckIssue = { doc: 'resume' | 'cover'; kind: 'spelling' | 'grammar' | 'accuracy' | 'ats' | 'wording'; quote: string; fix: string; why: string }

/** The seeker's own résumé and cover letter checked against one posting and ATS screening. Not stored. */
export type ApplicationCheck = {
  verdict: string
  /** Which résumé was checked: pasted, the tailored CV, the imported résumé, or the badge fields. */
  resumeSource: 'pasted' | 'tailored' | 'imported' | 'badge'
  hasCover: boolean
  /** Exact-phrase presence of the posting keywords, computed in code, not by the model. */
  keywords: { keyword: string; resume: boolean; cover: boolean }[]
  requirements: { requirement: string; importance: Importance; shown: 'clearly' | 'weakly' | 'not'; where: string }[]
  issues: CheckIssue[]
}

export type Job = {
  id: string
  company: string
  role: string
  url: string | null
  /** Company website host read from the posting, e.g. "stripe.com"; null when unknown. */
  domain: string | null
  location: string | null
  /** The posting text; empty for a saved link that is read when it is evaluated. */
  jdText: string
  /** Null while the posting is only saved, not yet evaluated. */
  score: number | null
  status: JobStatus
  evaluation: JobEvaluation | null
  cv: TailoredCv | null
  coverLetter: string | null
  offerBrief: OfferBrief | null
  payCheck: PayCheck | null
  notes: string | null
  appliedAt: string | null
  /** The one date that matters at this status: apply by, check back on, test due, interview on, reply by (see NEXT_AT_LABEL). */
  nextAt: string | null
  /** Every status the application moved through, oldest first; empty for postings from before it was kept. */
  history: StatusChange[]
  /** The posting's public board stopped listing it (daily check); null while open or unknown. */
  closedAt: string | null
  /** What the company offered, as the seeker typed it; null until they do. */
  offer: OfferTerms | null
  createdAt: string
}

export type StatusChange = { status: JobStatus; at: string }
/** An offer's terms in the seeker's words: yearly base pay and anything else that came with it. */
export type OfferTerms = { base: number | null; currency: string; extras: string }

/** What `nextAt` means at each status; absent where a closed application has no date. */
export const NEXT_AT_LABEL: Partial<Record<JobStatus, string>> = {
  saved: 'Apply by',
  evaluated: 'Apply by',
  applied: 'Check back on',
  responded: 'Next step on',
  assessment: 'Test due',
  interview: 'Interview on',
  offer: 'Reply by',
}

/** The posting list leaves out the heavy parts. */
export type JobSummary = Pick<Job, 'id' | 'company' | 'domain' | 'role' | 'location' | 'url' | 'score' | 'status' | 'appliedAt' | 'nextAt' | 'createdAt' | 'history' | 'closedAt'> & { recommendation: Recommendation | null }

// ---- Scout: find companies worth targeting ----

export const COMPANY_SIZES = ['startup', 'scale-up', 'mid', 'enterprise'] as const
export type CompanySize = (typeof COMPANY_SIZES)[number]
export const COMPANY_SIZE_LABEL: Record<CompanySize, string> = { startup: 'Startup <50', 'scale-up': 'Scale-up 50–500', mid: 'Mid 500–5k', enterprise: 'Enterprise 5k+' }

/** Employee count → size band; the same thresholds as the labels above. */
export function sizeOf(employees: number): CompanySize {
  return employees < 50 ? 'startup' : employees < 500 ? 'scale-up' : employees < 5000 ? 'mid' : 'enterprise'
}

export type ScoutInput = {
  /** Companies the seeker would love to work at; the scout looks for ones like them. */
  dream: string[]
  /** The kind of company, in the seeker's words. */
  description: string
  location: string
  sizes: CompanySize[]
  useProfile: boolean
  exclude: string[]
}

/** Open facts from Wikidata, matched on the company's official website. */
export type CompanyFacts = { qid: string; industry: string | null; country: string | null; employees: number | null; founded: string | null }

export type ScoutPick = {
  name: string
  domain: string
  cluster: string
  /** One line: what the company does. */
  what: string
  /** Why it fits: the dream company it resembles or the described trait it matches. */
  why: string
  /** Concrete overlap with the seeker's badge, when there is one. */
  profileFit: string | null
  /** search = found on the web this run; knowledge = suggested by the model. */
  source: 'search' | 'knowledge'
  /** A model suggestion no open source could confirm. */
  unverified: boolean
  sourceUrl: string | null
  facts: CompanyFacts | null
}

export type ScoutResult = { picks: ScoutPick[]; candidates: number }

export type Scout = { id: string; input: ScoutInput; result: ScoutResult; model: string | null; createdAt: string }
export type ScoutSummary = Pick<Scout, 'id' | 'input' | 'createdAt'> & { picks: number }

export type SavedCompany = { id: string; name: string; domain: string | null; why: string | null; createdAt: string }

/** A saved bubble map: every bubble with its last position, links as id pairs, and which bubbles were grown. */
export type MapBubble = { id: string; name: string; domain: string | null; what: string; why: string | null; unverified: boolean; facts: CompanyFacts | null; depth: number; x?: number; y?: number }
export type BubbleMapData = { nodes: MapBubble[]; links: [string, string][]; expanded: string[] }
export type SavedBubbleMap = { id: string; name: string; domain: string | null; data: BubbleMapData; updatedAt: string }
export type BubbleMapSummary = Omit<SavedBubbleMap, 'data'> & { companies: number }

/** A neighbour on the bubble map: found by Exa's company search, curated by a model, checked against Wikidata.
 *  `why` is null when the model was unavailable and the raw search results were shown. */
export type SimilarCompany = { name: string; domain: string; url: string | null; what: string; why: string | null; unverified: boolean; facts: CompanyFacts | null }

// What the assistant may remember about the seeker. Only saved when the seeker approves (or writes it).
export const MEMORY_KINDS = ['goal', 'preference', 'constraint', 'about', 'style'] as const
export type MemoryKind = (typeof MEMORY_KINDS)[number]
export const MEMORY_TEXT_LIMIT = 300
export const MEMORY_LIMIT = 60

export type Memory = {
  id: string
  kind: MemoryKind
  text: string
  source: 'user' | 'assistant'
  ref: string | null
  createdAt: string
}
