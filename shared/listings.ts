export type Provider = 'greenhouse' | 'lever' | 'ashby' | 'personio' | 'recruitee' | 'workable' | 'smartrecruiters' | 'adzuna' | 'arbeitnow' | 'feed'

export type Listing = {
  provider: Provider
  company: string
  title: string
  location: string
  url: string
  text: string
  /** The source says the role is remote; otherwise guessed from the title and location. */
  remote?: boolean
  /** Top of the advertised range, per year in local currency, when the source gives one. */
  salaryMax?: number | null
}

export type ListingBoard = { provider: Exclude<Provider, 'adzuna' | 'arbeitnow' | 'feed'>; url: string }

export const ADZUNA_COUNTRIES = {
  at: 'Austria',
  au: 'Australia',
  be: 'Belgium',
  br: 'Brazil',
  ca: 'Canada',
  ch: 'Switzerland',
  de: 'Germany',
  es: 'Spain',
  fr: 'France',
  gb: 'United Kingdom',
  in: 'India',
  it: 'Italy',
  nl: 'Netherlands',
  nz: 'New Zealand',
  pl: 'Poland',
  sg: 'Singapore',
  us: 'United States',
  za: 'South Africa',
} as const

/** Adzuna countries the job feed offers: Europe only. */
export const EU_COUNTRIES = ['at', 'be', 'ch', 'de', 'es', 'fr', 'gb', 'it', 'nl', 'pl'] as const satisfies readonly (keyof typeof ADZUNA_COUNTRIES)[]

const LEGAL_SUFFIXES = new Set(['ab', 'ag', 'as', 'bv', 'co', 'company', 'corp', 'corporation', 'gmbh', 'group', 'holding', 'holdings', 'inc', 'incorporated', 'kft', 'kk', 'llc', 'limited', 'ltd', 'nv', 'oy', 'plc', 'pte', 'pty', 'sa', 'sas', 'se', 'spa', 'srl', 'sro'])

/** Likely public-board slugs, ordered from the company name to its website. */
export function slugGuesses(name: string, domain?: string | null): string[] {
  const words = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  // SmartRecruiters ids often keep the suffix ("BoschGroup"), so the full name is the last guess.
  const full = words.join('')
  while (words.length > 1 && LEGAL_SUFFIXES.has(words.at(-1)!)) words.pop()
  const domainLabel = domain
    ? domain
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, '')
        .split(/[./]/)[0]
        ?.toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
    : ''
  return [...new Set([words.join(''), words.join('-'), domainLabel, full].filter(Boolean))].slice(0, 4)
}

const ENTITIES: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' }
function decodeEntities(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const hex = code[1]?.toLowerCase() === 'x'
      const n = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10)
      return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole
    }
    return ENTITIES[code.toLowerCase()] ?? whole
  })
}

