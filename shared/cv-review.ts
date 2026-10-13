// CV review: recruiter-style checks run on the résumé text, in the browser, with no model call.
// The checks mirror the ones Resume Worded publishes (impact, brevity, style, sections); the code scores, never a model.
import { BANNED_PHRASES, hasPhrase } from './text'
import type { Profile } from './types'

export const CHECK_GROUPS = ['impact', 'brevity', 'style', 'sections'] as const
export type CheckGroup = (typeof CHECK_GROUPS)[number]
export const CHECK_GROUP_LABEL: Record<CheckGroup, string> = { impact: 'Impact', brevity: 'Brevity', style: 'Style', sections: 'Sections' }

export type CvCheck = {
  id: string
  group: CheckGroup
  label: string
  /** 0..1; the check passes at PASS_AT or above. */
  score: number
  pass: boolean
  /** The CV lines behind a failed check, bullet markers stripped. */
  lines: string[]
  tip: string
  /** Lines here can be sent to the rewriter. */
  rewritable: boolean
}

export type CvBand = 'Exceptional' | 'Strong' | 'Solid' | 'Room to grow'
export type CvReview = { score: number; band: CvBand; words: number; bullets: number; checks: CvCheck[] }
/** What is stored on the profile: enough for a score tile and a trend, not the CV. */
export type CvReviewSummary = { score: number; at: string; failed: string[] }

const PASS_AT = 0.8
const MAX_LINES = 8

export const bandOf = (score: number): CvBand => (score >= 90 ? 'Exceptional' : score >= 85 ? 'Strong' : score >= 80 ? 'Solid' : 'Room to grow')

// ---- Parsing ----

type Section = 'experience' | 'education' | 'skills' | 'projects' | 'summary' | 'activities' | 'languages' | 'certifications' | 'references' | 'interests'

// English plus the Dutch, French and German headings European students use.
const SECTION_NAMES: Record<Section, string[]> = {
  experience: ['experience', 'work experience', 'professional experience', 'relevant experience', 'employment', 'employment history', 'work history', 'internships', 'werkervaring', 'ervaring', 'beroepservaring', 'experience professionnelle', 'experiences professionnelles', 'experiences', 'berufserfahrung', 'praktische erfahrung', 'praktika'],
  education: ['education', 'academic background', 'opleiding', 'opleidingen', 'studies', 'formation', 'formations', 'etudes', 'ausbildung', 'bildung', 'studium', 'bildungsweg'],
  skills: ['skills', 'technical skills', 'skills and tools', 'skills and interests', 'competencies', 'vaardigheden', 'competenties', 'competences', 'kenntnisse', 'fahigkeiten', 'kompetenzen'],
  projects: ['projects', 'project', 'personal projects', 'personal project', 'selected projects', 'side projects', 'projecten', 'projets', 'projekte'],
  summary: ['summary', 'profile', 'professional summary', 'about me', 'objective', 'profiel', 'over mij', 'profil', 'a propos', 'uber mich'],
  activities: ['leadership', 'activities', 'extracurriculars', 'extracurricular activities', 'volunteering', 'volunteer experience', 'engagement', 'nevenactiviteiten', 'activites', 'engagement'],
  languages: ['languages', 'talen', 'langues', 'sprachen'],
  certifications: ['certifications', 'certificates', 'awards', 'certificaten', 'certificats', 'zertifikate'],
  references: ['references', 'referenties', 'references professionnelles', 'referenzen'],
  interests: ['interests', 'hobbies', 'interesses', 'centres d interet', 'interessen'],
}
const HEADINGS = new Map(Object.entries(SECTION_NAMES).flatMap(([section, names]) => names.map((n) => [n, section as Section])))

const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
// A bullet ending mid-phrase ("…SQL, Power BI, and") continues on the next line, whatever its first letter.
const DANGLING = /(?:,|\b(?:and|or|with|to|for|of|the|a|an|in|on|by|from|via|using|including|en|et|und|met|voor))$/i
const BULLET = /^\s*[•·▪◦●■►▸‣\-*–—]\s*/
const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w))

