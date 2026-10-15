/** One `## [version]` of CHANGELOG.md, as the in-app "What's new" page shows it: every change, and the same changes under their `###` heading. */
export type Release = { version: string; date: string | null; changes: string[]; groups: { title: string; changes: string[] }[] }

/** The section that only matters to contributors and self-hosters; the page leaves it out. */
const SKIP = 'For contributors and self-hosters'

/** Reads the few shapes CHANGELOG.md uses: `## [version] - date`, `### Heading` and `- ` bullets. */
export function parseChangelog(md: string): Release[] {
  const releases: Release[] = []
  let skip = false
  for (const line of md.split('\n')) {
    const version = line.match(/^## \[([^\]]+)\](?:\s*-\s*(\S+))?/)
    if (version) {
      releases.push({ version: version[1], date: version[2] ?? null, changes: [], groups: [] })
      skip = false
      continue
    }
    const release = releases.at(-1)
    if (line.startsWith('### ')) {
      skip = line.slice(4).trim() === SKIP
      if (!skip) release?.groups.push({ title: line.slice(4).trim(), changes: [] })
    }
    if (skip || !release) continue
    if (line.startsWith('- ')) {
      if (!release.groups.length) release.groups.push({ title: '', changes: [] })
      release.groups.at(-1)!.changes.push(line.slice(2).trim())
    } else if (/^\s+\S/.test(line) && release.groups.at(-1)?.changes.length) {
      const changes = release.groups.at(-1)!.changes
      changes[changes.length - 1] += ` ${line.trim()}`
    }
  }
  for (const r of releases) {
    r.groups = r.groups.filter((g) => g.changes.length)
    r.changes = r.groups.flatMap((g) => g.changes)
  }
  return releases.filter((r) => r.changes.length)
}

/** Splits a bullet into plain text, `code`, **bold** and [links](url), for rendering without a markdown library. */
export function inlineParts(text: string): ({ kind: 'text' | 'code' | 'bold'; text: string } | { kind: 'link'; text: string; href: string })[] {
  return text
    .split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith('`') && part.endsWith('`') && part.length > 1) return { kind: 'code', text: part.slice(1, -1) }
      if (part.startsWith('**') && part.endsWith('**') && part.length > 3) return { kind: 'bold', text: part.slice(2, -2) }
      const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
      if (link) return { kind: 'link', text: link[1], href: link[2] }
      return { kind: 'text', text: part }
    })
}

/** Changes whenever the release's entries do, so a new `[Unreleased]` entry counts as news too. */
export function releaseKey(r: Release): string {
  let h = 0
  for (const c of r.changes.join('\n')) h = (Math.imul(31, h) + c.codePointAt(0)!) | 0
  return `${r.version}:${(h >>> 0).toString(36)}`
}

/** An entry that opens with a short name ("What's new, in the account menu: the changes…") splits into that name and the rest. */
export function leadOf(text: string): { lead: string; rest: string } | null {
  const i = text.indexOf(': ')
  if (i < 3 || i > 90 || /[`[*]/.test(text.slice(0, i))) return null
  return { lead: text.slice(0, i), rest: text.slice(i + 2) }
}
