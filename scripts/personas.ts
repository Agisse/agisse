// The 12 synthetic seekers the feed eval (scripts/eval-feed.ts) ranks roles for, and how it scores their top 30.
// Every persona is made up and uses @example.com. Never add real seekers.
import type { VacancyFunction } from '../shared/listings'

export type Persona = { slug: string; headline: string; degree: string; targetIndustries: string[]; countries: string[]; fields: VacancyFunction[] }

export const PERSONAS: Persona[] = [
  { slug: 'nursing', headline: 'Nursing graduate', degree: 'BSc Nursing', targetIndustries: ['Healthcare', 'Hospitals'], countries: ['NL', 'BE'], fields: ['healthcare'] },
  { slug: 'civil-engineer', headline: 'Civil engineer', degree: 'MSc Civil Engineering', targetIndustries: ['Construction', 'Infrastructure'], countries: ['DE', 'AT', 'CH'], fields: ['engineering'] },
  { slug: 'law', headline: 'Law graduate, trainee solicitor', degree: 'LLB Law', targetIndustries: ['Law firms'], countries: ['GB', 'IE'], fields: ['legal'] },
  { slug: 'data-scientist', headline: 'Data scientist', degree: 'MSc Statistics', targetIndustries: ['Tech', 'Research'], countries: ['FR', 'BE', 'LU'], fields: ['data', 'software'] },
  { slug: 'marketing', headline: 'Marketing and communications graduate', degree: 'BA Marketing and Communication', targetIndustries: ['Media', 'Consumer brands'], countries: ['ES', 'PT'], fields: ['marketing', 'media'] },
  { slug: 'pharmacist', headline: 'Pharmacist and chemist', degree: 'MSc Pharmaceutical Sciences', targetIndustries: ['Pharma', 'Life sciences'], countries: ['CH', 'DE'], fields: ['science', 'healthcare'] },
  { slug: 'teacher', headline: 'Secondary-school teacher', degree: 'MA Teaching (Secondary Education)', targetIndustries: ['Education'], countries: ['BE', 'NL'], fields: ['education'] },
  { slug: 'eu-affairs', headline: 'EU affairs and public policy graduate', degree: 'MA European Public Policy', targetIndustries: ['EU institutions', 'Public affairs'], countries: ['BE', 'LU'], fields: ['policy', 'consulting'] },
  { slug: 'architect', headline: 'Architect', degree: 'MArch Architecture', targetIndustries: ['Architecture', 'Construction'], countries: ['IT', 'ES'], fields: ['design', 'engineering'] },
  { slug: 'auditor', headline: 'Accountant and auditor', degree: 'MSc Accounting and Finance', targetIndustries: ['Audit', 'Corporate finance'], countries: ['PL', 'CZ'], fields: ['audit', 'corp_finance'] },
  { slug: 'ux-designer', headline: 'UX and product designer', degree: 'MA Interaction Design', targetIndustries: ['Tech', 'Startups'], countries: ['SE', 'DK', 'FI'], fields: ['design', 'product'] },
  { slug: 'supply-chain', headline: 'Supply chain and logistics graduate', degree: 'MSc Supply Chain Management', targetIndustries: ['Logistics', 'Manufacturing'], countries: ['NL', 'DE', 'CZ'], fields: ['ops'] },
]

