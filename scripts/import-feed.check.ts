// Run: npx tsx scripts/import-feed.check.ts
import { countryOf, vacancyFromArbeitnow } from './import-feed.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

// Countries from free-text locations: names, native names and cities; null when none or several.
eq(countryOf('London, England, United Kingdom'), 'GB', 'London')
eq(countryOf('Remote Switzerland'), 'CH', 'remote in a country')
eq(countryOf('Altendorf, Schwyz, Schweiz'), 'CH', 'native name')
eq(countryOf('München, Bayern, Deutschland'), 'DE', 'accents')
eq(countryOf('Deeploy (Amsterdam, The Stack)'), 'NL', 'city in brackets')
eq(countryOf('Europe'), 'EU', 'anywhere in Europe')
eq(countryOf('Berlin, Europe'), 'DE', 'a country beats Europe')
eq(countryOf('Remote'), null, 'remote says nothing')
eq(countryOf('Neumünster Alte Holsten-Brauerei'), null, 'unknown place')
eq(countryOf('Paris or London'), null, 'two countries')
eq(countryOf('Bernau'), null, 'whole words only')

const row = {
  url: 'https://www.arbeitnow.com/jobs/companies/acme/x-1',
  title: 'Werkstudent Marketing (m/w/d)',
  company_name: 'Acme GmbH',
  location: 'Berlin',
  description: '<p>Social &amp; SEO</p>',
  remote: false,
  tags: ['Marketing', 'Engineering', 'Startup'],
  job_types: ['Part Time'],
  created_at: Date.UTC(2026, 9, 10, 12) / 1000,
}
eq(vacancyFromArbeitnow(row, '2026-10-14'), {
  url: row.url,
  source: 'arbeitnow',
  company: 'Acme GmbH',
  title: row.title,
  location: 'Berlin',
  country: 'DE',
  remote: false,
  description: 'Social & SEO',
  postedAt: '2026-10-10',
  firstSeen: '2026-10-10',
  lastSeen: '2026-10-14',
  level: 'internship',
  functions: ['marketing'],
}, 'mapped row')

// Level: the title first, then the job types; anything else is skipped.
eq(vacancyFromArbeitnow({ ...row, title: 'Analyst', job_types: ['Entry'] }, '2026-10-14')?.level, 'entry', 'job type')
eq(vacancyFromArbeitnow({ ...row, title: 'Senior Analyst', job_types: ['Entry'] }, '2026-10-14'), null, 'senior title')
eq(vacancyFromArbeitnow({ ...row, title: 'Analyst', job_types: ['Full Time'] }, '2026-10-14'), null, 'no level')
// Required fields, and a post date in the future never moves first_seen ahead of today.
eq(vacancyFromArbeitnow({ ...row, company_name: '' }, '2026-10-14'), null, 'no company')
eq(vacancyFromArbeitnow({ ...row, url: 'javascript:alert(1)' }, '2026-10-14'), null, 'not https')
eq(vacancyFromArbeitnow({ ...row, created_at: 'soon' }, '2026-10-14')?.firstSeen, '2026-10-14', 'no date')
eq(vacancyFromArbeitnow({ ...row, created_at: Date.UTC(2026, 11, 1) / 1000 }, '2026-10-14')?.firstSeen, '2026-10-14', 'future date')
console.log('import-feed ok')
