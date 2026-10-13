// Run: npx tsx worker/lib/assessments.check.ts
import { bestMatch, checkKind, finalizeResearch, normalizeSkills, percentileOf } from './assessments.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

// Rows arrive newest-created first.
const row = (id: string, rolePattern: string | null, location: string | null, sourceDate: string) => ({ id, rolePattern, location, sourceDate })
const rows = [
  row('any-old', null, null, '2025-01-01'),
  row('any-new', null, null, '2026-01-01'),
  row('graduate', 'Graduate', null, '2024-01-01'),
  row('grad-london', 'graduate', 'london', '2023-01-01'),
  row('intern', 'intern', null, '2026-06-01'),
  row('paris', null, 'Paris', '2026-06-01'),
]
eq(bestMatch(rows, 'Graduate Analyst', 'London, UK')?.id, 'grad-london', 'role + location beats role alone')
eq(bestMatch(rows, 'Graduate Analyst', 'Brussels')?.id, 'graduate', 'role match beats newer null pattern')
eq(bestMatch(rows, 'Analyst', 'Paris, France')?.id, 'paris', 'location match beats null')
eq(bestMatch(rows, 'Analyst', null)?.id, 'any-new', 'newest sourceDate among generic rows')
eq(bestMatch([row('a', null, null, '2026-01-01'), row('b', null, null, '2026-01-01')], 'x', null)?.id, 'a', 'tie keeps newest-created')
eq(bestMatch([row('intern', 'intern', null, '2026-01-01')], 'Analyst', null), null, 'non-matching pattern excluded')

eq(normalizeSkills([{ skill: 'attention', weight: 2 }, { skill: 'inhibition', weight: 1 }, { skill: 'attention', weight: 1 }, { skill: 'estimation', weight: -1 }]), [{ skill: 'attention', weight: 0.75 }, { skill: 'inhibition', weight: 0.25 }], 'normalizeSkills')
eq(normalizeSkills([{ skill: 'attention', weight: 0 }]), [], 'all-zero weights')

eq(percentileOf(50, [10, 50, 90, 100]), 38, 'percentile with a tie')
eq(percentileOf(50, []), null, 'no population')

const raw = {
  provider: 'arctic shores',
  rolePattern: 'trading',
  location: 'UK',
  assessmentTypes: ['video interview' as const],
  gameTypes: ['go-no-go' as const],
  skills: [{ skill: 'working-memory' as const, weight: 3 }, { skill: 'attention' as const, weight: 1 }],
  weightsStated: true,
  stages: ['Apply', ' ', 'Video interview'],
  difficulty: null,
  timeLimits: null,
  scoringDimensions: [],
  sources: [
    { url: 'https://example.com/made-up', title: 'Invented', kind: 'official' as const },
    { url: 'https://forum.example/thread', title: 'Thread', kind: 'forum' as const },
    { url: 'https://forum.example/thread', title: 'Dup', kind: 'forum' as const },
  ],
  confidence: 'high' as const,
  notes: null,
}
const forumText = 'Arctic Shores games and a recorded video interview; working memory and attention are what the games test'
const job = (role: string, location: string | null, jdText = '') => ({ company: 'Acme', role, location, jdText })
const r = finalizeResearch({ ...raw, assessmentTypes: ['video interview', 'game-based'] }, [{ url: 'https://forum.example/thread', text: forumText }], job('Graduate Analyst', 'London'), '2026-09-26')
eq(r.sources.map((s) => s.url), ['https://forum.example/thread'], 'sources not in results dropped, deduped')
eq(r.confidence, 'low', 'forum-only caps confidence at low')
eq(r.gameTypes, ['go-no-go'], 'games kept with game-based evidence')
eq(finalizeResearch(raw, [{ url: 'https://forum.example/thread', text: forumText }], job('Graduate Analyst', 'London'), '2026-09-26').gameTypes, [], 'no games without game-based in types')
eq(r.provider, 'arctic-shores', 'provider normalized')
eq([r.rolePattern, r.location], [null, null], 'pattern/location that miss this job dropped')
eq(r.skills, [{ skill: 'working-memory', weight: 0.75 }, { skill: 'attention', weight: 0.25 }], 'skills normalized')
const sjt = finalizeResearch({ ...raw, assessmentTypes: ['verbal', 'situational judgement'], skills: [{ skill: 'verbal-reasoning', weight: 1 }, { skill: 'situational-judgement', weight: 1 }, { skill: 'attention', weight: 1 }] }, [{ url: 'https://forum.example/thread', text: 'A verbal reasoning test and a situational judgement test' }], job('Graduate Analyst', 'London'), '2026-09-26')
eq(sjt.skills.map((s) => s.skill), ['verbal-reasoning', 'situational-judgement'], 'verbal and SJT types allow their skills only')
eq(r.weightsEstimated, false, 'stated weights kept')
eq(r.stages, ['Apply', 'Video interview'], 'blank stages dropped')

const official = finalizeResearch({ ...raw, assessmentTypes: ['game-based'], confidence: 'high', sources: [{ url: 'https://careers.acme.com', title: '', kind: 'official' }] }, [{ url: 'https://careers.acme.com', text: 'Our UK graduate scheme starts with online games.' }], job('Trading Graduate', 'London, UK'), '2026-09-26')
eq([official.confidence, official.gameTypes, official.rolePattern, official.location, official.sources[0]?.title], ['high', ['go-no-go'], 'trading', 'UK', 'https://careers.acme.com'], 'official source keeps high')

// Bain QA run: coding + spatial memory with no evidence, the job's city copied in, a prep site called "provider".
const prep = 'https://www.hackingthecaseinterview.com/pages/bain-online-assessment'
const bain = finalizeResearch(
  { ...raw, provider: null, location: 'Brussels, Belgium', assessmentTypes: ['numerical', 'coding'], gameTypes: [], skills: [{ skill: 'spatial-memory', weight: 0.4 }, { skill: 'numerical-speed', weight: 0.6 }], sources: [{ url: prep, title: 'Bain OA', kind: 'provider' }] },
  [{ url: prep, text: 'The Bain online test is a numerical reasoning test with charts.' }],
  { company: 'Bain & Company', role: 'Associate Consultant', location: 'Brussels, Belgium', jdText: 'Join our Brussels office.' },
  '2026-09-28',
)
eq(bain.assessmentTypes, ['numerical'], 'type no source mentions dropped')
eq(bain.skills, [{ skill: 'numerical-speed', weight: 1 }], 'skill no evidenced type tests dropped')
eq(bain.location, null, 'job location no source names dropped')
eq([bain.sources[0]?.kind, bain.confidence], ['candidate report', 'medium'], 'prep site is not a provider')
eq(checkKind('official', 'https://www.bain.com/careers/', 'Bain & Company', null), 'official', 'company domain is official')
eq(checkKind('provider', 'https://www.sovaassessment.com/x', 'Bain & Company', null), 'provider', 'known vendor domain is provider')

console.log('assessments ok')

// Named provider games need their name in the evidence; generic drills don't.
{
  const { gamesEvidenced } = await import('./assessments.ts')
  const got = gamesEvidenced(['balloons', 'grid-challenge', 'go-no-go', 'balloons'], 'Candidates play Balloons and a few other games.')
  if (JSON.stringify(got) !== JSON.stringify(['balloons', 'go-no-go'])) throw new Error(`gamesEvidenced = ${JSON.stringify(got)}`)
  const aon = gamesEvidenced(['grid-challenge'], 'The Aon gridChallenge takes 9 minutes.')
  if (aon[0] !== 'grid-challenge') throw new Error('gridChallenge by name')
  console.log('games evidence ok')
}
