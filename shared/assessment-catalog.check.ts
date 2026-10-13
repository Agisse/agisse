// Run: npx tsx shared/assessment-catalog.check.ts
import { CURATED_ASSESSMENTS, PROVIDER_GAMES, curatedFor } from './assessment-catalog.ts'
import { GAME_IDS, SKILL_GAMES } from './assessments.ts'

const ok = (cond: unknown, what: string) => {
  if (!cond) throw new Error(what)
}

// Catalogue integrity: unique ids, real components, every component trains some skill.
ok(new Set(PROVIDER_GAMES.map((p) => p.id)).size === PROVIDER_GAMES.length, 'unique provider game ids')
for (const p of PROVIDER_GAMES) ok((GAME_IDS as readonly string[]).includes(p.gameId), `${p.id} → ${p.gameId} is a GameId`)
for (const id of GAME_IDS) ok(Object.values(SKILL_GAMES).some((gs) => gs.includes(id)), `${id} trains a skill`)
for (const c of CURATED_ASSESSMENTS) {
  for (const g of c.gameTypes) ok((GAME_IDS as readonly string[]).includes(g), `${c.company} game ${g}`)
  ok(c.stages.length && c.sources.length, `${c.company} has stages and sources`)
}

// Company matching: whole words and aliases, no substring false positives.
const names = (s: string) => curatedFor(s).map((c) => c.company)
ok(names('JPMorgan Chase & Co.')[0] === 'JPMorgan', 'JPMorgan Chase')
ok(names('J.P. Morgan')[0] === 'JPMorgan', 'J.P. Morgan alias')
ok(names('McKinsey & Company')[0] === 'McKinsey', 'McKinsey')
ok(names('Boston Consulting Group')[0] === 'BCG', 'BCG alias')
ok(names('EY Belgium')[0] === 'EY', 'EY')
ok(!names('Keyence').length && !names('Bainbridge Capital').length, 'no substring matches')
console.log('catalog ok')
