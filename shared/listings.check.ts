// Run: npx tsx shared/listings.check.ts
import { deadlineLabel, plainText, groupByCompany, EMPTY_FEED_PREFS, fromAdzuna, fromArbeitnow, fromAshby, levelOf, matchFeed, type FeedPrefs, type Listing, fromGreenhouse, fromLever, fromPersonio, fromRecruitee, fromSmartRecruiters, fromWorkable, htmlToText, postingBoard, slugGuesses } from './listings.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

eq(slugGuesses('Müller & Sons GmbH', 'www.mueller.com'), ['mullersons', 'muller-sons', 'mueller', 'mullersonsgmbh'], 'slug guesses')
eq(slugGuesses('Stripe, Inc.', 'stripe.com'), ['stripe', 'stripeinc'], 'unique slug guesses')
eq(slugGuesses('Bosch Group'), ['bosch', 'boschgroup'], 'suffix kept as last guess')
eq(htmlToText('&lt;p&gt;Plan &amp;amp; build&lt;/p&gt;&lt;ul&gt;&lt;li&gt;One&lt;/li&gt;&lt;li&gt;Two&lt;/li&gt;&lt;/ul&gt;'), 'Plan & build\n- One\n- Two', 'html text')

eq(fromGreenhouse({ title: 'Analyst', absolute_url: 'https://boards.greenhouse.io/acme/1', location: { name: 'Brussels' }, content: '&lt;p&gt;Model &amp;amp; report&lt;/p&gt;' }, 'Acme')?.text, 'Model & report', 'greenhouse')
eq(fromLever({ text: 'Engineer', hostedUrl: 'https://jobs.lever.co/acme/1', categories: { location: 'Remote' }, descriptionPlain: 'Build it', lists: [{ text: 'What you do', content: '<li>Ship</li>' }], additionalPlain: 'Apply' }, 'Acme')?.text, 'Build it\n\nWhat you do\n- Ship\n\nApply', 'lever')
eq(fromAshby({ title: 'Designer', jobUrl: 'https://jobs.ashbyhq.com/acme/1', location: 'London', descriptionHtml: '<p>Design systems</p>' }, 'Acme')?.text, 'Design systems', 'ashby')
eq(fromAshby({ title: 'Hidden', jobUrl: 'https://example.com', isListed: false }, 'Acme'), null, 'ashby hidden')
eq(fromAdzuna({ title: 'Consultant', redirect_url: 'https://adzuna.example/job/1?utm_source=x', company: { display_name: 'Acme' }, location: { display_name: 'Ghent' }, description: 'Advise clients' })?.url, 'https://adzuna.example/job/1', 'adzuna url')
eq(fromRecruitee({ title: 'Analyst', careers_url: 'https://careers.acme.com/o/analyst', location: 'Amsterdam, Netherlands', description: '<p>Model</p>', requirements: '<ul><li>SQL</li></ul>' }, 'Acme')?.text, 'Model\n\n- SQL', 'recruitee')
eq(fromWorkable({ title: 'Engineer', url: 'https://apply.workable.com/j/X', telecommuting: true, city: 'Paris', country: 'France', description: '<p>Build</p>' }, 'Acme')?.location, 'Remote', 'workable remote')
eq(fromSmartRecruiters({ id: '7', name: 'PLC Engineer', company: { identifier: 'BoschGroup' }, location: { city: 'Stuttgart', country: 'de' } }, 'Bosch'), { provider: 'smartrecruiters', company: 'Bosch', title: 'PLC Engineer', location: 'Stuttgart, DE', url: 'https://jobs.smartrecruiters.com/BoschGroup/7', text: '' }, 'smartrecruiters')
const personio = `<workzag-jobs><position><id>42</id><office>Berlin</office><name>CRM Manager (m/w/d) &amp; more</name><jobDescriptions><jobDescription><name>Deine Aufgaben</name><value><![CDATA[<ul><li>Kampagnen</li></ul>]]></value></jobDescription></jobDescriptions></position><position><name>No id</name></position></workzag-jobs>`
eq(fromPersonio(personio, 'clark', 'Clark'), [{ provider: 'personio', company: 'Clark', title: 'CRM Manager (m/w/d) & more', location: 'Berlin', url: 'https://clark.jobs.personio.de/job/42', text: 'Deine Aufgaben\n- Kampagnen' }], 'personio')
eq(fromPersonio('<!DOCTYPE html><html></html>', 'nope', 'Nope'), [], 'personio homepage redirect')

