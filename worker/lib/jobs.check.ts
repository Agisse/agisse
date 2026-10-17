// Run: npx tsx worker/lib/jobs.check.ts
import { readFileSync } from 'node:fs'
import { FAIRNESS } from './pipeline.ts'
import { coverProblem, draftCover, tailorCv, evaluationBrief, finalizeCheck, fitToLimit, shortTextProblem, finalizeEvaluation, postingFacts, postingKey, recommendationFor, verifyCv } from './jobs.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

// The 4.0 line: below it, never recommend applying.
eq([4.6, 4.5, 4.4, 4, 3.9].map(recommendationFor), ['apply_now', 'apply_now', 'apply', 'apply', 'do_not_apply'], 'recommendationFor')

const req = (requirement: string, importance: 'critical' | 'high' | 'meaningful', evidenceTier: 'stated' | 'inferred', match: 'strong' | 'missing') =>
  ({ requirement, importance, evidenceTier, jdQuote: null, match, cvEvidence: '', mitigation: null })
const ev = finalizeEvaluation({
  role: { title: 'Analyst', company: 'Acme', seniority: 'junior', remote: 'hybrid', location: '', tldr: '' },
  workAuth: 'no_sponsorship',
  requirements: [req('SQL', 'critical', 'stated', 'strong'), req('Python', 'critical', 'stated', 'missing'), req('Guess', 'critical', 'inferred', 'missing'), req('Excel', 'high', 'stated', 'strong')],
  dimensions: { cvMatch: 4, northStar: 4, comp: 3, culture: 3, redFlags: 4 },
  score: 3.94,
  comp: { advertisedVerbatim: null, reliability: 'unknown' },
  legitimacy: { tier: 'high_confidence', signals: [] },
  cvChanges: [],
  keywords: [],
})
eq(ev.score, 3.9, 'score rounded')
eq(ev.recommendation, 'do_not_apply', 'recommendation from score')
// Inferred rows drop out of the top band; unmet before met within a band.
eq(ev.requirements.map((r) => `${r.requirement}:${r.importance}`), ['Python:critical', 'SQL:critical', 'Excel:high', 'Guess:meaningful'], 'requirements order')
eq(ev.hardStops.length, 1, 'no sponsorship is a hard stop')

// Reworded bullets stay; employers, schools and skills missing from the source go.
const cv = verifyCv(
  {
    name: 'Ada',
    contact: [],
    summary: '',
    competencies: [],
    experience: [{ org: 'Deloitte', title: 'Intern', dates: '2025', bullets: [] }, { org: 'McKinsey', title: 'Analyst', dates: '2024', bullets: [] }],
    projects: [],
    education: [{ org: 'KU Leuven', degree: 'MSc', dates: '2026' }],
    skills: ['Python', 'Kubernetes', 'C++'],
    gaps: [],
  },
  'Ada — MSc at KU Leuven. Intern at Deloitte (Brussels). Skills: Python, SQL.',
)
eq(cv.experience.map((e) => e.org), ['Deloitte'], 'invented employer dropped')
eq(cv.education.length, 1, 'school kept')
eq(cv.skills, ['Python'], 'invented skills dropped')

// Template layout: leadership orgs and grouped skills are checked too; interests are free text.
const cv3 = verifyCv(
  {
    name: 'Ada', contact: [], summary: '', competencies: [], experience: [], projects: [], education: [], skills: [], gaps: [],
    leadership: [{ org: 'BE Rocket — Board', title: 'Board Member', dates: '2025', bullets: [] }, { org: 'Oxford Union', title: 'President', dates: '2024', bullets: [] }],
    skillGroups: [{ label: 'Technical', items: ['Python', 'Kubernetes'] }, { label: 'Interests', items: ['chess'] }, { label: 'Languages', items: ['Klingon'] }],
  },
  'Ada. Board member of BE Rocket. Skills: Python.',
)
eq(cv3.leadership?.map((e) => e.org).join(), 'BE Rocket', 'invented leadership dropped, title cut')
eq(JSON.stringify(cv3.skillGroups), JSON.stringify([{ label: 'Technical', items: ['Python'] }, { label: 'Interests', items: ['chess'] }]), 'skill groups verified, empty group gone')
eq(cv3.skills.join(), 'Python', 'flat skills from groups, without interests')