/** Converts provider HTML into compact posting text without requiring a DOM. */
export function htmlToText(html: string): string {
  // Greenhouse content commonly contains one escaped HTML layer inside JSON.
  const markup = /&lt;\/?[a-z][\s\S]*?&gt;/i.test(html) ? decodeEntities(html) : html
  return decodeEntities(
    markup
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\s*li(?:\s[^>]*)?>/gi, '\n- ')
      .replace(/<\s*\/(?:address|article|blockquote|div|h[1-6]|li|ol|p|section|table|tr|ul)\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

type UnknownRow = Record<string, unknown>
const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const at = (row: UnknownRow, key: string) => (row[key] && typeof row[key] === 'object' ? (row[key] as UnknownRow) : {})

export function fromGreenhouse(row: UnknownRow, company: string): Listing | null {
  const url = str(row.absolute_url)
  const title = str(row.title)
  if (!url || !title) return null
  return { provider: 'greenhouse', company, title, location: str(at(row, 'location').name), url, text: htmlToText(str(row.content)) }
}

export function fromLever(row: UnknownRow, company: string): Listing | null {
  const url = str(row.hostedUrl)
  const title = str(row.text)
  if (!url || !title) return null
  const lists = Array.isArray(row.lists)
    ? row.lists.map((item) => (item && typeof item === 'object' ? `${str((item as UnknownRow).text)}\n${htmlToText(str((item as UnknownRow).content))}` : '')).filter(Boolean)
    : []
  const text = [str(row.descriptionPlain), ...lists, str(row.additionalPlain)].filter(Boolean).join('\n\n')
  return { provider: 'lever', company, title, location: str(at(row, 'categories').location), url, text }
}

export function fromAshby(row: UnknownRow, company: string): Listing | null {
  if (row.isListed === false) return null
  const url = str(row.jobUrl)
  const title = str(row.title)
  if (!url || !title) return null
  return { provider: 'ashby', company, title, location: str(row.location), url, text: str(row.descriptionPlain) || htmlToText(str(row.descriptionHtml) || str(row.description)) }
}

export function fromAdzuna(row: UnknownRow): Listing | null {
  const rawUrl = str(row.redirect_url)
  const title = str(row.title)
  if (!rawUrl || !title) return null
  let url = rawUrl
  try {
    const parsed = new URL(rawUrl)
    parsed.search = ''
    parsed.hash = ''
    url = parsed.toString()
  } catch {
    // Keep the provider value if it is unexpectedly not a URL.
  }
  const salaryMax = typeof row.salary_max === 'number' ? row.salary_max : null
  return { provider: 'adzuna', company: str(at(row, 'company').display_name), title, location: str(at(row, 'location').display_name), url, text: str(row.description), salaryMax }
}

export function fromArbeitnow(row: UnknownRow): Listing | null {
  const url = str(row.url)
  const title = str(row.title)
  if (!url || !title) return null
  const tags = Array.isArray(row.tags) ? row.tags.filter((t): t is string => typeof t === 'string') : []
  const text = [htmlToText(str(row.description)), tags.length ? `Tags: ${tags.join(', ')}` : ''].filter(Boolean).join('\n\n')
  return { provider: 'arbeitnow', company: str(row.company_name), title, location: str(row.location), url, text, remote: row.remote === true }
}

/** Arbeitnow's free public feed: the latest few hundred European (mostly German) roles, no key. Runs in the browser: it allows CORS. */
export async function fetchArbeitnow(signal: AbortSignal): Promise<Listing[]> {
  const res = await fetch('https://www.arbeitnow.com/api/job-board-api', { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) })
  if (!res.ok) throw new Error(`Arbeitnow ${res.status}`)
  const data = (await res.json()) as { data?: UnknownRow[] }
  return (data.data ?? []).map(fromArbeitnow).filter((x): x is Listing => !!x)
}

// ---- Job feed: filter and rank listings against the seeker's dealbreakers and profile. No model call.

export const FEED_LEVELS = ['any', 'internship', 'entry', 'experienced'] as const
export type FeedLevel = (typeof FEED_LEVELS)[number]
/**
 * The seeker's dealbreakers. functions/industries/languages filter the scraped vacancy feed (empty = no filter);
 * languages are the ones the seeker speaks, so a posting that asks for another one is hidden.
 */
export type FeedPrefs = {
  query: string
  countries: string[]
  level: FeedLevel
  remoteOnly: boolean
  minSalary: number | null
  functions: string[]
  industries: string[]
  languages: string[]
  /** Employers the seeker never wants to see, as named in the feed (matched case-insensitively). */
  blocked: string[]
  /** Only employers on a public visa-sponsor register (NL, UK). */
  sponsorsOnly: boolean
  /** Programme types (PROGRAM_LABEL keys); empty = any. */
  programs: string[]
}
export const EMPTY_FEED_PREFS: FeedPrefs = { query: '', countries: [], level: 'any', remoteOnly: false, minSalary: null, functions: [], industries: [], languages: [], blocked: [], sponsorsOnly: false, programs: [] }

/** True when the seeker hid this employer. */
export const isBlocked = (company: string, prefs: Pick<FeedPrefs, 'blocked'>) => (prefs.blocked ?? []).some((b) => b.trim().toLowerCase() === company.trim().toLowerCase())

// ---- Vacancy feed: early-career European roles a feed provider writes into the `vacancy` table (docs/feed-contract.md).

/** EU27 + EEA + UK + CH, as ISO codes (upper case, as stored). */
export const VACANCY_COUNTRIES = {
  AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', HR: 'Croatia', CY: 'Cyprus', CZ: 'Czechia', DK: 'Denmark', EE: 'Estonia',
  FI: 'Finland', FR: 'France', DE: 'Germany', GR: 'Greece', HU: 'Hungary', IE: 'Ireland', IT: 'Italy', LV: 'Latvia',
  LT: 'Lithuania', LU: 'Luxembourg', MT: 'Malta', NL: 'Netherlands', PL: 'Poland', PT: 'Portugal', RO: 'Romania',
  SK: 'Slovakia', SI: 'Slovenia', ES: 'Spain', SE: 'Sweden', IS: 'Iceland', LI: 'Liechtenstein', NO: 'Norway',
  CH: 'Switzerland', GB: 'United Kingdom', EU: 'Remote in Europe',
} as const
export type VacancyCountry = keyof typeof VACANCY_COUNTRIES

export const VACANCY_FUNCTIONS = {
  ib: 'Investment banking', 'm&a': 'M&A & transactions', pe_vc: 'Private equity & VC', asset_mgmt: 'Asset & wealth management',
  sales_trading: 'Sales & trading', risk: 'Risk & compliance', audit: 'Audit, tax & accounting', corp_finance: 'Corporate finance & FP&A',
  consulting: 'Consulting', strategy: 'Strategy & BizOps', ops: 'Operations & logistics', data: 'Data & analytics', product: 'Product',
  sales: 'Sales & partnerships', marketing: 'Marketing & growth', software: 'Software & IT', engineering: 'Engineering',
  legal: 'Law & legal', science: 'Science & research', healthcare: 'Healthcare & medicine', hr: 'HR & recruiting',
  design: 'Design & architecture', policy: 'Policy & public sector', education: 'Teaching & education', media: 'Media & journalism',
  sustainability: 'Sustainability & environment',
} as const
export type VacancyFunction = keyof typeof VACANCY_FUNCTIONS

export const VACANCY_INDUSTRIES = {
  investment_banking: 'Investment banks', banking: 'Banks', asset_management: 'Asset managers', private_equity: 'Private equity',
  venture_capital: 'Venture capital', consulting: 'Consulting', audit_advisory: 'Big Four & advisory', insurance: 'Insurance',
  market_infrastructure: 'Exchanges, data & trading', fintech: 'Fintech', payments: 'Payments', startup: 'Startups & scale-ups',
  corporate: 'Corporates', tech: 'Big tech', energy: 'Energy', real_estate: 'Real estate', public: 'Central & public banks',
  law: 'Law firms', engineering: 'Engineering & construction', industrial: 'Industrial & manufacturing', automotive: 'Automotive & mobility',
  aerospace_defence: 'Aerospace, space & defence', semiconductors: 'Semiconductors & hardware', pharma: 'Pharma & life sciences',
  healthcare: 'Healthcare & medtech', chemicals: 'Chemicals & materials', it_services: 'IT services', logistics: 'Logistics & transport',
  research: 'Research institutes', government: 'EU institutions & government', ngo: 'NGOs & international orgs', media: 'Media & creative',
} as const
export type VacancyIndustry = keyof typeof VACANCY_INDUSTRIES

export const PROGRAM_LABEL: Record<string, string> = {
  internship: 'Internship', off_cycle: 'Off-cycle internship', summer: 'Summer internship', insight: 'Spring / insight week',
  graduate_programme: 'Graduate programme', junior: 'Junior role',
}

/** Languages a seeker can say they speak (the scraper's lowercase English names). */
export const SPOKEN_LANGUAGES = ['english', 'french', 'dutch', 'german', 'spanish', 'italian', 'portuguese', 'polish', 'swedish', 'danish', 'norwegian', 'finnish', 'czech', 'hungarian', 'romanian', 'greek'] as const

export type Vacancy = {
  url: string
  title: string
  company: string
  domain: string | null
  location: string | null
  country: string | null
  city: string | null
  remote: boolean
  level: 'internship' | 'entry' | null
  program: string | null
  functions: string[]
  industry: string | null
  deadline: string | null
  deadlineType: 'explicit' | 'rolling' | 'unknown'
  firstSeen: string
  /** Last day the scraper still found the posting live. */
  lastSeen: string
  description: string | null
  /** 0–100, how well it fits the seeker's profile and preferences. */
  score: number
  /** Public visa-sponsor registers that list the employer by name (shared/sponsors.ts). */
  sponsors: Array<'NL' | 'GB'>
  reasons: string[]
}
export type VacancySort = 'match' | 'new' | 'deadline'
export type VacancyFacets = { total: number; countries: Record<string, number>; functions: Record<string, number>; industries: Record<string, number>; levels: Record<string, number>; programs: Record<string, number> }

const DAY = 86_400_000
/** Whole days from today (local) to a yyyy-mm-dd date; negative once passed. */
const daysUntil = (date: string, today: Date) => Math.round((Date.parse(date.slice(0, 10)) - Date.parse(today.toLocaleDateString('en-CA'))) / DAY)

/** A feed row's deadline in words, and how loudly to show it: red ≤ 2 days or passed, amber ≤ 7, nothing when unknown (most rows). */
export function deadlineLabel(v: Pick<Vacancy, 'deadline' | 'deadlineType'>, today = new Date()): { text: string; tone: 'red' | 'amber' | 'plain' | 'muted' } {
  if (!v.deadline) return v.deadlineType === 'rolling' ? { text: 'Rolling', tone: 'plain' } : { text: '', tone: 'muted' }
  const days = daysUntil(v.deadline, today)
  if (days < 0) return { text: 'Closed', tone: 'red' }
  if (days <= 7) return { text: days === 0 ? 'Closes today' : days === 1 ? 'Closes tomorrow' : `Closes in ${days} days`, tone: days <= 2 ? 'red' : 'amber' }
  const d = new Date(`${v.deadline.slice(0, 10)}T12:00:00`)
  const sameYear = d.getFullYear() === today.getFullYear()
  return { text: `Closes ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })}`, tone: 'plain' }
}

/** One row per employer: later roles at the same company fold under its first (best-ranked) one, in order. */
export function groupByCompany<T extends { company: string }>(items: T[]): { lead: T; rest: T[] }[] {
  const groups = new Map<string, { lead: T; rest: T[] }>()
  for (const it of items) {
    const key = it.company.trim().toLowerCase()
    const g = groups.get(key)
    if (g) g.rest.push(it)
    else groups.set(key, { lead: it, rest: [] })
  }
  return [...groups.values()]
}
export type FeedItem = { listing: Listing; level: Exclude<FeedLevel, 'any'> | null; remote: boolean; matched: string[] }

// European words for the level in a title. First match wins, so an internship is never read as entry level.
const LEVELS: [Exclude<FeedLevel, 'any'>, RegExp][] = [
  ['internship', /\b(intern|internship|stage|stagiair|stagiaire|praktikum|praktikant(in)?|werkstudent(in)?|working student|tirocinio|tirocinante|pr[aá]cticas|becari[oa]|sta[zż]ysta|praktyk[ai])\b/i],
  ['entry', /\b(junior|jr\.?|graduate|new grad|entry[- ]level|trainee|starter|absolvent(in)?|berufseinsteiger(in)?|alternance|alternant|apprenti|apprentice|young professional)\b/i],
  ['experienced', /\b(senior|sr\.?|lead|principal|staff|head of|director|vp|ii|iii|iv)\b/i],
]
const REMOTE = /\b(remote|home ?office|thuiswerk|t[ée]l[ée]travail|full[- ]remote|telework)\b/i

export function levelOf(title: string): FeedItem['level'] {
  return LEVELS.find(([, re]) => re.test(title))?.[0] ?? null
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const mentions = (term: string, text: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(term)}($|[^\\p{L}\\p{N}])`, 'iu').test(text)

/**
 * Keeps listings that pass the dealbreakers, best first. The query must appear in the title or text;
 * the rank counts query words in the title (×3) and the seeker's skills and target industries anywhere.
 * An unknown salary or level passes: most European postings state neither.
 */
export function matchFeed(listings: Listing[], prefs: FeedPrefs, terms: string[]): FeedItem[] {
  const words = prefs.query.toLowerCase().split(/[^\p{L}\p{N}+#]+/u).filter((w) => w.length >= 2)
  const scored = listings.flatMap((listing) => {
    if (isBlocked(listing.company, prefs)) return []
    const body = `${listing.title}\n${listing.text}`
    if (words.length && !words.some((w) => mentions(w, body))) return []
    const level = levelOf(listing.title)
    if (prefs.level === 'internship' && level !== 'internship') return []
    if (prefs.level === 'entry' && (level === 'internship' || level === 'experienced')) return []
    if (prefs.level === 'experienced' && (level === 'internship' || level === 'entry')) return []
    const remote = listing.remote ?? REMOTE.test(`${listing.title} ${listing.location}`)
    if (prefs.remoteOnly && !remote) return []
    if (prefs.minSalary && listing.salaryMax && listing.salaryMax < prefs.minSalary) return []
    const matched = [...new Set(terms.filter((t) => t.trim() && mentions(t.trim(), body)))]
    const score = 3 * words.filter((w) => mentions(w, listing.title)).length + matched.length + (prefs.level !== 'any' && level === prefs.level ? 2 : 0)
    return [{ item: { listing, level, remote, matched }, score }]
  })
  const unique = new Map<string, (typeof scored)[number]>()
  for (const s of scored) if (!unique.has(s.item.listing.url)) unique.set(s.item.listing.url, s)
  return [...unique.values()].sort((a, b) => b.score - a.score).map((s) => s.item)
}

export function fromRecruitee(row: UnknownRow, company: string): Listing | null {
  const url = str(row.careers_url)
  const title = str(row.title)
  if (!url || !title) return null
  return { provider: 'recruitee', company, title, location: str(row.location), url, text: [htmlToText(str(row.description)), htmlToText(str(row.requirements))].filter(Boolean).join('\n\n') }
}

export function fromWorkable(row: UnknownRow, company: string): Listing | null {
  const url = str(row.url)
  const title = str(row.title)
  if (!url || !title) return null
  const location = row.telecommuting === true ? 'Remote' : [str(row.city), str(row.country)].filter(Boolean).join(', ')
  return { provider: 'workable', company, title, location, url, text: htmlToText(str(row.description)) }
}

/** The postings list has no description; evaluating reads the posting page instead. */
export function fromSmartRecruiters(row: UnknownRow, company: string): Listing | null {
  const id = str(row.id)
  const title = str(row.name)
  const identifier = str(at(row, 'company').identifier)
  if (!id || !title || !identifier) return null
  const where = at(row, 'location')
  const location = where.remote === true ? 'Remote' : [str(where.city), str(where.country).toUpperCase()].filter(Boolean).join(', ')
  return { provider: 'smartrecruiters', company, title, location, url: `https://jobs.smartrecruiters.com/${identifier}/${id}`, text: '' }
}

const xmlTag = (xml: string, tag: string) => xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1]?.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim() ?? ''

