// Public SEO pages generated from the in-app assessment catalog, so the guides and the app never disagree.
import { CURATED_ASSESSMENTS, PROVIDER_GAMES, UNTRAINABLE, type CuratedAssessment } from '../../shared/assessment-catalog'
import { PROVIDERS } from '../../shared/assessments'
import { readFileSync } from 'node:fs'
import { PROVIDER_IDS, providerName, slug } from './names'
export { PROVIDER_IDS }

// The game component's own rules line (its GameDef `howTo`), for provider games that run the default variant.
const GAMES = new URL('../../src/features/assessments/games/', import.meta.url)
const gamesIndex = readFileSync(new URL('index.ts', GAMES), 'utf8')
export function defaultHowTo(gameId: string) {
  const name = gamesIndex.match(new RegExp(`'?${gameId}'?: (\\w+)`))?.[1] ?? gameId
  const file = gamesIndex.match(new RegExp(`import \\{ ${name} \\} from '\\./(\\w+)'`))?.[1]
  return file ? readFileSync(new URL(`${file}.tsx`, GAMES), 'utf8').match(/^  howTo: '((?:[^'\\]|\\.)*)'/m)?.[1].replace(/\\'/g, "'") ?? '' : ''
}

const length = (g: { realDuration: number | null; realRounds: number | null }) =>
  [g.realDuration == null ? '' : g.realDuration < 120 ? `${g.realDuration} s` : `${Math.round(g.realDuration / 60)} min`, g.realRounds ? `${g.realRounds} rounds` : ''].filter(Boolean).join(', ') || 'set by the employer'
const CTA = '[Practise these in Agisse](https://agisse.xyz/?utm_source=docs&utm_medium=guide) — invite-only beta.'

export function firmPage(c: CuratedAssessment) {
  const p = c.provider ? providerName(c.provider) : null
  const games = PROVIDER_GAMES.filter((g) => g.provider === c.provider)
  const title = `${c.company} online assessment and selection process`
  const description = `How ${c.company} hires graduates and interns: ${p ? `${p} online test, ` : ''}every stage in order, time limits and how to prepare.`.slice(0, 160)
  const list = (xs: string[]) => xs.filter(Boolean).map((x) => `- ${x}`).join('\n')
  const md = [
    `# ${title}`,
    `What candidates face when they apply to ${c.company}, stage by stage. Checked ${c.sourceDate}; confidence **${c.confidence}**. Processes change by office and year: your invitation email is the final word.`,
    '## Stages',
    list(c.stages.map((s) => s.replace(/^\d+\.\s*/, ''))),
    c.timeLimits ? `**Time limits:** ${c.timeLimits}` : '',
    p ? `**Test provider:** ${PROVIDER_IDS.includes(c.provider!) ? `[${p}](/tests/${slug(c.provider!)})` : p}` : '',
    c.assessmentTypes.length ? `**What is tested:** ${c.assessmentTypes.join(', ')}` : '',
    c.interview ? `**Video interview:** about ${c.interview.questions} question${c.interview.questions > 1 ? 's' : ''}, ${c.interview.prepSec} s to prepare, ${c.interview.answerSec / 60} min per answer, ${c.interview.retakes ? `${c.interview.retakes} retake` : 'no retakes'}.` : '',
    c.notes ? `> ${c.notes}` : '',
    games.length ? `## The ${p} tasks` : '',
    games.length ? ['| Task | Measures | Length |', '|---|---|---|', ...games.map((g) => `| ${g.name} | ${g.measures} | ${length(g)} |`)].join('\n') : '',
    '## How to prepare',
    list([
      'Do the provider’s own free practice first so the interface is not new on the day.',
      games.length ? `Practise each task above under real timing. ${CTA}` : CTA,
      c.interview ? 'Record yourself answering three motivation and strengths questions in the time limits above; watch one back.' : '',
    ]),
    '## Sources',
    list(c.sources.map((s) => `[${s.title}](${s.url}) (${s.kind})`)),
  ]
  return { params: { firm: slug(c.company), title, description }, content: md.filter(Boolean).join('\n\n') }
}

export function providerPage(id: string) {
  const name = providerName(id)
  const games = PROVIDER_GAMES.filter((g) => g.provider === id)
  const firms = CURATED_ASSESSMENTS.filter((c) => c.provider === id)
  const profile = PROVIDERS.find((p) => p.id === id)
  const extra = UNTRAINABLE.filter((u) => u.provider === id)
  const title = `${name} assessment: every task explained`
  const description = `${name} online assessment for graduate jobs and internships: each task, what it measures, how long it runs, and tactics.`.slice(0, 160)
  const md = [
    `# ${title}`,
    profile?.note ?? '',
    firms.length ? `**Used by:** ${firms.map((f) => `[${f.company}](/guides/${slug(f.company)})`).join(', ')} (and many more).` : '',
    '## Tasks',
    ...games.map((g) =>
      [`### ${g.name}`, `**Measures:** ${g.measures}. **Length:** ${length(g)}${g.basis === 'reconstructed' || g.note?.includes('reconstructed') ? ' (from candidate reports)' : ''}.`, g.howTo ?? defaultHowTo(g.gameId), g.guide ?? '', g.note && !g.note.includes('reconstructed') ? `> ${g.note}` : '', g.practiceUrl ? `[Official practice](${g.practiceUrl})` : '']
        .filter(Boolean)
        .join('\n\n'),
    ),
    ...extra.map((u) => `### ${u.name}\n\n${u.note}`),
    '## Practise',
    CTA,
  ]
  return { params: { provider: slug(id), title, description }, content: md.filter(Boolean).join('\n\n') }
}
