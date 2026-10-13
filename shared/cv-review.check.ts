// Run: npx tsx shared/cv-review.check.ts
import { bandOf, matchKeywords, parseCv, reviewCv } from './cv-review.ts'
import { reviewLinkedin } from './linkedin-review.ts'
import { EMPTY_PROFILE } from './types.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}
const ok = (cond: boolean, what: string) => {
  if (!cond) throw new Error(what)
}

const good = `Anna Peeters
anna.peeters@example.com · +32 470 12 34 56 · linkedin.com/in/annapeeters

EXPERIENCE
Data Analyst Intern, Colruyt Group — Halle | Feb 2025 – Jun 2025
• Built a demand forecast in Python for 120 stores that cut fresh-produce waste by 8%
• Automated the weekly sales report in Power BI, saving the team 6 hours a week
• Presented pricing findings to 3 category managers, who adopted 2 of 4 proposals
Teaching Assistant, KU Leuven — Leuven | Sep 2024 – Jan 2025
• Ran weekly exercise sessions in statistics for 45 first-year students
• Wrote 30 practice questions in R that the course now uses every year

PROJECTS
Case competition, BearingPoint Challenge | Mar 2024
• Led a team of 4 that redesigned a spare-parts supply chain, finishing 2nd of 28 teams
• Modelled stock levels in Excel and showed a €40k yearly saving in inventory costs
Student association VTK — Leuven | Sep 2022 – Jun 2024
• Organised a career fair with 60 companies and 1,500 visitors as head of corporate relations
• Negotiated 12 sponsorship deals worth €35k in total, up 20% on the year before

EDUCATION
MSc Business Engineering, KU Leuven | Sep 2023 – Jun 2025
Thesis on retail price elasticity, graded 16/20

SKILLS
Python, SQL, Power BI, R, Excel
Dutch (native), English (fluent), French (good)`

const weak = `Tom
EXPERIENCE
Intern at Acme 2024
- Responsible for helping the marketing team with various very important tasks and also I was involved in many different projects across the company which were managed by my manager and the brand team in Ghent
- Helped with social media
- Assisted the sales team
- Worked on reports
Date of birth: 01/02/2001
References available upon request
I am a highly motivated team player and a fast learner who is passionate about marketing.`

const g = reviewCv(good, { ...EMPTY_PROFILE, skills: ['Python', 'SQL', 'Tableau'] })
const w = reviewCv(weak)
const failed = (r: typeof g) => r.checks.filter((c) => !c.pass).map((c) => c.id)

eq(parseCv(good).bullets.length, 9, 'good bullets')
ok(g.score >= 85, `good CV scores ${g.score}, failed ${failed(g)}`)
ok(w.score < 55, `weak CV scores ${w.score}`)
eq(failed(g), ['badge-skills'], 'good CV only misses the badge skill')
for (const id of ['quantified', 'weak-verbs', 'duties', 'contact', 'unnecessary', 'buzzwords', 'pronouns', 'bullets', 'sections']) ok(failed(w).includes(id), `weak CV fails ${id}`)
eq(w.checks.find((c) => c.id === 'weak-verbs')?.lines, ['Helped with social media', 'Assisted the sales team', 'Worked on reports'], 'weak verb lines')
ok(w.checks.find((c) => c.id === 'bullet-length')!.lines[0]!.startsWith('Responsible for'), 'long bullet flagged')
ok(g.checks.every((c) => !c.pass || c.lines.length === 0), 'passing checks carry no lines')

// A wrapped PDF bullet is one bullet; a lone year is not a result.
eq(parseCv('Experience\n• Designed a pricing model that raised\nmargin by 4% across 12 shops').bullets.map((b) => b.text), ['Designed a pricing model that raised margin by 4% across 12 shops'], 'wrapped bullet')
eq(reviewCv('Experience\n• Joined the team in 2023 and wrote reports').checks.find((c) => c.id === 'quantified')!.score, 0, 'year is not a number')
// Dutch headings count.
ok(reviewCv('Werkervaring\n• Bouwde een dashboard\nOpleiding\nBachelor\nVaardigheden\nSQL').checks.find((c) => c.id === 'sections')!.pass, 'dutch headings')

// "&" headings and a stray month name.
eq([...parseCv('Skills & Interests\nSQL\nLeadership & Extracurriculars\n• Ran a club\nPersonal Project\n• Built an app').sections.keys()], ['skills', 'activities', 'projects'], 'ampersand headings')
ok(reviewCv('Experience 09/2024 – 06/2025 and 02/2023 – 05/2024, available from August 2026').checks.find((c) => c.id === 'dates')!.pass, 'one month name is not a second format')
ok(!reviewCv('Sep 2024 – Jun 2025, 02/2023 – 05/2024').checks.find((c) => c.id === 'dates')!.pass, 'two formats fail')

eq(parseCv('Experience\n• Analysed data with SQL, Power BI, and\nPython for 2 banks').bullets.map((b) => b.text), ['Analysed data with SQL, Power BI, and Python for 2 banks'], 'dangling bullet joins a capitalised line')
// Education bullets list facts; they never need a number.
eq(reviewCv('Education\n• Courses: Corporate Finance, Asset Management\nExperience\n• Built a model for 12 clients').checks.find((c) => c.id === 'quantified')!.pass, true, 'education bullets skipped')

eq(bandOf(92), 'Exceptional', 'band 92')
eq(bandOf(79), 'Room to grow', 'band 79')
eq(matchKeywords(good, ['Python', 'power bi', 'Tableau', 'python', 'Team player']), { matched: ['Python', 'power bi'], missing: ['Tableau'], pct: 67 }, 'keyword match')

// LinkedIn: copied page text, headings repeated by screen-reader spans.
const page = `Anna Peeters
Business engineering student · Python, SQL · Aiming for supply chain analytics
Leuven, Flanders · Contact info
500+ connections
About
About
I study business engineering at KU Leuven and build forecasting models in Python. At Colruyt I cut fresh-produce waste by 8% with a demand forecast. I am looking for a graduate role in supply chain analytics from September.
Experience
Experience
Data Analyst Intern
Colruyt Group · Internship
Built a demand forecast in Python for 120 stores that cut waste by 8%
Automated the weekly sales report in Power BI, saving 6 hours a week
Teaching Assistant
Ran exercise sessions in statistics for 45 first-year students each week
Education
KU Leuven
Skills
Python
SQL`
const prof = { ...EMPTY_PROFILE, skills: ['Python', 'SQL'], targetIndustries: ['supply chain'] }
const li = reviewLinkedin({ text: page, url: 'https://www.linkedin.com/in/annapeeters/' }, prof)
eq(li.headline, 'Business engineering student · Python, SQL · Aiming for supply chain analytics', 'linkedin headline from top card')
eq(li.checks.filter((c) => !c.pass).map((c) => c.id), [], 'strong linkedin profile passes')
const bare = reviewLinkedin({ text: 'Tom Jansen\nStudent at UGent\nExperience\nIntern\nAcme', url: 'https://www.linkedin.com/in/tom-jansen-4a7b9c21/' }, prof)
for (const id of ['headline-specific', 'headline-keywords', 'about', 'experience-described', 'skills', 'education', 'url']) ok(bare.checks.some((c) => c.id === id && !c.pass), `bare profile fails ${id}`)
ok(bare.score < 30, `bare profile scores ${bare.score}`)

console.log(`cv review checks passed (good ${g.score}, weak ${w.score})`)
