// Run: npx tsx src/lib/changelog.check.ts
import { readFileSync } from 'node:fs'
import { inlineParts, leadOf, parseChangelog, releaseKey } from './changelog.ts'

const eq = (got: unknown, want: unknown, what: string) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
}

const md = `# Changelog

Intro with a - dash that is not a bullet.

## [Unreleased]

### Changed

- The feed explains itself.
- A long entry that wraps
  onto a second line.

### For contributors and self-hosters

- CI on every pull request.

## [0.1.0] - 2026-11-02

### Added

- First release.

## [0.0.1] - 2026-10-01

### For contributors and self-hosters

- Only plumbing.

[Unreleased]: https://github.com/Agisse/agisse/compare/v0.1.0...HEAD
`
eq(
  parseChangelog(md),
  [
    { version: 'Unreleased', date: null, changes: ['The feed explains itself.', 'A long entry that wraps onto a second line.'], groups: [{ title: 'Changed', changes: ['The feed explains itself.', 'A long entry that wraps onto a second line.'] }] },
    { version: '0.1.0', date: '2026-11-02', changes: ['First release.'], groups: [{ title: 'Added', changes: ['First release.'] }] },
  ],
  'releases, contributor sections and empty versions skipped',
)

eq(
  inlineParts('Say **Connect** in `Profile`, see [the docs](https://example.com/docs).'),
  [
    { kind: 'text', text: 'Say ' },
    { kind: 'bold', text: 'Connect' },
    { kind: 'text', text: ' in ' },
    { kind: 'code', text: 'Profile' },
    { kind: 'text', text: ', see ' },
    { kind: 'link', text: 'the docs', href: 'https://example.com/docs' },
    { kind: 'text', text: '.' },
  ],
  'inline parts',
)
eq(inlineParts('a ` lone backtick'), [{ kind: 'text', text: 'a ` lone backtick' }], 'unmatched marks stay text')

const r = { version: 'Unreleased', date: null, changes: ['One.'], groups: [] }
eq(releaseKey(r), releaseKey({ ...r, changes: ['One.'] }), 'same entries, same key')
if (releaseKey(r) === releaseKey({ ...r, changes: ['One.', 'Two.'] })) throw new Error('a new entry must change the key')
if (releaseKey(r) === releaseKey({ ...r, version: '0.1.0' })) throw new Error('a release must change the key')

eq(leadOf('Download my data, in Profile: one JSON file.'), { lead: 'Download my data, in Profile', rest: 'one JSON file.' }, 'lead splits at the first colon')
eq(leadOf('See `a: b` here.'), null, 'no lead when code comes first')
eq(leadOf('No colon at all.'), null, 'no lead without a colon')

// The real file: the page has something to show, and none of it is contributor plumbing.
const real = parseChangelog(readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8'))
if (!real.length) throw new Error('CHANGELOG.md has no user-facing changes')
if (real.some((r) => r.changes.some((c) => c.includes('*.check.ts')))) throw new Error('contributor entries leak into the page')

console.log('changelog ok')