// Title stems per field, in the languages postings use; a title word matches a stem it contains, so compounds count (short stems: whole word).
// ponytail: hand-picked stems, so some on-field titles are missed and some off-field ones counted; good enough to compare runs.
export const FIELD_WORDS: Partial<Record<VacancyFunction, string[]>> = {
  healthcare: ['nurs', 'verpleeg', 'zorg', 'infirmi', 'pflege', 'health', 'clinic', 'klinik', 'medic', 'hospital', 'ziekenhuis', 'patient', 'pharmac', 'apothe', 'sante', 'arzt'],
  engineering: ['engineer', 'ingenieur', 'ingegner', 'ingenier', 'civil', 'bau', 'construct', 'struct', 'techni', 'mechan', 'electr', 'elektr', 'konstrukt', 'manufactur'],
  legal: ['law', 'lawyer', 'legal', 'solicitor', 'paralegal', 'jurist', 'juridi', 'counsel', 'attorney', 'barrister', 'rechts', 'advoca', 'avocat', 'notar'],
  data: ['data', 'analyst', 'analy', 'statist', 'machine', 'scien', 'ai', 'ml'],
  software: ['software', 'develop', 'entwickl', 'ontwikkel', 'developp', 'programm', 'backend', 'frontend', 'fullstack', 'it', 'devops', 'cloud', 'web', 'python', 'java'],
  marketing: ['market', 'brand', 'communic', 'kommunik', 'comunica', 'social', 'content', 'pr', 'seo', 'campaign', 'growth', 'digital', 'publicid', 'advertis'],
  media: ['media', 'journal', 'editor', 'redac', 'redak', 'content', 'video', 'press', 'comunica'],
  science: ['scien', 'chemi', 'chim', 'quim', 'lab', 'research', 'forsch', 'onderzoek', 'recherche', 'pharm', 'biolog', 'phd', 'physic', 'doctora'],
  education: ['teach', 'leraar', 'leerkracht', 'lecturer', 'dozent', 'insegnant', 'profesor', 'docente', 'docent', 'onderwij', 'enseign', 'professeur', 'lehr', 'educat', 'tutor', 'school', 'pedagog'],
  policy: ['policy', 'policies', 'public', 'affairs', 'govern', 'regulat', 'eu', 'polit', 'advocacy', 'parliament', 'beleid', 'institution'],
  consulting: ['consult', 'advis', 'berat', 'conseil'],
  design: ['design', 'ux', 'ui', 'architet', 'architect', 'arquitect', 'interaction', 'visual', 'graphic', 'creative', 'cad', 'bim', 'urban'],
  audit: ['audit', 'account', 'tax', 'assurance', 'ksiegow', 'rewident', 'ucet', 'controll', 'revisor', 'steuer'],
  corp_finance: ['financ', 'finanz', 'finans', 'financn', 'controll', 'treasury', 'fp', 'budget', 'account'],
  product: ['product', 'produkt', 'pm'],
  ops: ['logist', 'supply', 'chain', 'operat', 'procure', 'purchas', 'warehouse', 'transport', 'planner', 'planning', 'inkoop', 'einkauf', 'lager', 'demand', 'inventory', 'shipping', 'sourcing', 'distribution'],
}

const words = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)

/** True when a title word contains one of the fields' stems (stems of 3 letters or fewer must be the whole word). */
export function titleOnField(title: string, fields: string[]): boolean {
  const stems = fields.flatMap((f) => FIELD_WORDS[f as VacancyFunction] ?? [])
  return words(title).some((w) => stems.some((s) => w === s || (s.length > 3 && w.includes(s))))
}

export const TARGETS = { roles: 200, onField: 0.8, employers: 15 }

export type FeedMetrics = { roles: number; top: number; onFieldFunctions: number; onFieldTitle: number; employers: number; pass: boolean }

/** The eval's numbers for one persona's first page: `total` roles pass the filters, `top` is the ranked first page. */
export function feedMetrics(total: number, top: { title: string; company: string; functions: string[] }[], fields: string[]): FeedMetrics {
  const share = (n: number) => (top.length ? Math.round((100 * n) / top.length) / 100 : 0)
  const onFieldFunctions = share(top.filter((r) => r.functions.some((f) => fields.includes(f))).length)
  const onFieldTitle = share(top.filter((r) => titleOnField(r.title, fields)).length)
  const employers = new Set(top.map((r) => r.company.trim().toLowerCase())).size
  const pass = total >= TARGETS.roles && Math.min(onFieldFunctions, onFieldTitle) >= TARGETS.onField && employers >= TARGETS.employers
  return { roles: total, top: top.length, onFieldFunctions, onFieldTitle, employers, pass }
}