/** Personio's public XML feed: one <position> per role, its description split into named sections. */
export function fromPersonio(xml: string, slug: string, company: string): Listing[] {
  return [...xml.matchAll(/<position>([\s\S]*?)<\/position>/g)].flatMap(([, block]) => {
    const id = xmlTag(block, 'id')
    const title = decodeEntities(xmlTag(block, 'name'))
    if (!id || !title) return []
    const sections = [...block.matchAll(/<jobDescription>([\s\S]*?)<\/jobDescription>/g)].map(([, d]) => `${decodeEntities(xmlTag(d, 'name'))}\n${htmlToText(xmlTag(d, 'value'))}`)
    return [{ provider: 'personio' as const, company, title, location: decodeEntities(xmlTag(block, 'office')), url: `https://${slug}.jobs.personio.de/job/${id}`, text: sections.join('\n\n') }]
  })
}

type Board = { provider: ListingBoard['provider']; api: (slug: string) => string; board: (slug: string) => string; parse: (body: string, slug: string, company: string) => Listing[] }

const rows = (body: string, key?: string): UnknownRow[] => {
  const data = JSON.parse(body) as unknown
  const list = key ? (data as UnknownRow | null)?.[key] : data
  return Array.isArray(list) ? list : []
}
const keep = (x: Listing | null): x is Listing => !!x

