// Selection process: how a company's hiring rounds run, researched from public reviews, forums and careers pages.
import type { AssessmentSource, Confidence } from './assessments'

export type SelectionStage = { name: string; format: string; whatTheyAssess: string; duration: string | null; tips: string[]; sourceUrls: string[] }
/** One point from the sources, always with the URL it came from. */
export type SourcedTip = { tip: string; sourceUrl: string }
export type ReportedQuestion = { question: string; stage: string | null; sourceUrl: string }

export type SelectionProcess = {
  id: string
  company: string
  /** Case-insensitive substring of the role title; null = any role. */
  rolePattern: string | null
  location: string | null
  stages: SelectionStage[]
  questions: ReportedQuestion[]
  /** What the company screens for, as the sources state it. */
  values: string[]
  timeline: string | null
  difficulty: string | null
  advice: SourcedTip[]
  pitfalls: SourcedTip[]
  sources: AssessmentSource[]
  /** ISO date the sources were checked. */
  sourceDate: string
  confidence: Confidence
  notes: string | null
}
