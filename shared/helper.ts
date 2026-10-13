import type { JobStatus, MemoryKind, ReplyStatus } from './types'

export type HelperRole = 'user' | 'assistant'

export type HelperMessage = {
  role: HelperRole
  content: string
}

export type HelperAction = {
  label: string
  reason: string
  href: string
}

// A change the assistant suggests; nothing happens until the seeker clicks Apply.
export type HelperProposal =
  | { type: 'remember'; kind: MemoryKind; text: string }
  // `note` is the line to add; `notes` the full text after adding it (what PATCH receives).
  | { type: 'job_update'; jobId: string; label: string; status: JobStatus | null; nextAt: string | null; note: string | null; notes: string | null }
  | { type: 'person_update'; personId: string; label: string; status: ReplyStatus | null; note: string | null; notes: string | null }

export type HelperReply = {
  answer: string
  actions: HelperAction[]
  proposals: HelperProposal[]
  suggestions: string[]
  model: string
}

// The cached opening briefing, refreshed only when the user asks; see /api/helper/briefing.
export type HelperBriefing = HelperReply & { at: string }