const BOARDS: Board[] = [
  { provider: 'greenhouse', api: (s) => `https://boards-api.greenhouse.io/v1/boards/${s}/jobs?content=true`, board: (s) => `https://boards.greenhouse.io/${s}`, parse: (b, _, c) => rows(b, 'jobs').map((r) => fromGreenhouse(r, c)).filter(keep) },
  { provider: 'lever', api: (s) => `https://api.lever.co/v0/postings/${s}?mode=json`, board: (s) => `https://jobs.lever.co/${s}`, parse: (b, _, c) => rows(b).map((r) => fromLever(r, c)).filter(keep) },
  { provider: 'ashby', api: (s) => `https://api.ashbyhq.com/posting-api/job-board/${s}`, board: (s) => `https://jobs.ashbyhq.com/${s}`, parse: (b, _, c) => rows(b, 'jobs').map((r) => fromAshby(r, c)).filter(keep) },
  { provider: 'recruitee', api: (s) => `https://${s}.recruitee.com/api/offers/`, board: (s) => `https://${s}.recruitee.com`, parse: (b, _, c) => rows(b, 'offers').map((r) => fromRecruitee(r, c)).filter(keep) },
  { provider: 'workable', api: (s) => `https://apply.workable.com/api/v1/widget/accounts/${s}?details=true`, board: (s) => `https://apply.workable.com/${s}`, parse: (b, _, c) => rows(b, 'jobs').map((r) => fromWorkable(r, c)).filter(keep) },
  { provider: 'smartrecruiters', api: (s) => `https://api.smartrecruiters.com/v1/companies/${s}/postings?limit=100`, board: (s) => `https://careers.smartrecruiters.com/${s}`, parse: (b, _, c) => rows(b, 'content').map((r) => fromSmartRecruiters(r, c)).filter(keep) },
  // A slug Personio doesn't know redirects to its homepage, which has no <position>.
  { provider: 'personio', api: (s) => `https://${s}.jobs.personio.de/xml`, board: (s) => `https://${s}.jobs.personio.de`, parse: (b, s, c) => fromPersonio(b, s, c) },
]

