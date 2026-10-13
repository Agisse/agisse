// Run: npx tsx src/lib/latex.check.ts
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import type { TailoredCv } from '../../shared/types.ts'
import { cvToLatex, tex, withTemplate } from './latex.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (got !== want) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}
eq(tex('R&D 50% $5 #1 a_b {x} ~ ^ \\'), 'R\\&D 50\\% \\$5 \\#1 a\\_b \\{x\\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{}', 'escape')

// The placeholder CV must render cv-template.tex byte for byte: the template is the layout.
const placeholder: TailoredCv = {
  name: 'Jane Doe',
  contact: ['jane.doe@example.com', '+32 400 00 00 00', 'linkedin.com/in/jane-doe/', 'Brussels, Belgium'],
  contactLine2: ['Open to relocation', 'Portfolio: janedoe.com'],
  summary: '',
  competencies: [],
  education: [
    {
      org: 'Example Business School',
      location: 'Brussels, Belgium',
      degree: 'Master in Financial Management',
      dates: '09/2026--06/2027',
      bullets: ['Exchange: Example University, Milan, Italy (Spring 2027)', 'Selected courses: Strategy, Negotiation, Machine Learning for Finance'],
    },
    {
      org: 'University of Example',
      location: 'Ghent, Belgium',
      degree: 'Master of Science in Business Engineering (Finance)',
      dates: '09/2024--06/2026',
      bullets: ['Grade: magna cum laude (80%), ranked 10th of 70 in the programme', 'Thesis: A European bank factor (17/20): analysed bank valuation data in R'],
    },
  ],
  experience: [
    {
      org: 'Example Bank',
      location: 'Brussels, Belgium',
      title: 'Data Analysis Intern',
      dates: '01/2025--02/2025',
      bullets: ['Analysed issuance and holdings data for two banking clients with SQL and Power BI', 'Delivered a 24-page report on funding patterns and service opportunities'],
    },
    { org: 'Example Tutoring', location: 'Ghent, Belgium', title: 'Economics Tutor', dates: '02/2023--05/2024', bullets: ['Tutored university students in micro- and macroeconomics'] },
  ],
  leadership: [
    {
      org: 'Example Rocketry Team',
      location: 'Belgium',
      title: 'Board Member',
      dates: '07/2025--07/2026',
      bullets: ['Increased sponsorship revenue from €5,000 to €20,000 by negotiating partnerships', 'Built an Excel tracker to coordinate a €60,000 budget'],
    },
  ],
  projects: [
    { name: 'Example SaaS', url: 'https://example.com', title: 'Founder & Developer', dates: '07/2026--Present', bullets: ['Built and operate a multi-tenant SaaS platform with Next.js, PostgreSQL and Docker'] },
  ],
  skills: [],
  skillGroups: [
    { label: 'Languages', items: ['Dutch (native)', 'French (bilingual)', 'English (fluent)'] },
    { label: 'Technical', items: ['Excel (LBO, DCF, comparable companies)', 'Python', 'SQL', 'Power BI', 'R'] },
    { label: 'Interests', items: ['Personal investing', 'endurance sports', 'chess'] },
  ],
  gaps: [],
  createdAt: '',
}
const template = readFileSync(new URL('./cv-template.tex', import.meta.url), 'utf8')
const got = cvToLatex(placeholder)
if (got !== template) {
  const a = got.split('\n'), b = template.split('\n')
  const i = a.findIndex((l, n) => l !== b[n])
  throw new Error(`differs from cv-template.tex at line ${i + 1}:\n got: ${a[i]}\nwant: ${b[i]}`)
}

// A CV tailored before the template layout: no new fields, no empty sections, summary never rendered.
const old = cvToLatex({
  name: 'Ada Lovelace',
  contact: ['ada@example.com', 'linkedin.com/in/ada'],
  summary: 'ignored',
  competencies: ['Valuation'],
  experience: [{ org: 'Bank & Co', title: 'Intern', dates: '2025', bullets: ['Built a DCF, 10% faster'] }],
  projects: [],
  education: [{ org: 'Uni', degree: 'MSc Finance', dates: '2024--2026' }],
  skills: ['Excel', 'C#'],
  gaps: [],
  createdAt: '',
})
for (const want of ['\\href{mailto:ada@example.com}', '\\href{https://linkedin.com/in/ada}', '\\subsection*{Bank \\& Co}', '10\\% faster', '\\textbf{Skills:} Excel, C\\#'])
  if (!old.includes(want)) throw new Error(`missing ${want}`)
for (const bad of ['Project', 'Leadership', 'ignored', 'Valuation', 'itemize}\n\n\\subsection*{Uni'])
  if (old.includes(bad)) throw new Error(`should not contain ${bad}`)
console.log('latex ok')

// An uploaded template keeps its preamble, gets our body, and gains hyperref for the \href links.
const mine = withTemplate(old, '\\documentclass{article}\n\\usepackage{fontspec}\n% my look\n\\begin{document}\nOLD BODY\n\\end{document}\n')!
for (const want of ['% my look\n\\usepackage{hyperref}\n\\begin{document}', '\\subsection*{Bank \\& Co}'])
  if (!mine.includes(want)) throw new Error(`template: missing ${want}`)
if (mine.includes('OLD BODY') || mine.includes('lmodern')) throw new Error('template: kept the wrong part')
if (withTemplate(old, '\\usepackage[colorlinks]{hyperref}\n\\begin{document}')!.split('hyperref').length !== 2) throw new Error('template: hyperref twice')
if (withTemplate(old, 'no document here') !== null) throw new Error('template: should reject')
console.log('template ok')
