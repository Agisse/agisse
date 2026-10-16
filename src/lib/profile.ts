import type { Profile } from '../../shared/types'

const FIELDS: Array<Exclude<keyof Profile, 'linkedinPremium' | 'smartModel' | 'shareOutcomes' | 'jobFeed' | 'answers'>> = ['headline', 'university', 'degree', 'gradYear', 'employers', 'internships', 'organizations', 'interests', 'targetIndustries', 'skills', 'background']

/** Résumé values win for single fields; list entries are added to what is already there. */
export function mergeResume(current: Profile, fromResume: Profile): { profile: Profile; filled: number } {
  const next = { ...current }
  let filled = 0
  for (const k of FIELDS) {
    const v = fromResume[k]
    if (Array.isArray(v)) {
      const have = new Set((current[k] as string[]).map((s) => s.toLowerCase()))
      const add = v.filter((s) => !have.has(s.toLowerCase()))
      if (add.length) {
        ;(next[k] as string[]) = [...(current[k] as string[]), ...add]
        filled++
      }
    } else if (v && v !== current[k]) {
      ;(next[k] as string) = v
      filled++
    }
  }
  return { profile: next, filled }
}

// Words on a CV that name a feed field. Clear cases only: a wrong guess costs a tap, a vague one ("business") costs trust.
const FIELD_WORDS: [string, RegExp][] = [
  ['software', /\bsoftware|computer science|informatics?\b|informatica|developer|programm/i],
  ['data', /\bdata\b|analytics|statistic|machine learning/i],
  ['ib', /investment bank/i],
  ['audit', /\baudit|accountan|accounting|\btax\b/i],
  ['corp_finance', /\bfinance\b|financ(i[eë]le?|ial)/i],
  ['consulting', /consult/i],
  ['marketing', /marketing|communicati/i],
  ['legal', /\blaws?\b|\blegal|rechten|\bdroit\b|\bjurist/i],
  ['engineering', /mechanical|electrical|civil engineer|ingenieur|engineering/i],
  ['science', /biolog|chemi|physics|bio-?engineer|biomedical/i],
  ['healthcare', /medicine|medical|nursing|pharmac/i],
  ['hr', /human resources|\bHR\b|recruit|psycholog/i],
  ['design', /\bdesign|architect/i],
  ['policy', /politic|international relations|public (policy|administration)/i],
  ['education', /teacher|teaching|pedagog/i],
  ['media', /journalis/i],
  ['ops', /logistic|supply chain/i],
  ['sustainability', /sustainab|environmental|climate/i],
]

/** Up to three feed fields the CV points at, for onboarding to preselect. */
export function suggestFields(p: Pick<Profile, 'headline' | 'degree' | 'internships' | 'targetIndustries'>): string[] {
  const text = [p.headline, p.degree, ...p.internships, ...p.targetIndustries].join(' · ')
  return FIELD_WORDS.filter(([, re]) => re.test(text)).map(([k]) => k).slice(0, 3)
}

/** The country the browser's language points at (nl-BE → BE), if the feed has it. */
export function localeCountry(known: Record<string, string>, language = globalThis.navigator?.language ?? ''): string | null {
  const region = language.split('-')[1]?.toUpperCase()
  return region && region in known ? region : null
}
