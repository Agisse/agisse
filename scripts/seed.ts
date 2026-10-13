// Fills a development database with synthetic data, so the feed and tracker have something to show:
//   npm run db:seed        (writes to DATABASE_URL; safe to re-run, existing rows are kept)
// Every company, role and person here is made up. Never seed real users, CVs or postings.
import { createDb, schema } from '../worker/db'
import { hashPassword } from '../worker/auth'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')
const db = createDb(url)

const today = new Date().toISOString().slice(0, 10)
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

const companies = [
  { domain: 'northwind.example.com', name: 'Northwind Analytics' },
  { domain: 'lowlands-bank.example.com', name: 'Lowlands Bank' },
  { domain: 'meridian-consulting.example.com', name: 'Meridian Consulting' },
  { domain: 'fjord-robotics.example.com', name: 'Fjord Robotics' },
]

const roles: [company: number, title: string, city: string, country: string, level: string, program: string, functions: string[], industry: string][] = [
  [0, 'Data Analyst Intern', 'Amsterdam', 'NL', 'internship', 'internship', ['data'], 'tech'],
  [0, 'Junior Software Engineer', 'Ghent', 'BE', 'entry', 'junior', ['software'], 'tech'],
  [1, 'Summer Analyst, M&A', 'Brussels', 'BE', 'internship', 'summer', ['m&a'], 'banking'],
  [1, 'Graduate Programme, Risk', 'Antwerp', 'BE', 'entry', 'graduate_programme', ['risk'], 'banking'],
  [2, 'Business Analyst Intern', 'Paris', 'FR', 'internship', 'internship', ['consulting'], 'consulting'],
  [2, 'Junior Consultant, Strategy', 'Leuven', 'BE', 'entry', 'junior', ['strategy'], 'consulting'],
  [3, 'Mechanical Engineering Intern', 'Oslo', 'NO', 'internship', 'off_cycle', ['engineering'], 'corporate'],
  [3, 'Product Management Trainee', 'Groningen', 'NL', 'entry', 'graduate_programme', ['product'], 'startup'],
]

const vacancies = roles.map(([c, title, city, country, level, program, functions, industry], i) => ({
  url: `https://${companies[c]!.domain}/careers/${i + 1}`,
  source: 'seed',
  company: companies[c]!.name,
  domain: companies[c]!.domain,
  title,
  location: city,
  country,
  city,
  description: `${companies[c]!.name} is looking for a ${title.toLowerCase()} in ${city}. Synthetic posting for local development.`,
  postedAt: today,
  deadline: i % 2 ? inDays(30 + i) : null,
  deadlineType: i % 2 ? 'explicit' : 'rolling',
  firstSeen: today,
  lastSeen: today,
  level,
  program,
  functions,
  industry,
}))

const password = crypto.randomUUID()
const userId = 'seed-student'

await db.insert(schema.company).values(companies).onConflictDoNothing()
await db.insert(schema.vacancy).values(vacancies).onConflictDoNothing()
const added = await db
  .insert(schema.user)
  .values({ id: userId, name: 'Sam Student', email: 'student@example.com', emailVerified: true, accessStatus: 'approved' })
  .onConflictDoNothing()
  .returning({ id: schema.user.id })
if (added.length) {
  await db.insert(schema.account).values({ id: userId, accountId: userId, providerId: 'credential', userId, password: await hashPassword(password) })
  await db.insert(schema.job).values({
    id: 'seed-job-1',
    userId,
    company: companies[1]!.name,
    role: 'Summer Analyst, M&A',
    url: vacancies[2]!.url,
    location: 'Brussels',
    jdText: vacancies[2]!.description,
    status: 'saved',
  })
}

console.log(`Seeded ${companies.length} companies and ${vacancies.length} open vacancies into ${new URL(url).host}.`)
console.log(added.length ? `Sign in as student@example.com with password ${password}` : 'student@example.com already exists; its password is unchanged.')