eq(fromArbeitnow({ title: 'Werkstudent Data', url: 'https://www.arbeitnow.com/jobs/companies/acme/x', company_name: 'Acme', location: 'Berlin', description: '<p>SQL</p>', remote: true, tags: ['Data'] })?.text, 'SQL\n\nTags: Data', 'arbeitnow')
eq(fromAdzuna({ title: 'A', redirect_url: 'https://a.example/1', salary_max: 42000 })?.salaryMax, 42000, 'adzuna salary')

eq(['Werkstudent (m/w/d) Controlling', 'Stagiaire marketing', 'Junior Analyst', 'Graduate Programme 2027', 'Senior Consultant', 'Sr. Engineer', 'Data Analyst III', 'Business Analyst'].map(levelOf), ['internship', 'internship', 'entry', 'entry', 'experienced', 'experienced', 'experienced', null], 'levels')

const L = (title: string, text = '', extra: Partial<Listing> = {}): Listing => ({ provider: 'arbeitnow', company: 'Acme', title, location: 'Berlin', url: `https://x/${title}`, text, ...extra })
const pool = [
  L('Junior Data Analyst', 'SQL and Python, fintech'),
  L('Senior Data Analyst', 'SQL'),
  L('Praktikum Data Analytics', 'Python'),
  L('Data Analyst', 'Excel', { location: 'Remote, EU' }),
  L('Kosmetikerin', 'Teilzeit'),
  L('Data Analyst (Hamburg)', 'SQL', { salaryMax: 30000 }),
]
const prefs: FeedPrefs = { ...EMPTY_FEED_PREFS, query: 'data analyst' }
const titles = (p: Partial<FeedPrefs>) => matchFeed(pool, { ...prefs, ...p }, ['SQL', 'Python', 'fintech']).map((i) => i.listing.title)
eq(titles({}), ['Junior Data Analyst', 'Senior Data Analyst', 'Data Analyst (Hamburg)', 'Data Analyst', 'Praktikum Data Analytics'], 'feed rank: query in title, then profile terms')
eq(titles({ level: 'entry' }), ['Junior Data Analyst', 'Data Analyst (Hamburg)', 'Data Analyst'], 'entry keeps unknown levels, drops interns and seniors')
eq(titles({ level: 'internship' }), ['Praktikum Data Analytics'], 'internships only')
eq(titles({ remoteOnly: true }), ['Data Analyst'], 'remote only')
eq(titles({ minSalary: 40000 }).includes('Data Analyst (Hamburg)'), false, 'salary below the minimum is dropped')
eq(matchFeed(pool, prefs, ['SQL', 'Python', 'fintech'])[0]?.matched, ['SQL', 'Python', 'fintech'], 'matched terms')

console.log('listing checks passed')

eq(postingBoard('https://job-boards.greenhouse.io/stripe/jobs/6123456?gh_src=x')?.slug, 'stripe', 'greenhouse board slug')
eq(postingBoard('https://jobs.lever.co/acme/8f0b6a5e-1234-4abc-9def-1234567890ab/apply')?.id, '8f0b6a5e-1234-4abc-9def-1234567890ab', 'lever posting id')
eq(postingBoard('https://acme.jobs.personio.de/job/123456')?.board.provider, 'personio', 'personio board')
eq(postingBoard('https://careers.acme.com/jobs/1'), null, 'unknown site')
console.log('posting board checks passed')

// Feed deadlines: urgency by days left, a plain date further out, honest when unknown.
const now = new Date('2026-10-11T09:00:00')
const dl = (deadline: string | null, deadlineType: 'explicit' | 'rolling' | 'unknown' = 'explicit') => deadlineLabel({ deadline, deadlineType }, now)
eq(dl('2026-10-11'), { text: 'Closes today', tone: 'red' }, 'today')
eq(dl('2026-10-12'), { text: 'Closes tomorrow', tone: 'red' }, 'tomorrow')
eq(dl('2026-10-16'), { text: 'Closes in 5 days', tone: 'amber' }, 'five days')
eq(dl('2026-10-30'), { text: 'Closes 30 Oct', tone: 'plain' }, 'later')
eq(dl('2027-01-15').text, 'Closes 15 Jan 2027', 'next year')
eq(dl('2026-10-01').tone, 'red', 'passed')
eq(dl(null, 'rolling'), { text: 'Rolling', tone: 'plain' }, 'rolling')
eq(dl(null, 'unknown'), { text: '', tone: 'muted' }, 'unknown')
// The same employer folds under its first row; order is kept.
eq(groupByCompany([{ company: 'A' }, { company: 'B' }, { company: 'a ' }]).map((g) => [g.lead.company, g.rest.length]), [['A', 1], ['B', 0]], 'grouping')
eq(plainText('IT \\& Cyber **About us** x'), 'IT & Cyber About us x', 'plain text')
console.log('feed checks passed')
