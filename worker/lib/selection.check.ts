// Run: npx tsx worker/lib/selection.check.ts
import { finalizeSelection } from './selection.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

const real = 'https://www.glassdoor.com/Interview/acme-1'
const forum = 'https://reddit.com/r/consulting/acme'
const fake = 'https://made-up.example/acme'
const raw = {
  rolePattern: 'graduate',
  location: 'London',
  stages: [
    { name: 'Case interview', format: 'Live, 45 min', whatTheyAssess: 'Structuring', duration: '45 min', tips: ['Practise market sizing'], sourceUrls: [real, fake] },
    { name: 'Phantom round', format: 'x', whatTheyAssess: 'x', duration: 'Not specified', tips: [], sourceUrls: [fake] },
  ],
  questions: [
    { question: 'Size the UK coffee market', stage: 'Case interview', sourceUrl: forum },
    { question: 'Invented', stage: null, sourceUrl: fake },
  ],
  values: ['Structured thinking'],
  timeline: '3 weeks',
  difficulty: 'Not specified',
  advice: [
    { tip: 'Lead the case, they expect you to drive', sourceUrl: real },
    { tip: 'Unsourced', sourceUrl: fake },
  ],
  pitfalls: [{ tip: '  ', sourceUrl: real }],
  sources: [
    { url: real, title: 'Acme interview', kind: 'candidate report' as const },
    { url: forum, title: '', kind: 'forum' as const },
    { url: real, title: 'dup', kind: 'candidate report' as const },
    { url: fake, title: 'Fake', kind: 'official' as const },
  ],
  confidence: 'high' as const,
  notes: null,
}

const job = (role: string, location: string | null) => ({ company: 'Acme', role, location })
const results = [{ url: real, text: 'Case interview at the London office' }, { url: forum, text: 'Coffee market sizing' }]
const out = finalizeSelection(raw, results, job('Business Analyst', 'Amsterdam'), '2026-09-27')
eq(out.stages.map((s) => [s.name, s.sourceUrls]), [['Case interview', [real]]], 'stages keep only real sources; unsourced stage dropped')
eq(out.questions.map((q) => q.question), ['Size the UK coffee market'], 'questions with an unknown URL dropped')
eq(out.advice.map((a) => a.tip), ['Lead the case, they expect you to drive'], 'unsourced advice dropped')
eq(out.pitfalls, [], 'empty tips dropped')
eq([out.stages[0]!.duration, out.difficulty], ['45 min', null], '"Not specified" becomes null')
eq(out.sources.map((s) => [s.url, s.title]), [[real, 'Acme interview'], [forum, forum]], 'sources deduped, fake dropped, empty title falls back to URL')
eq(out.confidence, 'medium', 'no official source: confidence capped at medium')
eq([out.rolePattern, out.location], [null, null], 'pattern and location that do not fit this job are dropped')
eq(finalizeSelection({ ...raw, sources: [{ url: forum, title: 'f', kind: 'forum' }] }, results, job('Graduate Analyst', 'London, UK'), '2026-09-27').confidence, 'low', 'forum only: low')
const london = finalizeSelection(raw, results, job('Graduate Analyst', 'London, UK'), '2026-09-27')
eq([london.rolePattern, london.location], ['graduate', 'London'], 'matching pattern and sourced location kept')
eq(finalizeSelection(raw, [{ url: real, text: 'Case interview' }, results[1]!], job('Graduate Analyst', 'London, UK'), '2026-09-27').location, null, 'location no source names dropped')
const prep = finalizeSelection({ ...raw, sources: [{ url: real, title: 'Prep', kind: 'official' }] }, [{ url: real, text: '' }], job('Analyst', null), '2026-09-27')
eq([prep.sources[0]!.kind, prep.confidence], ['candidate report', 'medium'], 'third-party site claimed official downgraded')
console.log('selection ok')