type Probe = { listings: Listing[]; board?: ListingBoard }

async function probe(board: Board, slug: string, company: string, signal: AbortSignal): Promise<Probe> {
  const res = await fetch(board.api(encodeURIComponent(slug)), { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) })
  if (res.status === 404) return { listings: [] }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const listings = board.parse(await res.text(), slug, company)
  return { listings, ...(listings.length ? { board: { provider: board.provider, url: board.board(slug) } } : {}) }
}

/** Probes likely slugs across the public ATS APIs. Runs in the browser: these APIs allow CORS. */
export async function findOpenRoles(name: string, domain: string | null | undefined, signal: AbortSignal): Promise<{ listings: Listing[]; boards: ListingBoard[]; unreachable: boolean }> {
  const probes = slugGuesses(name, domain).flatMap((slug) => BOARDS.map((board) => probe(board, slug, name, signal)))
  const settled = await Promise.allSettled(probes)
  if (signal.aborted) throw signal.reason
  const hits = settled.filter((r): r is PromiseFulfilledResult<Probe> => r.status === 'fulfilled').map((r) => r.value)
  const listings = [...new Map(hits.flatMap((r) => r.listings).map((r) => [r.url, r])).values()]
  const boards = [...new Map(hits.flatMap((r) => (r.board ? [r.board] : [])).map((r) => [r.url, r])).values()]
  return { listings, boards, unreachable: settled.length > 0 && hits.length === 0 }
}

