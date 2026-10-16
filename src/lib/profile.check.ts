// Run: npx tsx src/lib/profile.check.ts
import { localeCountry, suggestFields } from './profile.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}
const cv = (degree: string, x: { headline?: string; internships?: string[] } = {}) => suggestFields({ headline: x.headline ?? '', degree, internships: x.internships ?? [], targetIndustries: [] })

eq(cv('Master in Computer Science'), ['software'], 'computer science')
eq(cv('MSc Business Engineering', { internships: ['Audit intern at KPMG'] }), ['audit', 'engineering'], 'engineering + audit internship')
eq(cv('Master of Laws'), ['legal'], 'LLM')
eq(cv('Bachelor Rechten'), ['legal'], 'Dutch law degree')
eq(cv('Business administration'), [], 'vague degree picks nothing')
eq(cv('Data Science', { headline: 'Analytics, machine learning, software developer, consulting' }).length, 3, 'capped at three')
eq(localeCountry({ BE: 'Belgium' }, 'nl-BE'), 'BE', 'nl-BE')
eq(localeCountry({ BE: 'Belgium' }, 'en-US'), null, 'outside the feed')
eq(localeCountry({ BE: 'Belgium' }, 'nl'), null, 'no region')
console.log('profile.check ok')