// Reworded names stay (shortened, expanded, acronym, vendor prefix); a title pasted into the org is cut off.
const maxime = `Maxime Declercq, Brussels
KU Leuven, MSc Financial Economics, expected June 2027
Solvay Brussels School of Economics and Management, Université libre de Bruxelles, BSc Business Engineering
KBC Securities — Corporate Finance (M&A)
Summer Analyst, 2025
Deloitte Transaction Services, Intern, 2024
Solvay Finance Society, Treasurer
Skills: Excel, DCF modeling, Bloomberg`
const cv2 = verifyCv(
  {
    name: 'Maxime', contact: [], summary: '', competencies: [], projects: [], gaps: [],
    experience: [
      { org: 'KBC Securities — Corporate Finance (M&A) Summer Analyst', title: 'Summer Analyst', dates: '2025', bullets: [] },
      { org: 'Solvay Finance Society (SFS)', title: 'Treasurer', dates: '', bullets: [] },
      { org: 'Goldman Sachs', title: 'Analyst', dates: '2024', bullets: [] },
      { org: 'Brussels Capital Partners', title: 'Analyst', dates: '2024', bullets: [] },
    ],
    education: [
      { org: 'Katholieke Universiteit Leuven', degree: 'MSc', dates: 'expected June 2027' },
      { org: 'Solvay Brussels School, ULB', degree: 'BSc', dates: '' },
      { org: 'Université libre de Bruxelles (ULB)', degree: 'BSc', dates: '' },
      { org: 'Harvard University', degree: 'MBA', dates: '' },
    ],
    skills: ['Microsoft Excel', 'DCF modelling', 'Bloomberg', 'Python', 'Power BI'],
  },
  maxime,
)
eq(cv2.experience.map((e) => e.org), ['KBC Securities', 'Solvay Finance Society (SFS)'], 'reworded orgs kept, title cut, invented dropped')
eq(cv2.education.map((e) => e.org), ['Katholieke Universiteit Leuven', 'Solvay Brussels School, ULB', 'Université libre de Bruxelles (ULB)'], 'reworded schools kept')
eq(cv2.skills, ['Microsoft Excel', 'DCF modelling', 'Bloomberg'], 'reworded skills kept')

// Cover letters: paragraphs, bullets on their own lines, no banned word forms, sane length.
const para = 'I would bring careful financial analysis from two transaction internships to your team in Brussels this year. '.repeat(4)
const good = `Dear Hiring Team,\n\n${para}\n\n- Built a model for a sale.\n- Screened targets.\n\n${para}\n\n${para}\n\nKind regards,\nMaxime`
eq(coverProblem(good), null, 'good letter passes')
eq(coverProblem(good.replace(/\n+/g, ' ')), 'no paragraph breaks', 'flat letter fails')
eq(coverProblem(good.replace('- Built a model for a sale.\n- Screened', 'Highlights - Built a model; also - Screened')), 'bullets run inline', 'inline bullets fail')
eq(coverProblem(good.replace('careful', 'leveraging')) !== null, true, 'banned word form fails')
eq(coverProblem('Dear Hiring Team,\n\nToo short.\n\nx\n\ny'), '7 words', 'short letter fails')
console.log('jobs checks passed')

// Two shares of one posting match; different postings do not.
const key = await postingKey('https://www.Boards.greenhouse.io/acme/jobs/123/?utm_source=linkedin&gh_jid=9#apply', '')
eq(key, 'boards.greenhouse.io/acme/jobs/123?gh_jid=9', 'postingKey url')
eq(await postingKey('https://boards.greenhouse.io/acme/jobs/123?gh_jid=9&ref=x', ''), key, 'postingKey drops tracking')
eq(await postingKey(null, 'Analyst  at Acme\n'), await postingKey(null, 'analyst at acme'), 'postingKey text ignores case and spacing')
eq((await postingKey(null, 'a')) === (await postingKey(null, 'b')), false, 'postingKey text differs')
eq(Object.keys(postingFacts(ev).requirements[0]!), ['requirement', 'importance', 'evidenceTier', 'jdQuote'], 'postingFacts drops the CV match')

// Application check: only quotes really in the named document survive; requirements align by number; keywords matched in code.
const docs = { resume: 'Ada Lovelace\nSkils: Python,  SQL\nIntern at Deloite', cover: 'Dear Hiring Team,\nI want to join Acme as an Analyst.' }
const issue = (doc: 'resume' | 'cover', quote: string, fix: string) => ({ doc, kind: 'spelling' as const, quote, fix, why: '' })
const chk = finalizeCheck(
  {
    verdict: ' ok ',
    requirements: [{ n: 2, shown: 'not', where: '' }, { n: 2, shown: 'clearly', where: '' }, { n: 99, shown: 'clearly', where: '' }],
    issues: [issue('resume', 'Skils: Python, SQL', 'Skills: Python, SQL'), issue('resume', 'Deloite', 'Deloitte'), issue('cover', 'Deloite', 'Deloitte'), issue('resume', 'Invented', 'x'), issue('resume', 'Deloite', 'Deloitte'), issue('resume', 'Python', 'Python')],
  },
  { ...ev, keywords: ['Python', 'SQL', 'Excel'] },
  docs,
  'pasted',
)
eq(chk.issues.map((i) => `${i.doc}:${i.quote}`), ['resume:Skils: Python, SQL', 'resume:Deloite'], 'check keeps real quotes only, whitespace-tolerant, deduped, no no-op fixes')
eq(chk.requirements.map((r) => [r.requirement, r.shown]), [[ev.requirements[1]!.requirement, 'not']], 'check requirements aligned, first wins, unknown dropped')
eq(chk.keywords.map((k) => [k.resume, k.cover]), [[true, false], [true, false], [false, false]], 'check keywords')
eq([chk.verdict, chk.hasCover], ['ok', true], 'check verdict')
console.log('application check passed')

