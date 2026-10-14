import type { Story } from '../../shared/stories'
import type { AiKeyInfo, AiProvider, ApplicationCheck, Budget, DraftedEmail, EmailKind, ContactValue, ContactedPerson, Person, Profile, ReplyStatus, Search, SearchWithPeople, Goal, NoteLanguage, Job, JobStatus, JobSummary, OfferTerms, SavedCompany, BubbleMapSummary, SavedBubbleMap, Scout, ScoutInput, ScoutSummary, RatedTask, SimilarCompany, Memory, MemoryKind } from '../../shared/types'
import type { SelectionProcess } from '../../shared/selection'
import type { AnswerDelivery, AnswerFeedback, InterviewQuestion, PracticeAnswer } from '../../shared/interview'
import type { ProgressData } from '../../shared/progress'
import type { AssessmentReport, CompanyAssessment, GameId, GameResult, ReportKind, SkillBenchmark, TrainingMode, TrainingSession } from '../../shared/assessments'
import type { FeedPrefs, Listing, Vacancy, VacancyFacets, VacancySort } from '../../shared/listings'
import type { QualityReport } from '../../shared/quality'
import type { HelperBriefing, HelperMessage, HelperReply } from '../../shared/helper'
import type { CvReviewSummary } from '../../shared/cv-review'
import type { LinkedinInput, LinkedinReview } from '../../shared/linkedin-review'

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

/** Accepts the bare code or the whole invite link pasted into the field. */
export const inviteCode = (raw: string) => {
  const s = raw.trim()
  try { return new URL(s).searchParams.get('invite') ?? s } catch { return s }
}

/** The caller pressed Cancel: not an error to show. */
export const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'same-origin',
  })
  const body = (await res.json().catch(() => null)) as (Record<string, unknown> & { error?: string }) | null
  if (!res.ok) throw new ApiError(res.status, body?.error ?? res.statusText, body)
  return body as T
}

export type Me = { user: { id: string; name: string; email: string; isAdmin: boolean }; profile: Profile | null; briefing: HelperBriefing | null; /** Last CV review score, null until one is run. */ cvReview: CvReviewSummary | null; /** What the assistant may use beyond the CV; only what the seeker approved. */ memories: Memory[]; budget: Budget; /** Set while the account awaits approval: one free search. */ trial: { used: boolean } | null; adzuna: boolean; /** The seeker's own AI key, if set; never the key itself. */ aiKey: AiKeyInfo | null }
/** No school, employers, organizations or skills: nothing to find shared ground with. */
export function profileIsEmpty(me: Me) {
  const p = me.profile
  if (!p) return true
  return !p.university && !p.employers.length && !p.internships.length && !p.organizations.length && !p.skills?.length
}
/** An LLM-written version Jev kept; `pick` = Jev's strongest, `unsupported` = Jev thinks it may claim more than the CV says. */
export type JudgedOption = { text: string; pick: boolean; unsupported: boolean }
/** Exact keyword match plus Jev's reading: keywords shown in other words, and a fit verdict when it had the posting. */
export type CvMatch = { keywords: string[]; matched: string[]; inOtherWords: string[]; missing: string[]; pct: number; recruiterPct: number; fit: { fit: number; label: string } | null; jobId: string | null; label: string }
export type AccessStatus = 'pending' | 'approved' | 'rejected'
export type AdminUser = { id: string; name: string; email: string; accessStatus: AccessStatus; createdAt: string; reviewedAt: string | null; isAdmin: boolean; budgetEur: number | null; referralCreditEur: number | null; budget: Budget; feedCapDays: number }

export type Invite = { code: string; note: string; creditEur: number | null; createdAt: string; usedAt: string | null; revokedAt: string | null; usedByName: string | null; usedByEmail: string | null }

