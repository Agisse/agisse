// LinkedIn profile review: the same kind of rule checks as the CV review, run on the text of the seeker's own
// profile page — read by the extension from the tab they click it on, or pasted. Nothing here fetches LinkedIn.
import { bandOf, buzzwordsIn, isQuantified, type CvBand } from './cv-review'
import { hasPhrase } from './text'
import type { Profile } from './types'

export const LINKEDIN_GROUPS = ['headline', 'about', 'experience', 'search'] as const
export type LinkedinGroup = (typeof LINKEDIN_GROUPS)[number]
export const LINKEDIN_GROUP_LABEL: Record<LinkedinGroup, string> = { headline: 'Headline', about: 'About', experience: 'Experience', search: 'Found in search' }

export type LinkedinCheck = { id: string; group: LinkedinGroup; label: string; score: number; pass: boolean; lines: string[]; tip: string }
export type LinkedinReview = { score: number; band: CvBand; headline: string; checks: LinkedinCheck[] }
export type LinkedinInput = { text: string; headline?: string; url?: string }

export const LINKEDIN_TEXT_LIMIT = 30_000

type Section = 'about' | 'experience' | 'education' | 'skills' | 'other'

// Profile section headings in English, Dutch, French and German. Unknown headings close the section above.
const HEADINGS: Record<string, Section> = Object.fromEntries([
  ...['about', 'info', 'infos', 'a propos', 'over', 'uber mich', 'summary'].map((h) => [h, 'about']),
  ...['experience', 'ervaring', 'werkervaring', 'berufserfahrung', 'experiences'].map((h) => [h, 'experience']),
  ...['education', 'opleiding', 'formation', 'ausbildung', 'bildungsweg'].map((h) => [h, 'education']),
  ...['skills', 'vaardigheden', 'competences', 'kenntnisse', 'top skills'].map((h) => [h, 'skills']),
  ...['activity', 'featured', 'licenses and certifications', 'licenses certifications', 'projects', 'volunteering', 'volunteer experience', 'honors and awards', 'honors awards', 'languages', 'recommendations', 'interests', 'courses', 'publications', 'organizations', 'people also viewed', 'people you may know', 'you might like', 'more profiles for you', 'analytics', 'resources', 'talen', 'langues', 'sprachen', 'aanbevelingen', 'recommandations', 'empfehlungen', 'activiteit', 'activite', 'aktivitaten'].map((h) => [h, 'other']),
])

const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim()
const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w))
const clamp = (n: number) => Math.max(0, Math.min(1, n))
// LinkedIn chrome that ends up in copied page text.
const NOISE = /^(?:see more|see all|show all.*|…see more|\.\.\.see more|endorse|message|connect|follow|more|contact info|\d+(?:st|nd|rd|th)|·.*|he\/him|she\/her|they\/them|\d+\+? (?:connections|followers))$/i

export function parseLinkedin(text: string) {
  const lines: string[] = []
  for (const raw of text.slice(0, LINKEDIN_TEXT_LIMIT).split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, ' ').trim()
    // Screen-reader copies repeat each heading and title on the next line.
    if (line && line !== lines[lines.length - 1] && !NOISE.test(line)) lines.push(line)
  }
  const top: string[] = []
  const sections = new Map<Section, string[]>()
  let section: Section | null = null
  for (const line of lines) {
    const h = words(line).length <= 4 ? HEADINGS[fold(line)] : undefined
    if (h) {
      section = h
      if (!sections.has(h)) sections.set(h, [])
    } else if (section) sections.get(section)!.push(line)
    else top.push(line)
  }
  return { top, sections }
}

const GENERIC_HEADLINE = /^(?:(?:student|studente?|etudiant|etudiante|graduate|alumnus|alumna|intern|stagiair|stagiaire|praktikant|werkstudent)(?: (?:at|bij|a|chez|an|der|de|in|aan) .+)?|looking for (?:new )?opportunities|open to work|seeking .+ opportunities|--)$/

