import type { Profile } from '../../shared/types'

const FIELDS: Array<Exclude<keyof Profile, 'linkedinPremium' | 'smartModel' | 'jobFeed' | 'answers'>> = ['headline', 'university', 'degree', 'gradYear', 'employers', 'internships', 'organizations', 'interests', 'targetIndustries', 'skills', 'background']

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
