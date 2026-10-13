// Run: npx tsx scripts/personas.check.ts
import { VACANCY_COUNTRIES, VACANCY_FUNCTIONS } from '../shared/listings.ts'
import { FIELD_WORDS, PERSONAS, feedMetrics, titleOnField } from './personas.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

// Every persona uses real country and function keys, and every field has title words.
eq(PERSONAS.length, 12, 'personas')
for (const p of PERSONAS) {
  for (const c of p.countries) if (!(c in VACANCY_COUNTRIES)) throw new Error(`${p.slug}: unknown country ${c}`)
  for (const f of p.fields) if (!(f in VACANCY_FUNCTIONS) || !FIELD_WORDS[f]?.length) throw new Error(`${p.slug}: no title words for ${f}`)
}

// Stems match inside words (compounds), across languages and accents; short stems only whole words.
eq(titleOnField('Verpleegkundige IC', ['healthcare']), true, 'Dutch nurse')
eq(titleOnField('Ingénieur structure (H/F)', ['engineering']), true, 'accented engineer')
eq(titleOnField('Dualer Student Bauingenieurwesen', ['engineering']), true, 'German compound')
eq(titleOnField('Junior Księgowa', ['audit']), true, 'Polish accountant')
eq(titleOnField('IT Support Intern', ['software']), true, 'short stem, whole word')
eq(titleOnField('Item Data Clerk', ['software']), false, 'short stem inside a word')
eq(titleOnField('Summer Analyst, M&A', ['healthcare']), false, 'off field')
eq(titleOnField('Anything', ['ib']), false, 'field without words')

// Shares are of the page shown; employers count case-insensitively; pass needs all three targets.
const row = (title: string, company: string, functions: string[]) => ({ title, company, functions })
const top = [row('Staff Nurse', 'A', ['healthcare']), row('Ward Assistant', 'a', ['healthcare']), row('Data Analyst', 'B', ['data']), row('Clinic Nurse', 'C', ['healthcare'])]
eq(feedMetrics(250, top, ['healthcare']), { roles: 250, top: 4, onFieldFunctions: 0.75, onFieldTitle: 0.5, employers: 3, pass: false }, 'metrics')
eq(feedMetrics(0, [], ['healthcare']), { roles: 0, top: 0, onFieldFunctions: 0, onFieldTitle: 0, employers: 0, pass: false }, 'empty feed')
const good = Array.from({ length: 30 }, (_, i) => row(`Nurse ${i}`, `Employer ${i % 15}`, ['healthcare']))
eq(feedMetrics(200, good, ['healthcare']).pass, true, 'all targets met')
eq(feedMetrics(199, good, ['healthcare']).pass, false, 'too few roles')

console.log('personas.check: ok')