/** Every check on one profile. `profile` lets the headline, About and Skills checks look for the seeker's own targets. */
export function reviewLinkedin(input: LinkedinInput, profile?: Profile | null): LinkedinReview {
  const { top, sections } = parseLinkedin(input.text)
  // The top card is name, then headline; the extension sends the headline separately when it can read it.
  const headline = (input.headline?.trim() || top[1] || '').slice(0, 300)
  const about = (sections.get('about') ?? []).join(' ')
  const experience = sections.get('experience') ?? []
  const skills = sections.get('skills') ?? []
  const targets = [...(profile?.skills ?? []), ...(profile?.targetIndustries ?? [])]
  const checks: (LinkedinCheck & { weight: number })[] = []
  const add = (c: Omit<LinkedinCheck, 'pass'> & { weight: number }) => checks.push({ ...c, score: Math.round(clamp(c.score) * 100) / 100, pass: c.score >= 0.8, lines: c.score >= 0.8 ? [] : c.lines })

  const generic = !headline || GENERIC_HEADLINE.test(fold(headline))
  const headlineHits = targets.filter((t) => hasPhrase(headline, t))
  add({ id: 'headline-specific', group: 'headline', weight: 3, label: 'Specific headline', score: generic ? 0 : headline.length < 40 ? 0.6 : 1, lines: headline ? [headline] : [], tip: !headline ? 'No headline found. It is the line recruiters see in every search result: say what you do and what you are aiming for.' : generic ? '"Student at …" is the most common headline on LinkedIn. Add your field, a skill or two and the role you want, e.g. "Business engineering student · SQL, Python · Aiming for supply chain analytics".' : headline.length < 40 ? 'A short headline wastes the space recruiters search on. Add a skill or the role you are aiming for.' : 'The headline says what you do.' })
  if (targets.length) add({ id: 'headline-keywords', group: 'headline', weight: 2, label: 'Headline keywords', score: headlineHits.length ? 1 : 0, lines: headline ? [headline] : [], tip: headlineHits.length ? `The headline mentions ${headlineHits.slice(0, 3).join(', ')}.` : `Recruiters search by skill and field. None of your profile's skills or target industries (${targets.slice(0, 4).join(', ')}) is in the headline.` })

  const aboutWords = words(about).length
  const sentences = about.split(/[.!?]+\s/).filter((s) => words(s).length >= 3).length
  add({ id: 'about', group: 'about', weight: 2, label: 'About section', score: !aboutWords ? 0 : aboutWords < 30 || sentences < 3 ? 0.5 : aboutWords > 350 ? 0.7 : 1, lines: [], tip: !aboutWords ? 'No About section found. Three to five sentences: what you study or do, one thing you built or achieved, and what you are looking for next.' : aboutWords < 30 || sentences < 3 ? 'The About section is very short. Add one concrete achievement and the kind of role you want next.' : aboutWords > 350 ? `About ${aboutWords} words: most visitors read the first two lines. Lead with the point and cut the rest.` : 'The About section has substance.' })
  if (targets.length && aboutWords) {
    const hits = targets.filter((t) => hasPhrase(about, t))
    add({ id: 'about-keywords', group: 'about', weight: 1, label: 'About mentions your targets', score: hits.length >= 2 ? 1 : hits.length ? 0.6 : 0, lines: [], tip: hits.length >= 2 ? `About mentions ${hits.slice(0, 4).join(', ')}.` : `Name the fields and skills you want to be found for (${targets.slice(0, 4).join(', ')}) in the About text.` })
  }

  // Description lines: sentence-length lines under Experience, not the title/company/date lines.
  const described = experience.filter((l) => words(l).length >= 7)
  add({ id: 'experience-described', group: 'experience', weight: 2, label: 'Roles have descriptions', score: !experience.length ? 0 : described.length >= 3 ? 1 : described.length ? 0.6 : 0.2, lines: [], tip: !experience.length ? 'No Experience section found. Add internships, student jobs, teaching or association roles: they all count.' : described.length >= 3 ? 'Your roles carry descriptions.' : 'Most roles have a title and no description. Add two or three lines each on what you did and what came of it.' })
  const unquantified = described.filter((l) => !isQuantified(l))
  add({ id: 'experience-quantified', group: 'experience', weight: 2, label: 'Results with numbers', score: described.length ? clamp((described.length - unquantified.length) / described.length / 0.5) : 0, lines: unquantified.slice(0, 6), tip: 'As on a CV: numbers show scale. Aim for a figure in at least half the description lines.' })
  const buzz = [headline, ...(sections.get('about') ?? []), ...experience].filter((l) => buzzwordsIn(l).length)
  add({ id: 'buzzwords', group: 'experience', weight: 1, label: 'Buzzwords and clichés', score: 1 - buzz.length * 0.25, lines: buzz.slice(0, 6), tip: '"Motivated", "passionate about" and "team player" are on most profiles. Show it with something you did.' })

  const skillHits = (profile?.skills ?? []).filter((s) => hasPhrase(skills.join('\n'), s))
  add({ id: 'skills', group: 'search', weight: 2, label: 'Skills listed', score: !skills.length ? 0 : !profile?.skills.length ? 1 : skillHits.length / profile.skills.length / 0.5, lines: [], tip: !skills.length ? 'No Skills section found. Recruiters filter search results by skill; add at least five.' : profile?.skills.length && skillHits.length < profile.skills.length ? `Skills on your Agisse profile but not on LinkedIn: ${profile.skills.filter((s) => !skillHits.includes(s)).slice(0, 6).join(', ')}.` : 'Your skills are listed.' })
  add({ id: 'education', group: 'search', weight: 1, label: 'Education listed', score: sections.has('education') ? 1 : 0, lines: [], tip: sections.has('education') ? 'Education is listed.' : 'No Education section found. Alumni search is how many recruiters find students.' })
  const slug = input.url?.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1]
  if (slug) {
    const autoSlug = /-[0-9a-f]{6,}$|\d{3,}$/i.test(decodeURIComponent(slug))
    add({ id: 'url', group: 'search', weight: 1, label: 'Custom profile URL', score: autoSlug ? 0 : 1, lines: autoSlug ? [`linkedin.com/in/${slug}`] : [], tip: autoSlug ? 'Your profile URL ends in generated characters. Set a clean one (Edit public profile & URL) for your CV header.' : 'Your profile URL is clean.' })
  }

  const total = checks.reduce((n, c) => n + c.weight, 0)
  const score = Math.round((100 * checks.reduce((n, c) => n + c.weight * c.score, 0)) / total)
  return { score, band: bandOf(score), headline, checks: checks.map(({ weight: _w, ...c }) => c) }
}
