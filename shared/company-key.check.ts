// Run: npx tsx shared/company-key.check.ts
import { companyKey, companyNames } from './assessment-catalog.ts'
import { lastMonday, outcomeStats, type OutcomeRow } from './outcomes.ts'
import { testCounts, type TestReportRow } from './test-reports.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

// One employer, many spellings.
const same: [string, string][] = [
  ['KPMG Belgium', 'kpmg'],
  ['KPMG Advisory', 'kpmg'],
  ['kpmg', 'kpmg'],
  ['K.P.M.G. Advisory BV', 'kpmg'],
  ['PwC', 'pwc'],
  ['PricewaterhouseCoopers', 'pwc'],
  ['PwC Belgium', 'pwc'],
  ['Ernst & Young', 'ey'],
  ['EY-Parthenon', 'ey'],
  ['McKinsey & Company', 'mckinsey'],
  ['Boston Consulting Group', 'bcg'],
  ['J.P. Morgan', 'jpmorgan'],
  ['JPMorgan Chase & Co.', 'jpmorgan'],
  ['Bain & Co', 'bain'],
  ['Société Générale', 'societe generale'],
  ['Societe Generale SA', 'societe generale'],
  ['Proximus NV', 'proximus'],
  ['ING Belgium N.V.', 'ing'],
  ['Shell plc', 'shell'],
  ['Shell Belgium', 'shell'],
  ['  Accenture   Brussels ', 'accenture'],
  ['Allianz SE', 'allianz'],
  ['Siemens AG', 'siemens'],
  ['Telenet (Belgium)', 'telenet'],
  ['The Coca-Cola Company', 'coca cola'],
  ['Solvay S.A.', 'solvay'],
  ['Arcadis Global', 'arcadis'],
]
for (const [name, key] of same) eq(companyKey(name), key, name)

// Look alike, different employers.
const apart: [string, string][] = [
  ['Bain', 'Bain Capital'],
  ['EY', 'EYE'],
  ['Shell', 'Shelly'],
  ['Air France', 'Air Belgium'],
  ['Bank of Ireland', 'Bank of'],
  ['JPMorgan', 'Morgan Stanley'],
  ['ING', 'Ingenico'],
  ['Deloitte', 'Delhaize'],
  ['KBC', 'KBC Securities Services'],
]
for (const [a, b] of apart) if (companyKey(a) === companyKey(b)) throw new Error(`${a} and ${b} both key to ${companyKey(a)}`)
eq(companyKey('Bain Capital'), 'bain capital', 'Bain Capital is not Bain')
eq(companyKey('Air France'), 'air france', 'a generic first word keeps its place')

// Stable: a key keys to itself, so rows stored with it are found again.
for (const [name] of same) eq(companyKey(companyKey(name)), companyKey(name), `${name} twice`)
eq(companyNames('pwc'), ['pwc', 'pricewaterhousecoopers'], 'names behind pwc')
eq(companyNames('proximus'), ['proximus'], 'a firm with no aliases')

// Privacy: merging spellings never lowers the floors. A seeker counts once however many spellings they used.
const asOf = lastMonday(new Date('2026-10-16T15:00:00Z'))
const at = new Date(asOf.getTime() - 30 * 86_400_000).toISOString()
const job = (userId: string, company: string) => ({ userId, company, appliedAt: at, history: [{ status: 'applied' as const, at }] })
const kpmg = (rows: (OutcomeRow & { company: string })[]) => rows.filter((r) => companyKey(r.company) === 'kpmg')
const spellings = ['KPMG', 'KPMG Belgium', 'KPMG Advisory', 'kpmg bv']
const nine = Array.from({ length: 9 }, (_, i) => job(`u${i}`, spellings[i % 4]!))
eq(outcomeStats(kpmg([...nine, job('u0', 'KPMG Advisory'), job('u1', 'KPMG Belgium')]), asOf), null, '9 seekers over 11 merged jobs stay below k=10')
eq(outcomeStats(kpmg([...nine, job('u9', 'KPMG Brussels')]), asOf)?.applied, '10+', '10 distinct seekers across spellings show')
const bain = (rows: (OutcomeRow & { company: string })[]) => rows.filter((r) => companyKey(r.company) === 'bain')
eq(outcomeStats(bain([...nine.map((r) => ({ ...r, company: 'Bain & Company' })), job('x', 'Bain Capital')]), asOf), null, 'Bain Capital does not top up Bain')

const report = (userId: string, company: string): TestReportRow & { company: string } => ({ userId, company, detail: 'shl', createdAt: at, share: null })
const pwc = (rows: (TestReportRow & { company: string })[]) => rows.filter((r) => companyKey(r.company) === 'pwc')
eq(testCounts(pwc([report('a', 'PwC'), report('a', 'PricewaterhouseCoopers')]), asOf), [], 'one student under two spellings is still one: not shown')
eq(testCounts(pwc([report('a', 'PwC'), report('b', 'PricewaterhouseCoopers')]), asOf).length, 1, 'two students under two spellings show')
eq(testCounts(pwc([report('a', 'PwC'), report('b', 'EYE')]), asOf), [], 'a look-alike does not make two')
console.log('company-key ok')