eq(shortTextProblem('Thanks for the call on Tuesday about the pricing dashboard.', 120), null, 'short text ok')
eq(shortTextProblem('word '.repeat(130), 120), '130 words', 'short text too long')
eq(shortTextProblem('I am passionate about pricing.', 120)?.startsWith('banned phrase'), true, 'short text banned phrase')
eq(fitToLimit('One. Two.', 20), 'One. Two.', 'fits as is')
eq(fitToLimit('I built the pricing dashboard. I also ran the uplift analysis for six categories.', 50), 'I built the pricing dashboard.', 'cut at the last full sentence')
eq(fitToLimit('Short. And then a very long second sentence that runs on and on.', 60), null, 'cut losing over half is rejected')
eq(fitToLimit('Version 2.0 shipped', 12), null, 'a dot inside a word is no sentence end')
console.log('short text checks passed')

// Contact noise is cleaned and a change log entry for a dropped skill goes with it.
const cv4 = verifyCv(
  {
    name: 'Ada', summary: '', competencies: [], experience: [], projects: [], education: [], skills: [], gaps: [],
    contact: [': ada@example.com', ': Ghent'], contactLine2: ['ada@example.com', 'Open to relocation'],
    skillGroups: [{ label: 'Technical skills', items: ['Excel', 'Power Query'] }],
    changes: [{ change: 'Added Power Query to Technical skills', why: '' }, { change: 'Reworded the KBC bullet', why: '' }],
  },
  'Ada, ada@example.com, Ghent. Skills: Excel.',
)
eq(cv4.contact, ['ada@example.com', 'Ghent'], 'contact cleaned')
eq(cv4.contactLine2, ['Open to relocation'], 'line 2 deduped')
eq(cv4.changes?.map((c) => c.change), ['Reworded the KBC bullet'], 'change for dropped skill removed')

// Scoring and writing never lean on age, gender, nationality, health or a photo (S3): the evaluation, CV tailoring and cover letter prompts all say so.
if (!evaluationBrief('posting', null, 'cv').system.includes(FAIRNESS)) throw new Error('evaluation prompt lacks FAIRNESS')
eq(readFileSync('worker/lib/jobs.ts', 'utf8').split('${FAIRNESS}').length - 1, 3, 'prompts with FAIRNESS in jobs.ts')
console.log('fairness check passed')

// Routing on Agisse's key: tailored CVs skip the paid default and go straight to the free chain; cover letters start on it.
const asked: string[] = []
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  if (String(url).endsWith('/chat/completions')) asked.push(JSON.parse(String(init?.body)).model)
  return new Response('{}', { status: 500 })
}) as unknown as typeof fetch
console.warn = console.error = () => {}
const routeEnv = { OPENROUTER_API_KEY: 'sk-server', OPENROUTER_MODELS: 'mistralai/mistral-small-2603,a/free:free' } as unknown as Env
const routeJob = { company: 'Example', role: 'Analyst', jdText: 'posting', evaluation: { requirements: [], keywords: [] } } as unknown as Parameters<typeof tailorCv>[1]
await tailorCv(routeEnv, routeJob, null, 'cv text').catch(() => {})
eq([...new Set(asked)], ['a/free:free'], 'tailored CV models')
asked.length = 0
await draftCover(routeEnv, routeJob, null, 'cv text', 'Sam').catch(() => {})
eq(asked[0], 'mistralai/mistral-small-2603', 'cover letter first model')
console.log('routing check passed')

// The seeker's instructions and language reach the cover letter prompt.
let sent = ''
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  if (String(url).endsWith('/chat/completions')) sent = String(init?.body)
  return new Response('{}', { status: 500 })
}) as unknown as typeof fetch
await draftCover(routeEnv, routeJob, null, 'cv text', 'Sam', undefined, '', { note: 'Lead with my thesis', lang: 'nl' }).catch(() => {})
if (!sent.includes('Lead with my thesis') || !sent.includes('Write in Nederlands')) throw new Error('cover instructions missing from prompt')
console.log('instructions check passed')
