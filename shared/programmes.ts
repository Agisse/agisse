// ---- Education tab: programmes a feed provider writes into the `programme` table (docs/education-contract.md).

import { VACANCY_FUNCTIONS } from './listings'

export const PROGRAMME_KINDS = { master: "Master's", mba: 'MBA', phd: 'PhD', phd_position: 'Funded PhD' } as const
export type ProgrammeKind = keyof typeof PROGRAMME_KINDS
export const STUDY_MODES: Record<string, string> = { full_time: 'Full-time', part_time: 'Part-time', online: 'Online' }

export type Programme = {
  url: string
  kind: ProgrammeKind
  title: string
  degree: string | null
  institution: string
  school: string | null
  domain: string | null
  country: string | null
  city: string | null
  fields: string[]
  languages: string[]
  durationMonths: number | null
  tuitionEur: number | null
  studyMode: string | null
  startDate: string | null
  deadline: string | null
  deadlineType: 'explicit' | 'rolling' | 'unknown'
  /** Set once the provider stopped finding it; only saved programmes show closed ones. */
  closedAt: string | null
  /** Best of the THE, QS and FT positions, with which one. */
  rank: { by: 'THE' | 'QS' | 'FT'; n: number } | null
  saved: boolean
  /** Only on one programme (GET /api/programmes/one), not in the list. */
  description?: string | null
  details?: Record<string, unknown>
}
export type ProgrammeFacets = { total: number; kinds: Record<string, number>; countries: Record<string, number>; fields: Record<string, number>; languages: Record<string, number> }

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)
/** A field key as shown: the job feed's label where it is one of its keys, else the provider's own name. */
export const fieldLabel = (k: string) => VACANCY_FUNCTIONS[k as keyof typeof VACANCY_FUNCTIONS] ?? cap(k)
export const languageLabel = cap
const regions = new Intl.DisplayNames(['en'], { type: 'region' })
/** ISO 3166 code as an English name; programmes are worldwide, unlike the job feed's European list. */
export const countryLabel = (code: string) => {
  try {
    return regions.of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}

/** The likely next step after the seeker's degree: a master's degree points to a PhD, a bachelor's to a master's or MBA. */
export function nextKinds(degree: string): ProgrammeKind[] {
  if (/\b(m\.?sc|m\.?a|mphil|mres|llm|meng|mba|mim|master'?s?|ma[sî]tri?se|research master)\b/i.test(degree)) return ['phd', 'phd_position']
  if (/\b(b\.?sc|b\.?a|bba|llb|beng|bachelor'?s?|licence|undergraduate)\b/i.test(degree)) return ['master', 'mba']
  return []
}

/** The Education tab's filters, as the client holds them. Empty lists mean no filter. */
export type ProgrammeFilters = { q: string; kinds: string[]; countries: string[]; fields: string[]; languages: string[]; maxTuition: number | null; soon: boolean; saved: boolean }
export const EMPTY_PROGRAMME_FILTERS: ProgrammeFilters = { q: '', kinds: [], countries: [], fields: [], languages: [], maxTuition: null, soon: false, saved: false }
/** "Closing soon" in the tab: a deadline in the next 30 days. */
export const SOON_DAYS = 30