// ---- Is a saved posting still open? (the daily check in the Worker's scheduled handler) ----

// Posting links on the boards above: [provider, pattern with the board slug and the posting id]. EU-hosted Lever is skipped.
const POSTING_LINKS: Array<[ListingBoard['provider'], RegExp]> = [
  ['greenhouse', /^https?:\/\/(?:boards|job-boards(?:\.eu)?)\.greenhouse\.io\/([^/?#]+)\/jobs\/(\d+)/i],
  ['lever', /^https?:\/\/jobs\.lever\.co\/([^/?#]+)\/([0-9a-f-]{20,})/i],
  ['ashby', /^https?:\/\/jobs\.ashbyhq\.com\/([^/?#]+)\/([0-9a-f-]{20,})/i],
  ['recruitee', /^https?:\/\/([^./]+)\.recruitee\.com\/o\/([^/?#]+)/i],
  ['workable', /^https?:\/\/apply\.workable\.com\/([^/?#]+)\/j\/([0-9A-F]+)/i],
  ['smartrecruiters', /^https?:\/\/jobs\.smartrecruiters\.com\/([^/?#]+)\/(\d+)/i],
  ['personio', /^https?:\/\/([^./]+)\.jobs\.personio\.(?:de|com)\/job\/(\d+)/i],
]

/** The public board a posting link belongs to, its slug and the posting's id; null for any other site. */
export function postingBoard(url: string): { board: Board; slug: string; id: string } | null {
  for (const [provider, re] of POSTING_LINKS) {
    const m = re.exec(url)
    const board = BOARDS.find((b) => b.provider === provider)
    if (m && board) return { board, slug: decodeURIComponent(m[1]!), id: m[2]! }
  }
  return null
}

/**
 * Whether the board still lists this posting: true, false, or null when it can't tell (not a known board,
 * the board is gone or unreachable, or a capped SmartRecruiters page). `cache` shares one fetch per board.
 */
export async function postingOpen(url: string, cache = new Map<string, Promise<Listing[] | null>>()): Promise<boolean | null> {
  const hit = postingBoard(url)
  if (!hit) return null
  const api = hit.board.api(encodeURIComponent(hit.slug))
  if (!cache.has(api)) {
    cache.set(
      api,
      fetch(api, { signal: AbortSignal.timeout(10_000) })
        .then(async (res) => (res.ok ? hit.board.parse(await res.text(), hit.slug, hit.slug) : null))
        .catch(() => null),
    )
  }
  const listings = await cache.get(api)!
  if (!listings) return null
  // The id as a whole token: posting 12 must not match posting 123.
  const id = new RegExp(`(^|[^0-9a-z])${escape(hit.id)}($|[^0-9a-z])`, 'i')
  if (listings.some((l) => id.test(l.url))) return true
  // ponytail: SmartRecruiters' page holds 100 postings; past that a missing id proves nothing. Paginate if it matters.
  return hit.board.provider === 'smartrecruiters' && listings.length >= 100 ? null : false
}

/** Scraped text as plain prose: drops markdown emphasis/headings and backslash escapes ("IT \& Cyber" → "IT & Cyber"). */
export const plainText = (s: string) => s.replace(/\\([&_*#%$()[\].-])/g, '$1').replace(/(\*\*|__)(.+?)\1/g, '$2').replace(/^#{1,6}\s+/gm, '')
