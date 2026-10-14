// Run: npx tsx scripts/readme-translations.check.ts
// Each README.<lang>.md translates the block between the translations markers in README.md and records the hash of
// the English it was made from (`<!-- source: … -->`). Change that block, and the check names every translation to update.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const LANGS = ['nl', 'fr', 'de', 'es', 'it', 'pl']

const block = (md: string) => md.match(/<!-- translations:start -->\n([\s\S]*?)<!-- translations:end -->/)?.[1]
const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 12)
const source = (md: string) => md.match(/<!-- source: ([0-9a-f]{12}) -->/)?.[1]

const eq = (got: unknown, want: unknown, what: string) => {
  if (got !== want) throw new Error(`${what} = ${got}, want ${want}`)
}
eq(block('x\n<!-- translations:start -->\nHi.\n<!-- translations:end -->\ny'), 'Hi.\n', 'block')
eq(source('<!-- source: 0123456789ab -->\n# Agisse'), '0123456789ab', 'source')

const english = block(readFileSync('README.md', 'utf8'))
if (!english) throw new Error('README.md has no <!-- translations:start --> … <!-- translations:end --> block')
const want = hash(english)
const stale = LANGS.filter((l) => source(readFileSync(`README.${l}.md`, 'utf8')) !== want)
if (stale.length) {
  throw new Error(`The English README block changed. Update ${stale.map((l) => `README.${l}.md`).join(', ')} to match, then set <!-- source: ${want} --> at the top (or say in the PR which translations still need a native speaker).`)
}
console.log(`readme translations: ${LANGS.length} up to date (${want})`)
