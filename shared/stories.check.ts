// Run: npx tsx shared/stories.check.ts
import { bestStoryFor, competenciesOf, coverage, storiesFor, tagsFor, type Story } from './stories.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

const story = (id: string, text: string, tags: string[] = []): Story => ({ id, title: id, text, tags, createdAt: '2026-10-01' })
eq(tagsFor('Built a Python model in SQL Server; stakeholder updates weekly.', ['Python', 'SQL', 'R', 'stakeholder management']), ['Python', 'SQL'], 'tags are whole-word mentions')
const bank = [story('a', 'Led a team of 4 on a pricing model in Excel.', ['leadership']), story('b', 'Cleaned data in Python and SQL for the thesis.'), story('c', 'Organised a career fair.')]
eq(storiesFor(bank, ['Python', 'SQL', 'leadership']).map((x) => [x.story.id, x.hits]), [['b', ['Python', 'SQL']], ['a', ['leadership']]], 'ranked by hits')
eq(storiesFor(bank, ['Kubernetes']), [], 'no match')
// Competencies.
eq(competenciesOf('I led the society through a budget crisis and analysed the numbers.'), ['leadership', 'analysis'], 'competencies from signal words')
eq(competenciesOf('Plain text.', ['Conflict']), ['conflict'], 'a tag naming a competency counts')
eq(competenciesOf('We misled nobody'), [], 'stems match at a word start only')
const cov = coverage(bank)
eq(cov.length, 8, 'eight competencies')
eq(cov.filter((c) => c.stories.length).map((c) => c.id), ['leadership', 'teamwork', 'analysis'], 'covered')
eq(bestStoryFor('Tell me about a time you led a team.', bank)?.id, 'a', 'leadership question picks the leadership story')
eq(bestStoryFor('Describe a problem you solved with data.', bank)?.id, 'b', 'analysis question picks the data story')
eq(bestStoryFor('Anything?', []), null, 'no stories, no pick')
console.log('stories ok')