function headingOf(line: string): Section | null {
  if (BULLET.test(line) || words(line).length > 5) return null
  const f = fold(line.replace(/[:|]+$/, ''))
  // "Skills & Interests", "Leadership and Extracurriculars": the first part names the section.
  return HEADINGS.get(f) ?? HEADINGS.get(f.split(/ (?:and|en|et|und) /)[0]!) ?? null
}

type Parsed = { lines: string[]; bullets: { text: string; section: Section | null }[]; sections: Map<Section, string[]> }

export function parseCv(text: string): Parsed {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const sections = new Map<Section, string[]>()
  const bullets: Parsed['bullets'] = []
  let section: Section | null = null
  let open = false // the last line was a bullet that may continue on the next line
  for (const line of lines) {
    const h = headingOf(line)
    if (h) {
      section = h
      if (!sections.has(h)) sections.set(h, [])
      open = false
      continue
    }
    if (section) sections.get(section)!.push(line)
    if (BULLET.test(line)) {
      const body = line.replace(BULLET, '')
      if (words(body).length) bullets.push({ text: body, section })
      open = !!words(body).length
    } else if (open && !headingOf(line) && (/^[a-z(]/.test(line) || DANGLING.test(bullets[bullets.length - 1]!.text))) {
      // PDF text breaks long bullets across lines; a lowercase start is the tail of the one above.
      bullets[bullets.length - 1]!.text += ' ' + line
    } else {
      open = false
    }
  }
  // CVs without bullet markers: treat sentence-like lines under Experience/Projects as bullets.
  if (!bullets.length) {
    for (const s of ['experience', 'projects', 'activities'] as const)
      for (const line of sections.get(s) ?? []) if (words(line).length >= 6 && !DATE_RANGE.test(line)) bullets.push({ text: line, section: s })
  }
  return { lines, bullets, sections }
}

const FACT_SECTIONS = new Set<Section>(['education', 'skills', 'languages', 'interests', 'certifications', 'references'])

// ---- Word lists ----

const WEAK_OPENERS = ['helped', 'help', 'assisted', 'assist', 'worked on', 'work on', 'participated', 'participate', 'was involved', 'involved in', 'contributed to', 'supported', 'support', 'tasked with', 'handled', 'did', 'got', 'tried', 'attended', 'learned', 'learnt', 'gained experience']
const DUTY_PHRASES = ['responsible for', 'duties included', 'duties include', 'tasks included', 'tasks include', 'in charge of', 'my role was', 'role involved']
const FILLER = ['very', 'really', 'various', 'successfully', 'effectively', 'extremely', 'basically', 'actually', 'just', 'quite', 'highly', 'a lot of', 'lots of', 'etc']
const CV_CLICHES = ['team player', 'hard working', 'hardworking', 'hard-working', 'detail oriented', 'detail-oriented', 'self starter', 'self-starter', 'go getter', 'go-getter', 'think outside the box', 'highly motivated', 'motivated', 'dynamic', 'synergy', 'fast learner', 'quick learner', 'excellent communication skills', 'strong work ethic', 'goal oriented', 'goal-oriented']
const PERSONAL_DETAILS = ['date of birth', 'birth date', 'born on', 'marital status', 'married', 'nationality', 'religion', 'geboortedatum', 'geboren op', 'burgerlijke staat', 'nationaliteit', 'date de naissance', 'ne le', 'nee le', 'etat civil', 'nationalite', 'geburtsdatum', 'geboren am', 'familienstand', 'staatsangehorigkeit']
const REFERENCES = ['references available', 'references upon request', 'references on request', 'referenties op aanvraag', 'references sur demande', 'referenzen auf anfrage']

const first = (s: string) => fold(s).split(' ').slice(0, 3).join(' ')
const startsWithAny = (s: string, list: string[]) => list.some((p) => ` ${first(s)} `.startsWith(` ${p} `))
const containsAny = (s: string, list: string[]) => list.filter((p) => hasPhrase(s, p))

// Numbers that show scale: digits that are not a lone year, plus written percentages and currency.
const QUANT = /(?<![\d/.-])(?!(?:19|20)\d{2}\b)\d[\d.,]*\s*(?:%|k\b|m\b|x\b)?|[%€$£]|\b(?:percent|procent|pourcent|prozent|doubled|tripled|halved)\b/i
const PASSIVE = /\b(?:was|were|been|being|is|are|got)\s+(?:\w+ly\s+)?\w+(?:ed|en|wn|ung|ught|lt|pt|ent)\b/i
const PRONOUN = /\b(?:I|me|my|mine|myself)\b|\b(?:ik|mijn|je|moi|mon|ma|mes|ich|mein|meine)\b/
const DATE_RANGE = /\b(?:19|20)\d{2}\b.*(?:–|-|—|to|tot|à|bis|present|heden|aujourd|heute|now)/i
const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|mrt|mei|okt|janv|fevr|mars|avr|mai|juin|juil|aout|déc|dez|märz|januari|februari|maart|april|juni|juli|augustus|september|oktober|november|december|january|february|march|june|july|august|october)[a-z]*\\.?'
const DATE_FORMS: [string, RegExp][] = [
  ['month name', new RegExp(`\\b${MONTH}\\s+(?:19|20)\\d{2}\\b`, 'gi')],
  ['numeric month', /\b(?:0?[1-9]|1[0-2])[/.-](?:19|20)\d{2}\b/g],
  ['ISO', /\b(?:19|20)\d{2}-(?:0[1-9]|1[0-2])\b/g],
]
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/
const PHONE = /(?:\+|\b0)\d[\d\s().-]{7,}\d/
const LINKEDIN = /linkedin\.com\/in\//i

