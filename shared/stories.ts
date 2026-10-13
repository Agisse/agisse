// The story bank: a seeker's STAR stories, kept across applications (from career-ops' story bank).
// Stories are matched to a posting by its keywords; no model call.

export type Story = { id: string; title: string; text: string; tags: string[]; createdAt: string }
export const STORY_TEXT_LIMIT = 3000

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const mentions = (term: string, text: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(term)}($|[^\\p{L}\\p{N}])`, 'iu').test(text)

/** The posting keywords a story's text mentions: its suggested tags. */
export function tagsFor(text: string, keywords: string[]) {
  return [...new Set(keywords.map((k) => k.trim()).filter((k) => k && mentions(k, text)))].slice(0, 12)
}

/** Stories that speak to this posting, best first: a tag or a mention in the text counts once per keyword. */
export function storiesFor(stories: Story[], keywords: string[], max = 3) {
  return stories
    .map((s) => {
      const hits = keywords.filter((k) => s.tags.some((t) => t.toLowerCase() === k.toLowerCase()) || mentions(k, `${s.title}\n${s.text}`))
      return { story: s, hits }
    })
    .filter((x) => x.hits.length)
    .sort((a, b) => b.hits.length - a.hits.length)
    .slice(0, max)
}

// ---- Competency coverage ----

/** The eight competencies graduate interviews keep returning to, with word stems that signal each (matched at a word start). */
export const COMPETENCIES = {
  leadership: { label: 'Leadership', words: ['led ', 'lead', 'captain', 'president', 'chair', 'managed', 'organis', 'organiz', 'coordinat', 'delegat'] },
  teamwork: { label: 'Teamwork', words: ['team', 'together', 'colleague', 'group', 'collaborat'] },
  resilience: { label: 'Failure & resilience', words: ['fail', 'mistake', 'setback', 'rejected', 'resilien', 'went wrong', 'recover', 'bounce'] },
  conflict: { label: 'Conflict', words: ['conflict', 'disagree', 'tension', 'argument', 'difficult', 'complain', 'compromise'] },
  initiative: { label: 'Initiative', words: ['initiative', 'set up', 'founded', 'launched', 'proposed', 'on my own', 'volunteer', 'improv', 'started a'] },
  analysis: { label: 'Analysis & problem solving', words: ['analys', 'analyz', 'data', 'problem', 'solv', 'root cause', 'model', 'excel', 'investigat', 'numbers'] },
  influence: { label: 'Influence', words: ['persua', 'convinc', 'influenc', 'negotiat', 'pitch', 'won over', 'win over', 'stakeholder', 'buy-in'] },
  motivation: { label: 'Motivation', words: ['why i ', 'motivat', 'passion', 'drawn to', 'inspired', 'always wanted'] },
} as const
export type Competency = keyof typeof COMPETENCIES
const COMPETENCY_IDS = Object.keys(COMPETENCIES) as Competency[]

const startsWord = (stem: string, text: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(stem)}`, 'iu').test(text)

/** Competencies a text shows: a tag naming it, or one of its signal stems. */
export function competenciesOf(text: string, tags: string[] = []): Competency[] {
  const tagText = tags.join(' ').toLowerCase()
  return COMPETENCY_IDS.filter((id) => tagText.includes(id) || tagText.includes(COMPETENCIES[id].label.toLowerCase()) || COMPETENCIES[id].words.some((w) => startsWord(w, `${text} `)))
}

/** Which competencies the bank covers, and with which stories. */
export function coverage(stories: Story[]) {
  return COMPETENCY_IDS.map((id) => ({ id, label: COMPETENCIES[id].label, stories: stories.filter((s) => competenciesOf(`${s.title}\n${s.text}`, s.tags).includes(id)) }))
}

const STOP = new Set(['about', 'tell', 'time', 'that', 'this', 'with', 'what', 'when', 'your', 'have', 'from', 'were', 'describe', 'example'])
const longWords = (text: string) => (text.toLowerCase().match(/\p{L}{4,}/gu) ?? []).filter((w) => !STOP.has(w))

/** The saved story that best fits an interview question: shared competencies first, then shared words. */
export function bestStoryFor(question: string, stories: Story[]): Story | null {
  const want = competenciesOf(question).filter((c) => c !== 'motivation')
  const qWords = new Set(longWords(question))
  let best: { s: Story; score: number } | null = null
  for (const s of stories) {
    const have = competenciesOf(`${s.title}\n${s.text}`, s.tags)
    const score = want.filter((c) => have.includes(c)).length * 10 + Math.min(9, new Set(longWords(`${s.title} ${s.text}`).filter((w) => qWords.has(w))).size)
    if (score > 0 && (!best || score > best.score)) best = { s, score }
  }
  return best?.s ?? null
}
