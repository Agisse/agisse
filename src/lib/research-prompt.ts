import type { Profile, Search } from '../../shared/types'

// Same labels and order as profileText in worker/lib/pipeline.ts.
function profileText(p: Profile | null) {
  if (!p) return '(no profile given)'
  const line = (k: string, v: string | string[]) => {
    const s = Array.isArray(v) ? v.filter(Boolean).join('; ') : v
    return s ? `${k}: ${s}` : null
  }
  return (
    [
      line('Headline', p.headline),
      line('University', p.university),
      line('Degree', p.degree),
      line('Graduation year', p.gradYear),
      line('Employers', p.employers),
      line('Internships', p.internships),
      line('Organizations', p.organizations),
      line('Interests', p.interests),
      line('Target industries', p.targetIndustries),
      line('Skills', p.skills),
      line('Background', p.background),
    ]
      .filter(Boolean)
      .join('\n') || '(profile is empty)'
  )
}

/** A prompt the user pastes into ChatGPT or Perplexity to research a booth before reaching out. */
export function researchPrompt(search: Pick<Search, 'company' | 'role' | 'location'>, profile: Profile | null) {
  const where = search.location ? ` in ${search.location}` : ''
  return `I'm preparing to reach out to people at ${search.company} about a ${search.role} role${where}. Research the following and cite your sources:

1. ${search.company}'s recent moves in the last 6 months: launches, funding, hires, reorganisations, layoffs, partnerships.
2. How the team behind a ${search.role} role likely works: structure, tools, ways of working, culture.
3. The likely challenges someone in this ${search.role} role faces right now.
4. ${search.company}'s main competitors and how it positions itself against them.
5. Given my background below, what angle should I take with ${search.role} people at ${search.company}?

MY BACKGROUND
${profileText(profile)}`
}