export const api = {
  checkInvite: (code: string) => request<{ valid: boolean }>(`/api/invite/${encodeURIComponent(code)}`),
  redeemInvite: (code: string) => request<{ ok: true }>('/api/me/invite', { method: 'POST', body: JSON.stringify({ code }) }),
  referral: () => request<{ code: string; referrals: number; invitesLeft: number | null; waitlist: { position: number; total: number } | null }>('/api/referral'),
  invites: () => request<{ invites: Invite[] }>('/api/admin/invites'),
  createInvite: (note: string, creditEur: number | null) => request<{ invite: Invite }>('/api/admin/invites', { method: 'POST', body: JSON.stringify({ note, creditEur }) }),
  revokeInvite: (code: string) => request<{ ok: true }>(`/api/admin/invites/${encodeURIComponent(code)}`, { method: 'DELETE' }),
  me: () => request<Me>('/api/me'),
  saveAiKey: (body: { provider: AiProvider; key: string; model: string }) => request<{ aiKey: AiKeyInfo }>('/api/ai-key', { method: 'PUT', body: JSON.stringify(body) }),
  setAiModel: (model: string) => request<{ aiKey: AiKeyInfo }>('/api/ai-key', { method: 'PATCH', body: JSON.stringify({ model }) }),
  aiModels: () => request<{ models: string[] }>('/api/ai-key/models'),
  removeAiKey: () => request<{ ok: true }>('/api/ai-key', { method: 'DELETE' }),
  feedback: (body: { task: RatedTask; refId: string; good: boolean; note?: string }) => request<{ ok: true }>('/api/feedback', { method: 'POST', body: JSON.stringify(body) }),
  adminUsers: () => request<{ users: AdminUser[] }>('/api/admin/users'),
  quality: () => request<{ report: QualityReport }>('/api/admin/quality'),
  setAccess: (id: string, status: AccessStatus) => request<{ user: { id: string; accessStatus: AccessStatus } }>(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  /** null = back to the default monthly budget. */
  setBudget: (id: string, budgetEur: number | null) => request<{ user: { id: string; budgetEur: number | null } }>(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ budgetEur }) }),
  setReferralCredit: (id: string, referralCreditEur: number | null) => request<{ user: { id: string; referralCreditEur: number | null } }>(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ referralCreditEur }) }),
  saveProfile: (profile: Profile) => request<{ profile: Profile }>('/api/profile', { method: 'PUT', body: JSON.stringify(profile) }),
  uploadResume: (file: File) =>
    request<{ ok: true }>('/api/profile/resume', { method: 'PUT', body: file, headers: { 'content-type': 'application/pdf', 'x-filename': encodeURIComponent(file.name) } }),
  extractProfile: (text: string, signal?: AbortSignal) => request<{ profile: Profile; model: string }>('/api/profile/extract', { method: 'POST', body: JSON.stringify({ text }), signal }),
  extractLinkedin: (linkedin: string, signal?: AbortSignal) => request<{ profile: Profile; model: string }>('/api/profile/extract', { method: 'POST', body: JSON.stringify({ linkedin }), signal }),
  cv: () => request<{ resumeText: string | null; review: CvReviewSummary | null }>('/api/cv'),
  saveCvReview: (r: { score: number; failed: string[] }) => request<{ review: CvReviewSummary }>('/api/cv/review', { method: 'PUT', body: JSON.stringify(r) }),
  rewriteLine: (body: { line: string; check: string; cv?: string }) => request<{ options: JudgedOption[]; note: string; refId: string }>('/api/cv/rewrite', { method: 'POST', body: JSON.stringify(body) }),
  cvMatch: (body: { jobId?: string; jdText?: string; cv?: string }) => request<CvMatch>('/api/cv/match', { method: 'POST', body: JSON.stringify(body) }),
  linkedinReview: (input: LinkedinInput) => request<{ review: LinkedinReview }>('/api/cv/linkedin-review', { method: 'POST', body: JSON.stringify(input) }),
  headlines: (current: string) => request<{ headlines: JudgedOption[] }>('/api/cv/headlines', { method: 'POST', body: JSON.stringify({ current }) }),
  searches: () => request<{ searches: Search[] }>('/api/searches'),
  search: (id: string) => request<{ search: SearchWithPeople }>(`/api/searches/${id}`),
  createSearch: (input: { company: string; domain: string; role: string; location?: string; goal?: Goal | null; contactTypes: ContactValue[]; sharedOnly: boolean }, signal?: AbortSignal) =>
    request<{ search: SearchWithPeople }>('/api/searches', { method: 'POST', body: JSON.stringify(input), signal }),
  findMore: (id: string, signal?: AbortSignal) => request<{ search: SearchWithPeople; added: number }>(`/api/searches/${id}/more`, { method: 'POST', signal }),
  deleteSearch: (id: string) => request<{ ok: true }>(`/api/searches/${id}`, { method: 'DELETE' }),
  updatePerson: (id: string, patch: { contacted?: boolean; status?: ReplyStatus; followedUp?: boolean; channel?: string | null; notes?: string | null; outreach?: string }) =>
    request<{ person: Person }>(`/api/people/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  writeOutreach: (id: string, rewrite = false, lang: NoteLanguage = 'en') =>
    request<{ person: Person }>(`/api/people/${id}/outreach?${new URLSearchParams({ ...(rewrite ? { rewrite: '1' } : {}), lang })}`, { method: 'POST' }),
  writeFollowup: (id: string, lang: NoteLanguage = 'en') =>
    request<{ followup: string }>(`/api/people/${id}/outreach?${new URLSearchParams({ kind: 'followup', lang })}`, { method: 'POST' }),
  writePrep: (id: string, rewrite = false) => request<{ person: Person }>(`/api/people/${id}/prep${rewrite ? '?rewrite=1' : ''}`, { method: 'POST' }),
  createPerson: (input: { name: string; title: string; company: string; profileUrl?: string; notes?: string; status?: ReplyStatus }) =>
    request<{ person: Person }>('/api/people', { method: 'POST', body: JSON.stringify(input) }),
  contacted: () => request<{ people: ContactedPerson[] }>('/api/contacted'),
  due: () => request<{ count: number }>('/api/due'),
  askHelper: (messages: HelperMessage[], path: string, signal?: AbortSignal) => request<{ reply: HelperReply }>('/api/helper', { method: 'POST', body: JSON.stringify({ messages, path }), signal }),
  addMemory: (m: { kind: MemoryKind; text: string; source?: 'user' | 'assistant'; ref?: string | null }) => request<{ memory: Memory }>('/api/memory', { method: 'POST', body: JSON.stringify(m) }),
  updateMemory: (id: string, patch: { kind?: MemoryKind; text?: string }) => request<{ memory: Memory }>(`/api/memory/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteMemory: (id: string) => request<{ ok: true }>(`/api/memory/${id}`, { method: 'DELETE' }),
  refreshBriefing: () => request<{ briefing: HelperBriefing }>('/api/helper/briefing', { method: 'POST' }),
  jobs: () => request<{ jobs: JobSummary[]; hasResume: boolean }>('/api/jobs'),
  vacancies: (f: FeedPrefs & { sort: VacancySort; deadlineWithin: number | null; newWithin: number | null; offset: number; similar?: { url: string; title: string } | null }, signal?: AbortSignal) =>
    request<{ vacancies: Vacancy[]; more: boolean; profiled: boolean; total: number }>(
      `/api/vacancies?${new URLSearchParams({
        q: f.query, level: f.level, countries: f.countries.join(','), functions: f.functions.join(','), industries: f.industries.join(','),
        languages: f.languages.join(','), remote: f.remoteOnly ? '1' : '', sponsors: f.sponsorsOnly ? '1' : '', deadline_within: f.deadlineWithin ? String(f.deadlineWithin) : '',
        new_within: f.newWithin ? String(f.newWithin) : '', programs: (f.programs ?? []).join(','),
        sort: f.sort, offset: String(f.offset), similar: f.similar?.url ?? '', similar_title: f.similar?.title ?? '',
      })}`,
      { signal },
    ),
  vacancyFacets: () => request<VacancyFacets>('/api/vacancies/facets'),
  stories: () => request<{ stories: Story[] }>('/api/stories'),
  saveStory: (story: Pick<Story, 'title' | 'text' | 'tags'>, id?: string) => request<{ story: Story }>(id ? `/api/stories/${id}` : '/api/stories', { method: id ? 'PUT' : 'POST', body: JSON.stringify(story) }),
  deleteStory: (id: string) => request<{ ok: true }>(`/api/stories/${id}`, { method: 'DELETE' }),
  listings: (query: { what: string; where: string; country: string }, signal?: AbortSignal) => request<{ listings: Listing[] }>(`/api/listings?${new URLSearchParams(query)}`, { signal }),
  job: (id: string) => request<{ job: Job }>(`/api/jobs/${id}`),
  /** Posting keywords not word for word in the CV the seeker would send (the tailored one when it exists). Free. */
  jobKeywords: (id: string) => request<{ missingKeywords: string[] }>(`/api/jobs/${id}?keywords=1`),
  createJob: (input: { jdText: string; url?: string }, signal?: AbortSignal) => request<{ job: Job; existing: boolean }>('/api/jobs', { method: 'POST', body: JSON.stringify(input), signal }),
  /** Free: pins a listing as saved, evaluated later from its page. */
  saveJob: (input: { url: string; jdText: string; save: { company: string; role: string; location?: string | null; deadline?: string | null } }) => request<{ job: Job; existing: boolean }>('/api/jobs', { method: 'POST', body: JSON.stringify(input) }),
  evaluateJob: (id: string, signal?: AbortSignal) => request<{ job: Job; existing: boolean }>(`/api/jobs/${id}/evaluate`, { method: 'POST', signal }),
  quickFit: (jdText: string) => request<{ fit: number; label: string }>('/api/jobs/quick-fit', { method: 'POST', body: JSON.stringify({ jdText }) }),
  updateJob: (id: string, patch: { status?: JobStatus; notes?: string | null; coverLetter?: string; nextAt?: string | null; offer?: OfferTerms | null }) => request<{ job: Job }>(`/api/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteJob: (id: string) => request<{ ok: true }>(`/api/jobs/${id}`, { method: 'DELETE' }),
  writeJobDoc: (id: string, doc: 'cv' | 'cover', rewrite = false) => request<{ job: Job }>(`/api/jobs/${id}/${doc}${rewrite ? '?rewrite=1' : ''}`, { method: 'POST' }),
  jobAssessment: (jobId: string) => request<{ assessment: CompanyAssessment | null; reports: AssessmentReport[] }>(`/api/jobs/${jobId}/assessment`),
  researchAssessment: (jobId: string) => request<{ assessment: CompanyAssessment | null }>(`/api/jobs/${jobId}/assessment/research`, { method: 'POST' }),
  reportAssessment: (input: { jobId: string; kind: ReportKind; detail?: string | null }) => request<{ report: AssessmentReport }>('/api/assessments/reports', { method: 'POST', body: JSON.stringify(input) }),
  jobSelection: (jobId: string) => request<{ selection: SelectionProcess | null }>(`/api/jobs/${jobId}/selection`),
  researchSelection: (jobId: string) => request<{ selection: SelectionProcess | null }>(`/api/jobs/${jobId}/selection/research`, { method: 'POST' }),
  answerFeedback: (jobId: string, question: string, answer: string, signal?: AbortSignal, mock?: { delivery: AnswerDelivery }) =>
    request<{ feedback: AnswerFeedback; answer: PracticeAnswer }>(`/api/jobs/${jobId}/answer-feedback`, { method: 'POST', body: JSON.stringify({ question, answer, ...(mock ? { source: 'mock', delivery: mock.delivery } : {}) }), signal }),
  fieldAnswerFeedback: (field: string, question: string, answer: string, signal?: AbortSignal) =>
    request<{ feedback: AnswerFeedback }>('/api/interview/answer-feedback', { method: 'POST', body: JSON.stringify({ field, question, answer }), signal }),
  interviewQuestions: (jobId: string) => request<{ questions: InterviewQuestion[]; format: { prepSec: number; answerSec: number; retakes: number; questions: number } }>(`/api/jobs/${jobId}/interview-questions`),
  transcribe: (audio: string, format: 'webm' | 'ogg' | 'mp4' | 'wav') => request<{ text: string }>('/api/transcribe', { method: 'POST', body: JSON.stringify({ audio, format }) }),
  progress: () => request<ProgressData>('/api/progress'),
  practiceAnswers: (jobId: string) => request<{ answers: PracticeAnswer[] }>(`/api/jobs/${jobId}/practice`),
  offerBrief: (jobId: string) => request<{ job: Job }>(`/api/jobs/${jobId}/offer-brief`, { method: 'POST' }),
  checkApplication: (jobId: string, docs: { resume?: string; cover?: string }) => request<{ check: ApplicationCheck }>(`/api/jobs/${jobId}/check`, { method: 'POST', body: JSON.stringify(docs) }),
  jobEmail: (jobId: string, body: { kind: Exclude<EmailKind, 'intro'>; lang: NoteLanguage; notes: string }) =>
    request<{ email: DraftedEmail }>(`/api/jobs/${jobId}/email`, { method: 'POST', body: JSON.stringify(body) }),
  answerQuestion: (jobId: string, question: string, maxChars: number | null) =>
    request<{ answer: string }>(`/api/jobs/${jobId}/answer`, { method: 'POST', body: JSON.stringify({ question, maxChars }) }),
  personEmail: (id: string, lang: NoteLanguage) => request<{ email: DraftedEmail }>(`/api/people/${id}/email?${new URLSearchParams({ lang })}`, { method: 'POST' }),
  payCheck: (jobId: string) => request<{ job: Job }>(`/api/jobs/${jobId}/pay-check`, { method: 'POST' }),
  trainingSessions: (jobId?: string) => request<{ sessions: TrainingSession[] }>(`/api/training${jobId ? `?${new URLSearchParams({ jobId })}` : ''}`),
  saveTraining: (input: { jobId: string | null; mode: TrainingMode; gameId: GameId; providerGameId: string | null; durationSec: number; result: GameResult }) => request<{ session: TrainingSession }>('/api/training', { method: 'POST', body: JSON.stringify(input) }),
  scouts: () => request<{ scouts: ScoutSummary[] }>('/api/scouts'),
  scout: (id: string) => request<{ scout: Scout }>(`/api/scouts/${id}`),
  createScout: (input: ScoutInput, signal?: AbortSignal) => request<{ scout: Scout }>('/api/scouts', { method: 'POST', body: JSON.stringify(input), signal }),
  similarCompanies: (input: { name: string; domain: string | null }, signal?: AbortSignal) => request<{ companies: SimilarCompany[] }>('/api/scouts/similar', { method: 'POST', body: JSON.stringify(input), signal }),
  deleteScout: (id: string) => request<{ ok: true }>(`/api/scouts/${id}`, { method: 'DELETE' }),
  bubbleMaps: () => request<{ maps: BubbleMapSummary[] }>('/api/bubble-maps'),
  bubbleMap: (id: string) => request<{ map: SavedBubbleMap }>(`/api/bubble-maps/${id}`),
  saveBubbleMap: (id: string, input: Pick<SavedBubbleMap, 'name' | 'domain' | 'data'>) => request<{ map: SavedBubbleMap }>(`/api/bubble-maps/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteBubbleMap: (id: string) => request<{ ok: true }>(`/api/bubble-maps/${id}`, { method: 'DELETE' }),
  shortlist: () => request<{ companies: SavedCompany[] }>('/api/shortlist'),
  saveCompany: (input: { name: string; domain: string | null; why: string | null }) => request<{ company: SavedCompany }>('/api/shortlist', { method: 'POST', body: JSON.stringify(input) }),
  unsaveCompany: (id: string) => request<{ ok: true }>(`/api/shortlist/${id}`, { method: 'DELETE' }),
  benchmarks: () => request<{ benchmarks: SkillBenchmark[] }>('/api/training/benchmarks'),
}
