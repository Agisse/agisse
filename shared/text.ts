// Text helpers shared by the Worker and the client: phrase matching and the phrases no draft or CV should use.

// career-ops modes/_writing.md, plus the note-specific opener.
export const BANNED_PHRASES = [
  'passionate about',
  'leverage',
  'spearheaded',
  'synergies',
  'cutting-edge',
  'I hope this finds you well',
  'results-oriented',
  'proven track record',
  'facilitated',
  'robust',
  'seamless',
  'innovative',
  'best practices',
  'demonstrated ability to',
  "in today's fast-paced world",
]

/** Lowercase, accents folded, punctuation collapsed to single spaces. */
export const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim()

/** Phrase present word-for-word, ignoring case and punctuation. */
export const hasPhrase = (text: string, phrase: string) => !!norm(phrase) && ` ${norm(text)} `.includes(` ${norm(phrase)} `)