/** A line that shows scale: a number that is not a lone year, a percentage or a currency. */
export const isQuantified = (s: string) => QUANT.test(s)
/** Buzzwords and CV clichés found in the text. */
export const buzzwordsIn = (s: string) => containsAny(s, [...BANNED_PHRASES, ...CV_CLICHES])

// ---- Checks ----

const clamp = (n: number) => Math.max(0, Math.min(1, n))
const share = (n: number, of: number) => (of ? n / of : 0)

type Spec = Omit<CvCheck, 'pass' | 'lines' | 'rewritable'> & { lines?: string[]; rewritable?: boolean; weight: number }

/** Every check on one CV text. `profile` adds the badge-vs-CV skills check. */
export function reviewCv(text: string, profile?: Profile | null): CvReview {
  const { lines, bullets, sections } = parseCv(text)
  // Achievement bullets: Education, Skills and the like list facts ("Courses: …"), so the impact and length rules skip them.
  const b = bullets.filter((x) => !x.section || !FACT_SECTIONS.has(x.section)).map((x) => x.text)
  const all = lines.join('\n')
  const wordCount = words(all).length
  const specs: Spec[] = []

  // Impact
  const unquantified = b.filter((x) => !isQuantified(x))
  specs.push({ id: 'quantified', group: 'impact', weight: 3, label: 'Results with numbers', score: b.length ? clamp(share(b.length - unquantified.length, b.length) / 0.5) : 0, lines: unquantified, rewritable: true, tip: 'Recruiters skim for scale: how many, how much, how fast. Aim for a number in at least half your bullets — users, euros, %, hours saved, team size.' })
  const weak = b.filter((x) => startsWithAny(x, WEAK_OPENERS))
  specs.push({ id: 'weak-verbs', group: 'impact', weight: 2, label: 'Strong opening verbs', score: clamp(1 - share(weak.length, b.length) * 4), lines: weak, rewritable: true, tip: '"Helped", "assisted" and "worked on" hide what you did. Open with the verb for your own part: built, analysed, ran, negotiated, wrote.' })
  const duty = b.filter((x) => containsAny(x, DUTY_PHRASES).length)
  specs.push({ id: 'duties', group: 'impact', weight: 2, label: 'Achievements, not duties', score: clamp(1 - share(duty.length, b.length) * 4), lines: duty, rewritable: true, tip: '"Responsible for" describes the job, not what you achieved in it. Say what changed because you were there.' })
  const openers = new Map<string, string[]>()
  for (const x of b) {
    const v = fold(x).split(' ')[0] ?? ''
    if (v.length > 2) openers.set(v, [...(openers.get(v) ?? []), x])
  }
  const repeated = [...openers.values()].filter((xs) => xs.length >= 3).flatMap((xs) => xs.slice(2))
  specs.push({ id: 'repetition', group: 'impact', weight: 1, label: 'Varied verbs', score: clamp(1 - share(repeated.length, b.length) * 5), lines: repeated, rewritable: true, tip: 'The same opening verb three times or more reads as a template. Vary it to match what each bullet actually did.' })
  const ing = b.filter((x) => /^[A-Za-z]+ing\b/.test(x) && !/^(?:during|bring|string|king|spring|morning|engineering|marketing|accounting|banking|consulting|training|planning|funding|pricing)\b/i.test(x))
  specs.push({ id: 'tense', group: 'impact', weight: 1, label: 'Verb tense', score: clamp(1 - share(ing.length, b.length) * 4), lines: ing, rewritable: true, tip: 'Bullets that open with "-ing" ("Managing…") read as a task list. Past tense for past roles, present tense for the current one.' })

  // Brevity
  const lengthScore = wordCount < 100 ? 0.2 : wordCount < 180 ? 0.6 : wordCount <= 800 ? 1 : wordCount <= 1100 ? 0.7 : 0.4
  specs.push({ id: 'length', group: 'brevity', weight: 2, label: 'Length', score: lengthScore, tip: wordCount < 180 ? `About ${wordCount} words: thin for a full page. Add the projects, jobs and activities you left out, with a result each.` : `About ${wordCount} words. Early in a career one page (roughly 400–750 words) is the norm; cut the oldest and least relevant lines first.` })
  const long = b.filter((x) => words(x).length > 30)
  const short = b.filter((x) => words(x).length < 5)
  specs.push({ id: 'bullet-length', group: 'brevity', weight: 2, label: 'Bullet length', score: clamp(1 - share(long.length + short.length, b.length) * 3), lines: [...long, ...short], rewritable: true, tip: 'One to two lines per bullet (about 10–25 words). Longer ones get skipped; very short ones say too little.' })
  const filler = b.filter((x) => containsAny(x, FILLER).length)
  specs.push({ id: 'filler', group: 'brevity', weight: 1, label: 'Filler words', score: clamp(1 - share(filler.length, b.length) * 4), lines: filler, rewritable: true, tip: 'Words like "very", "various" and "successfully" take space and add nothing. Cut them or replace them with a number.' })
  specs.push({ id: 'bullets', group: 'brevity', weight: 2, label: 'Bullet points', score: b.length >= 5 ? 1 : b.length >= 3 ? 0.6 : 0, tip: b.length ? `${b.length} bullet${b.length === 1 ? '' : 's'} found. Use 2–5 bullets under each role or project so a recruiter can skim.` : 'No bullet points found. Paragraphs are hard to skim; break each role into 2–5 bullets.' })

  // Style
  const buzz = lines.filter((x) => buzzwordsIn(x).length)
  specs.push({ id: 'buzzwords', group: 'style', weight: 2, label: 'Buzzwords and clichés', score: clamp(1 - buzz.length * 0.25), lines: buzz, rewritable: true, tip: '"Team player", "motivated" and "results-oriented" are on every CV, so they tell a recruiter nothing. Show the trait with something you did.' })
  const pronouns = lines.filter((x) => PRONOUN.test(x))
  specs.push({ id: 'pronouns', group: 'style', weight: 1, label: 'No personal pronouns', score: clamp(1 - pronouns.length * 0.25), lines: pronouns, rewritable: true, tip: 'A CV drops "I" and "my": start each line with the verb instead.' })
  const passive = b.filter((x) => PASSIVE.test(x))
  specs.push({ id: 'passive', group: 'style', weight: 1, label: 'Active voice', score: clamp(1 - share(passive.length, b.length) * 4), lines: passive, rewritable: true, tip: '"Was awarded", "were analysed": passive voice hides who did the work. Make yourself the subject.' })
  // One stray "August 2026" in a sentence is not a second format; two or more are.
  const counts = DATE_FORMS.map(([n, re]) => [n, (all.match(re) ?? []).length] as const).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  const forms = counts.filter(([, n], i) => i === 0 || n >= 2)
  const anyYear = /\b(?:19|20)\d{2}\b/.test(all)
  specs.push({ id: 'dates', group: 'style', weight: 1, label: 'Dates', score: !anyYear ? 0 : forms.length > 1 ? 0.5 : 1, tip: !anyYear ? 'No dates found. Put a start and end date next to every role and degree.' : forms.length > 1 ? `Dates are written in more than one way (${forms.map(([n]) => n).join(', ')}). Pick one format, e.g. "Sep 2024 – Jun 2025".` : 'Dates are written consistently.' })
  const missing = [EMAIL.test(all) ? '' : 'email', PHONE.test(all) ? '' : 'phone number', LINKEDIN.test(all) ? '' : 'LinkedIn URL'].filter(Boolean)
  specs.push({ id: 'contact', group: 'style', weight: 2, label: 'Contact details', score: 1 - missing.length / 3, tip: missing.length ? `Missing: ${missing.join(', ')}. Put them in the header so a recruiter can reach you.` : 'Email, phone and LinkedIn are all there.' })

  // Sections
  const core = (['experience', 'education', 'skills'] as const).filter((s) => !sections.has(s) && !(s === 'experience' && sections.has('projects')))
  specs.push({ id: 'sections', group: 'sections', weight: 2, label: 'Standard sections', score: 1 - core.length / 3, tip: core.length ? `No ${core.join(', ')} heading found. Applicant tracking systems look for standard headings; name them plainly.` : 'Experience, Education and Skills headings are all there.' })
  const personal = lines.filter((x) => containsAny(x, PERSONAL_DETAILS).length || /\b(?:photo|foto)\b/i.test(x))
  const refs = lines.filter((x) => containsAny(x, REFERENCES).length) // a References heading with names under it is fine
  specs.push({ id: 'unnecessary', group: 'sections', weight: 1, label: 'Nothing unnecessary', score: clamp(1 - (personal.length + refs.length) * 0.34), lines: [...personal, ...refs], tip: 'Date of birth, marital status, nationality and a photo invite bias and are not needed in most of Europe; "references on request" goes without saying. Remove them.' })
  const summary = sections.get('summary') ?? []
  const summaryWords = words(summary.join(' ')).length
  specs.push({ id: 'summary', group: 'sections', weight: 1, label: 'Short summary', score: summaryWords > 80 ? 0.4 : 1, lines: summaryWords > 80 ? summary : [], tip: summaryWords > 80 ? `The summary is about ${summaryWords} words. Two lines (under 50 words) on what you do and what you want next is enough.` : summaryWords ? 'The summary is short.' : 'No summary, which is fine early in a career.' })
  if (profile?.skills.length) {
    const absent = profile.skills.filter((s) => !hasPhrase(all, s))
    specs.push({ id: 'badge-skills', group: 'sections', weight: 1, label: 'Skills from your profile', score: 1 - share(absent.length, profile.skills.length), tip: absent.length ? `On your profile but not in this CV: ${absent.slice(0, 8).join(', ')}. Add the ones you can back with a bullet.` : 'Every skill on your profile appears in this CV.' })
  }

  const checks: CvCheck[] = specs.map(({ weight: _w, lines: ls = [], rewritable = false, ...c }) => {
    const pass = c.score >= PASS_AT
    return { ...c, score: Math.round(c.score * 100) / 100, pass, lines: pass ? [] : [...new Set(ls)].slice(0, MAX_LINES), rewritable }
  })
  const total = specs.reduce((n, s) => n + s.weight, 0)
  const score = Math.round((100 * specs.reduce((n, s) => n + s.weight * s.score, 0)) / total)
  return { score, band: bandOf(score), words: wordCount, bullets: b.length, checks }
}

export const summarize = (r: CvReview, at = new Date()): CvReviewSummary => ({ score: r.score, at: at.toISOString(), failed: r.checks.filter((c) => !c.pass).map((c) => c.id) })

// ---- Job match ----

export type KeywordMatch = { matched: string[]; missing: string[]; pct: number }

/** Posting keywords found word-for-word in the CV; pct is the share matched, 0..100. */
export function matchKeywords(cv: string, keywords: string[]): KeywordMatch {
  const seen = new Set<string>()
  // Clichés ("team player") are left out: the CV score tells the seeker to cut them, so the match must not ask for them.
  const uniq = keywords.map((k) => k.trim()).filter((k) => fold(k) && !buzzwordsIn(k).length && !seen.has(fold(k)) && seen.add(fold(k)))
  const matched = uniq.filter((k) => hasPhrase(cv, k))
  return { matched, missing: uniq.filter((k) => !matched.includes(k)), pct: uniq.length ? Math.round((100 * matched.length) / uniq.length) : 0 }
}
